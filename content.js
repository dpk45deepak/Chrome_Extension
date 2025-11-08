// Content script for page interactions
console.log('Vani Voice Assistant content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case 'HIGHLIGHT_TEXT':
            highlightText(request.text);
            sendResponse({ success: true });
            break;

        case 'READ_SELECTED_TEXT':
            readSelectedText();
            sendResponse({ success: true });
            break;

        case 'GET_PAGE_CONTENT':
            const content = getPageContent();
            sendResponse({ content: content });
            break;
    }

    return true; // Keep message channel open for async response
});

function highlightText(text) {
    // Remove previous highlights
    const existingHighlights = document.querySelectorAll('.vani-highlight');
    existingHighlights.forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
    });

    if (!text) return;

    // Highlight all occurrences
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    const nodes = [];

    while (node = walker.nextNode()) {
        if (node.textContent.toLowerCase().includes(text.toLowerCase())) {
            nodes.push(node);
        }
    }

    nodes.forEach(node => {
        const span = document.createElement('span');
        span.className = 'vani-highlight';
        span.style.backgroundColor = '#FFEB3B';
        span.style.color = '#000';
        span.style.padding = '2px 1px';
        span.style.borderRadius = '2px';
        span.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        span.textContent = node.textContent;
        node.parentNode.replaceChild(span, node);
    });

    // Scroll to first occurrence
    const firstHighlight = document.querySelector('.vani-highlight');
    if (firstHighlight) {
        firstHighlight.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    }
}

function readSelectedText() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        // Use the Web Speech API to speak selected text
        const utterance = new SpeechSynthesisUtterance(selectedText.substring(0, 200));
        speechSynthesis.speak(utterance);
    }
}

function getPageContent() {
    // Get readable content from the page
    const selectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.post',
        '.article',
        '.story'
    ];

    let contentElement = document.body;

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.length > 100) {
            contentElement = element;
            break;
        }
    }

    return contentElement.innerText
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000);
}

// Add styles for highlights
const style = document.createElement('style');
style.textContent = `
    .vani-highlight {
        background-color: #FFEB3B !important;
        color: #000 !important;
        padding: 2px 1px !important;
        border-radius: 2px !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
        transition: all 0.3s ease !important;
    }
    
    .vani-highlight:hover {
        background-color: #FFD54F !important;
        transform: scale(1.02) !important;
    }
`;
document.head.appendChild(style);