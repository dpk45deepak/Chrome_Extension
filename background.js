// Configuration
const CONFIG = {
    GEMINI_API_KEY: 'AIzaSyA43kk0BenDNSNrVUbGn89p_kBYuAJA3II', // You'll need to get this from Google AI Studio
    WAKE_WORD: 'hey vani',
    COMMAND_HISTORY_SIZE: 50
};

// Hardcoded commands with Hinglish support
const BUILT_IN_COMMANDS = {
    // Music commands
    'play': (query) => playMusic(query),
    'play song': (query) => playMusic(query),
    'gaana chalao': (query) => playMusic(query),
    'music play': (query) => playMusic(query),

    // Tab management
    'new tab': () => createNewTab(),
    'close tab': () => closeCurrentTab(),
    'next tab': () => switchToNextTab(),
    'previous tab': () => switchToPreviousTab(),

    // Navigation
    'go back': () => goBack(),
    'go forward': () => goForward(),
    'pichhe jao': () => goBack(),
    'aage jao': () => goForward(),

    // Page actions
    'scroll up': () => scrollPage(-300),
    'scroll down': () => scrollPage(300),
    'scroll to top': () => scrollToTop(),
    'scroll to bottom': () => scrollToBottom(),
    'read page': () => readPageContent(),
    'summarize page': () => summarizePage(),
    'page summary': () => summarizePage(),

    // Search
    'search': (query) => searchWeb(query),
    'google': (query) => searchWeb(query),
    'search karo': (query) => searchWeb(query),

    // Website opening
    'open youtube': () => openWebsite('https://youtube.com'),
    'open facebook': () => openWebsite('https://facebook.com'),
    'open gmail': () => openWebsite('https://gmail.com'),
    'open whatsapp': () => openWebsite('https://web.whatsapp.com'),
    'open amazon': () => openWebsite('https://amazon.com'),
    'open flipkart': () => openWebsite('https://flipkart.com'),

    // Utility
    'refresh': () => refreshPage(),
    'reload': () => refreshPage(),
    'stop': () => stopSpeaking()
};

// Command processing and execution
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);

    switch (request.type) {
        case 'VOICE_COMMAND':
            processVoiceCommand(request.command);
            break;

        case 'TOGGLE_WAKE_WORD':
            handleWakeWordToggle(request.enabled);
            break;

        case 'PROCESS_HINGLISH':
            processHinglishCommand(request.command);
            break;
    }
});

let wakeWordRecognition = null;
let isWakeWordEnabled = false;

function handleWakeWordToggle(enabled) {
    isWakeWordEnabled = enabled;

    if (enabled && !wakeWordRecognition) {
        startWakeWordDetection();
    } else if (!enabled && wakeWordRecognition) {
        stopWakeWordDetection();
    }
}

function startWakeWordDetection() {
    if (!('webkitSpeechRecognition' in window)) return;

    wakeWordRecognition = new webkitSpeechRecognition();
    wakeWordRecognition.continuous = true;
    wakeWordRecognition.interimResults = false;
    wakeWordRecognition.lang = 'en-US';

    wakeWordRecognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();

        if (transcript.includes(CONFIG.WAKE_WORD)) {
            speakFeedback('Yes, I am listening');
            // Trigger listening mode
            chrome.runtime.sendMessage({ type: 'WAKE_WORD_DETECTED' });
        }
    };

    wakeWordRecognition.onerror = (event) => {
        console.log('Wake word recognition error:', event.error);
        // Restart on error
        setTimeout(() => {
            if (isWakeWordEnabled) {
                wakeWordRecognition.start();
            }
        }, 1000);
    };

    wakeWordRecognition.onend = () => {
        // Restart continuously
        if (isWakeWordEnabled) {
            setTimeout(() => wakeWordRecognition.start(), 500);
        }
    };

    wakeWordRecognition.start();
}

function stopWakeWordDetection() {
    if (wakeWordRecognition) {
        wakeWordRecognition.stop();
        wakeWordRecognition = null;
    }
}

async function processVoiceCommand(command) {
    console.log('Processing command:', command);
    addToCommandHistory(command, 'Processing...', true);

    // First check custom commands
    const customCommandResult = await checkCustomCommands(command);
    if (customCommandResult) return;

    // Then check built-in commands
    const builtInResult = await checkBuiltInCommands(command);
    if (builtInResult) return;

    // If no direct match, try to understand Hinglish/context
    await processHinglishCommand(command);
}

async function checkCustomCommands(command) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['customCommands'], function (result) {
            const customCommands = result.customCommands || {};
            const matchedCommand = Object.keys(customCommands).find(cmd =>
                command.toLowerCase().includes(cmd.toLowerCase())
            );

            if (matchedCommand) {
                const action = customCommands[matchedCommand];
                executeCustomCommand(action, command);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

async function checkBuiltInCommands(command) {
    const lowerCommand = command.toLowerCase();

    for (const [cmd, action] of Object.entries(BUILT_IN_COMMANDS)) {
        if (lowerCommand.includes(cmd)) {
            const query = command.replace(cmd, '').trim();
            await action(query);
            return true;
        }
    }

    // Check for open website command
    if (lowerCommand.includes('open ')) {
        const urlMatch = command.match(/open\s+(.+)/i);
        if (urlMatch) {
            const url = urlMatch[1].trim();
            openWebsite(url);
            return true;
        }
    }

    // Check for click command
    if (lowerCommand.includes('click ')) {
        const elementType = command.replace('click ', '').trim();
        clickElement(elementType);
        return true;
    }

    // Check for highlight command
    if (lowerCommand.includes('highlight ')) {
        const text = command.replace('highlight ', '').trim();
        highlightText(text);
        return true;
    }

    return false;
}

async function processHinglishCommand(command) {
    // For now, use simple pattern matching for Hinglish
    // In production, you'd use Gemini API for better understanding

    const hinglishPatterns = {
        'kya hal hai|kaise ho|how are you': () => speakFeedback('I am doing great, thank you! How can I help you?'),
        'time kya hai|samay kya hai|what time': () => speakFeedback(`The current time is ${new Date().toLocaleTimeString()}`),
        'aaj ka mausam|weather kaisa hai': () => speakFeedback('I cannot access weather information yet, but you can ask me to search for weather updates.'),
        'band karo|stop karo': () => stopSpeaking(),
        'shukriya|thank you|dhanyavad': () => speakFeedback('You are welcome!'),
    };

    for (const [pattern, action] of Object.entries(hinglishPatterns)) {
        if (new RegExp(pattern, 'i').test(command)) {
            await action();
            addToCommandHistory(command, 'Processed Hinglish command', true);
            return;
        }
    }

    // If no pattern matches, try to extract intent
    if (command.includes('video') || command.includes('film') || command.includes('movie')) {
        playMusic(command.replace(/video|film|movie/gi, '').trim());
    } else if (command.includes('khoj') || command.includes('dhundh')) {
        searchWeb(command);
    } else {
        speakFeedback(`I didn't understand: "${command}". Try saying "search ${command}" or "open ${command}".`);
        addToCommandHistory(command, 'Command not understood', false);
    }
}

// Command implementations
function playMusic(query) {
    if (!query) {
        openWebsite('https://youtube.com');
        speakFeedback('Opening YouTube');
    } else {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        chrome.tabs.create({ url: searchUrl });
        speakFeedback(`Searching for ${query} on YouTube`);
    }
    addToCommandHistory(`play ${query}`, 'Playing music', true);
}

function createNewTab() {
    chrome.tabs.create({ url: 'https://www.google.com' });
    speakFeedback('Opening new tab');
}

function closeCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.remove(tabs[0].id);
        }
    });
    speakFeedback('Closing current tab');
}

function switchToNextTab() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (current) => {
            if (current[0]) {
                const currentIndex = tabs.findIndex(tab => tab.id === current[0].id);
                const nextIndex = (currentIndex + 1) % tabs.length;
                chrome.tabs.update(tabs[nextIndex].id, { active: true });
            }
        });
    });
}

function switchToPreviousTab() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (current) => {
            if (current[0]) {
                const currentIndex = tabs.findIndex(tab => tab.id === current[0].id);
                const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                chrome.tabs.update(tabs[prevIndex].id, { active: true });
            }
        });
    });
}

function goBack() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.goBack(tabs[0].id);
        }
    });
    speakFeedback('Going back');
}

function goForward() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.goForward(tabs[0].id);
        }
    });
    speakFeedback('Going forward');
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

function scrollToTop() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
    speakFeedback('Scrolling to top');
}

function scrollToBottom() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        });
    });
    speakFeedback('Scrolling to bottom');
}

function readPageContent() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                // Get main content (simplified)
                const mainContent = document.querySelector('main') ||
                    document.querySelector('article') ||
                    document.querySelector('[role="main"]') ||
                    document.body;

                const text = mainContent.innerText.replace(/\s+/g, ' ').substring(0, 1000);
                return text;
            }
        }, (results) => {
            if (results && results[0] && results[0].result) {
                const text = results[0].result;
                speakFeedback(`Reading page content: ${text.substring(0, 200)}...`);
            }
        });
    });
}

async function summarizePage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                const mainContent = document.querySelector('main') ||
                    document.querySelector('article') ||
                    document.querySelector('[role="main"]') ||
                    document.body;

                return mainContent.innerText.replace(/\s+/g, ' ').substring(0, 5000);
            }
        }, async (results) => {
            if (results && results[0] && results[0].result) {
                const content = results[0].result;
                // In a real implementation, you'd send this to Gemini API
                // For now, create a simple summary
                const sentences = content.split('.').slice(0, 3);
                const summary = sentences.join('. ') + '.';
                speakFeedback(`Page summary: ${summary}`);
            }
        });
    });
}

function searchWeb(query) {
    if (!query) {
        openWebsite('https://google.com');
        speakFeedback('Opening Google');
    } else {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        chrome.tabs.create({ url: searchUrl });
        speakFeedback(`Searching for ${query}`);
    }
}

function openWebsite(url) {
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    chrome.tabs.create({ url: url });
    speakFeedback(`Opening ${url}`);
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
                        el.textContent.toLowerCase().includes(type.toLowerCase()) ||
                        (el.value && el.value.toLowerCase().includes(type.toLowerCase()))
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

function highlightText(text) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (searchText) => {
                // Remove previous highlights
                const existingHighlights = document.querySelectorAll('.vani-highlight');
                existingHighlights.forEach(el => {
                    el.classList.remove('vani-highlight');
                });

                // Search and highlight
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.toLowerCase().includes(searchText.toLowerCase())) {
                        const span = document.createElement('span');
                        span.className = 'vani-highlight';
                        span.style.backgroundColor = 'yellow';
                        span.style.color = 'black';
                        span.textContent = node.textContent;
                        node.parentNode.replaceChild(span, node);
                    }
                }

                // Scroll to first occurrence
                const firstHighlight = document.querySelector('.vani-highlight');
                if (firstHighlight) {
                    firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            },
            args: [text]
        });
    });
    speakFeedback(`Highlighting ${text}`);
}

function refreshPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.reload(tabs[0].id);
    });
    speakFeedback('Refreshing page');
}

function stopSpeaking() {
    chrome.tts.stop();
    speakFeedback('Stopped speaking');
}

function executeCustomCommand(action, originalCommand) {
    if (action.startsWith('http')) {
        openWebsite(action);
    } else {
        // Execute as a script or built-in command
        processVoiceCommand(action);
    }
    addToCommandHistory(originalCommand, 'Executed custom command', true);
}

function speakFeedback(text) {
    chrome.tts.speak(text, {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
    });
}

function addToCommandHistory(command, response, success) {
    chrome.storage.local.get(['commandHistory'], function (result) {
        const history = result.commandHistory || [];
        history.push({
            command: command,
            response: response,
            success: success,
            timestamp: new Date().toLocaleTimeString()
        });

        // Keep only last N commands
        if (history.length > CONFIG.COMMAND_HISTORY_SIZE) {
            history.splice(0, history.length - CONFIG.COMMAND_HISTORY_SIZE);
        }

        chrome.storage.local.set({ commandHistory: history });
    });
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Vani Voice Assistant extension installed');

    // Initialize default settings
    chrome.storage.local.set({
        wakeWordEnabled: false,
        commandHistory: [],
        customCommands: {}
    });
});