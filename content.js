class ContentScript {
    constructor() {
        this.init();
    }

    init() {
        this.setupMessageListeners();
        this.injectStyles();
        console.log('Vani Voice Assistant content script loaded');
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content script received message:', request.type);

            try {
                switch (request.type) {
                    case 'HIGHLIGHT_TEXT':
                        this.highlightText(request.text);
                        sendResponse({ success: true });
                        break;

                    case 'READ_SELECTED_TEXT':
                        this.readSelectedText();
                        sendResponse({ success: true });
                        break;

                    case 'READ_PAGE_CONTENT':
                        this.readPageContent();
                        sendResponse({ success: true });
                        break;

                    case 'GET_PAGE_CONTENT':
                        const content = this.getPageContent();
                        sendResponse({ content: content });
                        break;

                    case 'CLICK_ELEMENT':
                        this.clickElement(request.element);
                        sendResponse({ success: true });
                        break;

                    case 'PAUSE_MEDIA':
                        this.pauseMedia();
                        sendResponse({ success: true });
                        break;

                    case 'SHOW_VOICE_INDICATOR':
                        this.showVoiceIndicator();
                        sendResponse({ success: true });
                        break;

                    case 'HIDE_VOICE_INDICATOR':
                        this.hideVoiceIndicator();
                        sendResponse({ success: true });
                        break;

                    case 'SCROLL_PAGE':
                        this.scrollPage(request.direction);
                        sendResponse({ success: true });
                        break;

                    default:
                        console.warn('Unknown message type:', request.type);
                        sendResponse({ success: false, error: 'Unknown message type' });
                }
            } catch (error) {
                console.error('Error handling message:', error);
                sendResponse({ success: false, error: error.message });
            }

            return true;
        });
    }

    injectStyles() {
        // Check if styles are already injected
        if (document.getElementById('vani-styles')) return;

        const style = document.createElement('style');
        style.id = 'vani-styles';
        style.textContent = `
            .vani-highlight {
                background-color: #FFEB3B !important;
                color: #000000 !important;
                padding: 2px 4px !important;
                border-radius: 4px !important;
                box-shadow: 0 2px 8px rgba(255, 235, 59, 0.4) !important;
                transition: all 0.3s ease !important;
                animation: vani-pulse 2s infinite !important;
            }

            .vani-highlight:hover {
                background-color: #FFD54F !important;
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 12px rgba(255, 235, 59, 0.6) !important;
            }

            .vani-voice-indicator {
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                width: 60px !important;
                height: 60px !important;
                border-radius: 50% !important;
                background: linear-gradient(135deg, #667eea, #764ba2) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: white !important;
                font-size: 24px !important;
                z-index: 10000 !important;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
                border: 2px solid white !important;
                animation: vani-float 3s ease-in-out infinite !important;
            }

            .vani-tooltip {
                position: absolute !important;
                background: rgba(0, 0, 0, 0.8) !important;
                color: white !important;
                padding: 8px 12px !important;
                border-radius: 6px !important;
                font-size: 12px !important;
                z-index: 10001 !important;
                pointer-events: none !important;
                white-space: nowrap !important;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
            }

            @keyframes vani-pulse {
                0%, 100% {
                    box-shadow: 0 2px 8px rgba(255, 235, 59, 0.4);
                }
                50% {
                    box-shadow: 0 2px 12px rgba(255, 235, 59, 0.8);
                }
            }

            @keyframes vani-float {
                0%, 100% {
                    transform: translateY(0px);
                }
                50% {
                    transform: translateY(-5px);
                }
            }
        `;
        document.head.appendChild(style);
    }

    highlightText(text) {
        // Remove previous highlights
        this.removeHighlights();

        if (!text || text.trim().length === 0) {
            console.log('No text provided for highlighting');
            return;
        }

        console.log('Highlighting text:', text);

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodes = [];
        let node;

        while (node = walker.nextNode()) {
            if (node.textContent.toLowerCase().includes(text.toLowerCase())) {
                nodes.push(node);
            }
        }

        let highlightedCount = 0;
        nodes.forEach(node => {
            try {
                const span = document.createElement('span');
                span.className = 'vani-highlight';
                span.setAttribute('data-vani-highlight', text);
                span.textContent = node.textContent;

                if (node.parentNode) {
                    node.parentNode.replaceChild(span, node);
                    highlightedCount++;
                }
            } catch (error) {
                console.error('Error highlighting node:', error);
            }
        });

        // Scroll to first occurrence
        const firstHighlight = document.querySelector('.vani-highlight');
        if (firstHighlight) {
            firstHighlight.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        console.log(`Highlighted ${highlightedCount} occurrences of "${text}"`);
    }

    removeHighlights() {
        const highlights = document.querySelectorAll('.vani-highlight');
        console.log(`Removing ${highlights.length} highlights`);

        highlights.forEach(highlight => {
            try {
                const parent = highlight.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                    parent.normalize();
                }
            } catch (error) {
                console.error('Error removing highlight:', error);
            }
        });
    }

    readSelectedText() {
        const selection = window.getSelection();
        if (selection.toString().trim()) {
            const text = selection.toString().substring(0, 300); // Limit length
            console.log('Reading selected text:', text);

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.lang = 'en-IN';

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);

            // Show reading indicator
            this.showReadingIndicator();
        } else {
            console.log('No text selected for reading');
        }
    }

    readPageContent() {
        const content = this.getPageContent();
        if (content && content.length > 0) {
            const utterance = new SpeechSynthesisUtterance(content.substring(0, 500)); // Limit length
            utterance.rate = 0.9; // Slightly slower for reading
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            utterance.lang = 'en-IN';

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);

            this.showReadingIndicator();
        }
    }

    showReadingIndicator() {
        this.hideReadingIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'vani-voice-indicator';
        indicator.innerHTML = '📖';
        indicator.id = 'vani-reading-indicator';
        indicator.title = 'Vani is reading content';

        document.body.appendChild(indicator);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideReadingIndicator();
        }, 5000);
    }

    hideReadingIndicator() {
        const existingIndicator = document.getElementById('vani-reading-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }

    getPageContent() {
        // Try to find the main content of the page
        const contentSelectors = [
            'article',
            'main',
            '[role="main"]',
            '.content',
            '.post-content',
            '.article-content',
            '.story-content',
            '.entry-content',
            '.post',
            '.article'
        ];

        let contentElement = document.body;

        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element && this.getTextLength(element) > 200) {
                contentElement = element;
                console.log('Found content element using selector:', selector);
                break;
            }
        }

        const content = this.cleanText(contentElement.textContent);
        console.log('Extracted page content length:', content.length);
        return content;
    }

    getTextLength(element) {
        return element.textContent.replace(/\s+/g, ' ').trim().length;
    }

    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s.,!?;:()\-@#$/&*+=]/g, '')
            .trim()
            .substring(0, 5000);
    }

    clickElement(elementType) {
        console.log('Attempting to click element:', elementType);

        const elements = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]');

        for (const element of elements) {
            const elementText = element.textContent?.toLowerCase() ||
                element.getAttribute('aria-label')?.toLowerCase() ||
                element.value?.toLowerCase() ||
                element.placeholder?.toLowerCase() ||
                element.title?.toLowerCase();

            if (elementText && elementText.includes(elementType.toLowerCase())) {
                console.log('Found matching element:', element);
                element.click();
                this.showClickFeedback(element);
                return true;
            }
        }

        console.log('No matching element found for:', elementType);
        return false;
    }

    showClickFeedback(element) {
        const originalStyle = element.style.cssText;

        // Add visual feedback
        element.style.transition = 'all 0.3s ease';
        element.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.5)';
        element.style.transform = 'scale(1.05)';

        // Remove feedback after animation
        setTimeout(() => {
            element.style.cssText = originalStyle;
        }, 500);
    }

    pauseMedia() {
        console.log('Pausing media elements');

        // Pause video elements
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (!video.paused) {
                video.pause();
                console.log('Paused video element');
            }
        });

        // Pause audio elements
        const audios = document.querySelectorAll('audio');
        audios.forEach(audio => {
            if (!audio.paused) {
                audio.pause();
                console.log('Paused audio element');
            }
        });

        // Try to pause YouTube videos
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                if (iframe.src.includes('youtube.com') || iframe.src.includes('youtu.be')) {
                    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    console.log('Sent pause command to YouTube iframe');
                }
            } catch (error) {
                console.log('Could not pause iframe:', error);
            }
        });
    }

    showVoiceIndicator() {
        this.hideVoiceIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'vani-voice-indicator';
        indicator.innerHTML = '🎤';
        indicator.id = 'vani-voice-indicator';
        indicator.title = 'Vani is listening';

        document.body.appendChild(indicator);
    }

    hideVoiceIndicator() {
        const existingIndicator = document.getElementById('vani-voice-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    }

    scrollPage(direction) {
        const amount = direction === 'up' ? -300 : 300;
        window.scrollBy({
            top: amount,
            behavior: 'smooth'
        });
        console.log(`Scrolling ${direction} by ${amount}px`);
    }

    // Utility method to find elements by text content
    findElementByText(text, tagName = '*') {
        const elements = document.querySelectorAll(tagName);
        return Array.from(elements).find(el =>
            el.textContent.toLowerCase().includes(text.toLowerCase())
        );
    }

    // Method to simulate user interactions
    simulateClick(element) {
        if (element) {
            element.click();
            return true;
        }
        return false;
    }

    // Method to get page metadata for better context
    getPageMetadata() {
        return {
            title: document.title,
            url: window.location.href,
            description: document.querySelector('meta[name="description"]')?.content || '',
            keywords: document.querySelector('meta[name="keywords"]')?.content || '',
            contentType: this.determineContentType()
        };
    }

    determineContentType() {
        if (document.querySelector('article')) return 'article';
        if (document.querySelector('video')) return 'video';
        if (document.querySelector('audio')) return 'audio';
        if (window.location.hostname.includes('youtube.com')) return 'video';
        if (window.location.hostname.includes('spotify.com')) return 'audio';
        if (document.querySelector('form')) return 'form';
        return 'webpage';
    }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ContentScript();
    });
} else {
    new ContentScript();
}

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentScript;
}