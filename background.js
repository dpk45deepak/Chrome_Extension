// Command processing and execution
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const command = request.command.toLowerCase();
    console.log('Processing command:', command);

    processVoiceCommand(command);
});

function processVoiceCommand(command) {
    speakFeedback(`Processing: ${command}`);

    // Open website command
    if (command.includes('open ') && (command.includes('.com') || command.includes('.org') || command.includes('.net'))) {
        let url = command.replace('open ', '').trim();
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        chrome.tabs.create({ url: url });
        speakFeedback(`Opening ${url}`);
    }
    // Search command
    else if (command.includes('search ')) {
        const query = command.replace('search ', '').trim();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        chrome.tabs.create({ url: searchUrl });
        speakFeedback(`Searching for ${query}`);
    }
    // Scroll commands
    else if (command.includes('scroll down')) {
        scrollPage(300);
        speakFeedback('Scrolling down');
    }
    else if (command.includes('scroll up')) {
        scrollPage(-300);
        speakFeedback('Scrolling up');
    }
    // Click commands
    else if (command.includes('click ')) {
        const elementType = command.replace('click ', '').trim();
        clickElement(elementType);
        speakFeedback(`Clicking ${elementType}`);
    }
    // Select input commands
    else if (command.includes('select ') && command.includes('input')) {
        selectInput(command);
        speakFeedback('Selecting input field');
    }
    else {
        speakFeedback(`Command not recognized: ${command}`);
    }
}

function scrollPage(amount) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (scrollAmount) => {
                window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            },
            args: [amount]
        });
    });
}

function clickElement(elementType) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (type) => {
                let element;

                if (type === 'button') {
                    element = document.querySelector('button');
                } else if (type === 'link') {
                    element = document.querySelector('a');
                } else {
                    // Try to find element by text content
                    const elements = document.querySelectorAll('button, a, input[type="button"], input[type="submit"]');
                    element = Array.from(elements).find(el =>
                        el.textContent.toLowerCase().includes(type) ||
                        el.value.toLowerCase().includes(type)
                    );
                }

                if (element) {
                    element.click();
                    return true;
                }
                return false;
            },
            args: [elementType]
        });
    });
}

function selectInput(command) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (cmd) => {
                const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input[type="email"], textarea');

                if (cmd.includes('first')) {
                    if (inputs[0]) {
                        inputs[0].focus();
                        inputs[0].select();
                        return true;
                    }
                } else if (cmd.includes('last')) {
                    if (inputs.length > 0) {
                        inputs[inputs.length - 1].focus();
                        inputs[inputs.length - 1].select();
                        return true;
                    }
                }

                return false;
            },
            args: [command]
        });
    });
}

function speakFeedback(text) {
    chrome.tts.speak(text, {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
    });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Voice Assistant extension installed');
});