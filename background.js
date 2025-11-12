// Configuration
const CONFIG = {
    GEMINI_API_KEY: 'AIzaSyA43kk0BenDNSNrVUbGn89p_kBYuAJA3II', // You need to get this from Google AI Studio
    WAKE_WORD: 'hey vani',
    COMMAND_HISTORY_SIZE: 100,
    DEFAULT_VOICE_RATE: 1.0,
    DEFAULT_VOICE_PITCH: 1.0,
    CONTINUOUS_LISTENING_TIMEOUT: 10000 // 10 seconds
};

class VoiceAssistant {
    constructor() {
        this.isWakeWordEnabled = false;
        this.isContinuousListening = false;
        this.commandHistory = [];
        this.settings = {};
        this.init();
    }

    async init() {
        console.log('Vani Voice Assistant Initializing...');
        await this.loadSettings();
        this.setupMessageListeners();
        console.log('Vani Voice Assistant Initialized');
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Background received message:', request.type);

            try {
                switch (request.type) {
                    case 'VOICE_COMMAND':
                        this.processVoiceCommand(request.command);
                        sendResponse({ success: true });
                        break;
                    case 'TOGGLE_WAKE_WORD':
                        this.handleWakeWordToggle(request.enabled);
                        sendResponse({ success: true });
                        break;
                    case 'TOGGLE_CONTINUOUS_LISTENING':
                        this.handleContinuousListeningToggle(request.enabled);
                        sendResponse({ success: true });
                        break;
                    case 'GET_COMMAND_HISTORY':
                        sendResponse({ history: this.commandHistory });
                        break;
                    case 'CLEAR_HISTORY':
                        this.clearCommandHistory();
                        sendResponse({ success: true });
                        break;
                    case 'UPDATE_SETTINGS':
                        this.updateSettings(request.settings);
                        sendResponse({ success: true });
                        break;
                    case 'ADD_CUSTOM_COMMAND':
                        this.addCustomCommand(request.command, request.action);
                        sendResponse({ success: true });
                        break;
                    case 'GET_CUSTOM_COMMANDS':
                        this.getCustomCommands(sendResponse);
                        break;
                    case 'DELETE_CUSTOM_COMMAND':
                        this.deleteCustomCommand(request.command);
                        sendResponse({ success: true });
                        break;
                    case 'PROCESS_WITH_GEMINI':
                        this.processWithGemini(request.text, request.context).then(sendResponse);
                        return true; // Async response
                    case 'PING':
                        sendResponse({ status: 'alive' });
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

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['settings', 'commandHistory', 'customCommands'], (result) => {
                this.settings = result.settings || this.getDefaultSettings();
                this.commandHistory = result.commandHistory || [];
                this.customCommands = result.customCommands || {};
                console.log('Settings loaded successfully');
                resolve();
            });
        });
    }

    getDefaultSettings() {
        return {
            wakeWordEnabled: false,
            continuousListening: false,
            voiceRate: CONFIG.DEFAULT_VOICE_RATE,
            voicePitch: CONFIG.DEFAULT_VOICE_PITCH,
            autoRead: false,
            useGemini: true
        };
    }

    handleWakeWordToggle(enabled) {
        console.log('Wake word toggle:', enabled);
        this.isWakeWordEnabled = enabled;
        this.settings.wakeWordEnabled = enabled;
        this.saveSettings();
        
        // Note: Speech recognition is handled in popup.js
        chrome.runtime.sendMessage({ type: 'WAKE_WORD_TOGGLE', enabled: enabled }).catch(() => {
            // Popup might not be open, ignore error
        });
    }

    handleContinuousListeningToggle(enabled) {
        console.log('Continuous listening toggle:', enabled);
        this.isContinuousListening = enabled;
        this.settings.continuousListening = enabled;
        this.saveSettings();
        
        // Note: Speech recognition is handled in popup.js
        chrome.runtime.sendMessage({ type: 'CONTINUOUS_LISTENING_TOGGLE', enabled: enabled }).catch(() => {
            // Popup might not be open, ignore error
        });
    }

    // Speech recognition methods have been moved to popup.js
    // Service Workers do not have access to window APIs like webkitSpeechRecognition

    async processVoiceCommand(command) {
        console.log('Processing voice command:', command);
        this.addToCommandHistory(command, 'Processing...', true);

        try {
            // Try custom commands first
            const customResult = await this.checkCustomCommands(command);
            if (customResult) return;

            // Try built-in commands
            const builtInResult = await this.checkBuiltInCommands(command);
            if (builtInResult) return;

            // Use Gemini for Hinglish and natural language understanding
            await this.processWithAI(command);

        } catch (error) {
            console.error('Error processing command:', error);
            this.speakFeedback(`Sorry, I encountered an error: ${error.message}`);
            this.addToCommandHistory(command, `Error: ${error.message}`, false);
        }
    }

    async checkCustomCommands(command) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['customCommands'], (result) => {
                const customCommands = result.customCommands || {};
                const lowerCommand = command.toLowerCase();

                for (const [trigger, action] of Object.entries(customCommands)) {
                    if (lowerCommand.includes(trigger.toLowerCase())) {
                        console.log('Custom command matched:', trigger);
                        this.executeCustomCommand(action, command);
                        resolve(true);
                        return;
                    }
                }
                resolve(false);
            });
        });
    }

    async checkBuiltInCommands(command) {
        const lowerCommand = command.toLowerCase();

        // Enhanced command patterns with Hinglish support
        const commandPatterns = {
            // Music & Media
            'play|gaana chalao|music play': (query) => this.playMusic(query),
            'pause music|music band karo': () => this.pauseMedia(),

            // Tab Management
            'new tab|naya tab kholo': () => this.createNewTab(),
            'close tab|tab band karo': () => this.closeCurrentTab(),
            'next tab|agla tab': () => this.switchToNextTab(),
            'previous tab|pichla tab': () => this.switchToPreviousTab(),
            'switch tab|tab badlo': (query) => this.switchToTab(query),

            // Navigation
            'go back|pichhe jao|back jao': () => this.goBack(),
            'go forward|aage jao|forward jao': () => this.goForward(),
            'refresh page|page refresh karo': () => this.refreshPage(),
            'home page|home jao': () => this.goHome(),

            // Scrolling
            'scroll up|upar scroll karo': () => this.scrollPage(-300),
            'scroll down|neeche scroll karo': () => this.scrollPage(300),
            'scroll to top|top par jao': () => this.scrollToTop(),
            'scroll to bottom|bottom par jao': () => this.scrollToBottom(),

            // Content Interaction
            'read page|page padho': () => this.readPageContent(),
            'read selected|chuna hua padho': () => this.readSelectedText(),
            'summarize page|page ka summary do': () => this.summarizePage(),
            'highlight|highlight karo': (text) => this.highlightText(text),

            // Search
            'search|search karo|khojo': (query) => this.searchWeb(query),
            'google par search karo': (query) => this.searchWeb(query),

            // Information
            'what time|time kya hai|samay kya hai': () => this.speakTime(),
            'what date|date kya hai|aaj kya date hai': () => this.speakDate(),

            // Control
            'stop|band karo|ruk jao': () => this.stopSpeaking(),
            'mute|sound band karo': () => this.muteTab(),
            'unmute|sound chalu karo': () => this.unmuteTab()
        };

        for (const [pattern, action] of Object.entries(commandPatterns)) {
            const patterns = pattern.split('|');
            for (const pat of patterns) {
                if (lowerCommand.includes(pat)) {
                    const query = command.replace(new RegExp(pat, 'i'), '').trim();
                    await action(query);
                    return true;
                }
            }
        }

        // Dynamic commands
        if (lowerCommand.startsWith('open ')) {
            const site = command.substring(5).trim();
            this.openWebsite(site);
            return true;
        }

        if (lowerCommand.startsWith('click ')) {
            const element = command.substring(6).trim();
            this.clickElement(element);
            return true;
        }

        return false;
    }

    async processWithAI(command) {
        if (!this.settings.useGemini || !CONFIG.GEMINI_API_KEY) {
            // Fallback to basic pattern matching
            await this.processNaturalLanguage(command);
            return;
        }

        try {
            const response = await this.callGeminiAPI(`
                Analyze this voice command and determine the intent. 
                Command: "${command}"
                
                Possible intents:
                - play_music [query]
                - search_web [query]
                - open_website [url]
                - navigate [direction]
                - scroll [direction]
                - read_content
                - summarize
                - get_info
                - control
                - unknown
                
                Respond in JSON format: {"intent": "intent_name", "query": "extracted_query", "confidence": 0.9}
            `);

            const result = JSON.parse(response);
            console.log('AI Analysis Result:', result);

            if (result.confidence > 0.7) {
                await this.executeAICommand(result.intent, result.query, command);
            } else {
                await this.processNaturalLanguage(command);
            }
        } catch (error) {
            console.error('AI processing failed:', error);
            await this.processNaturalLanguage(command);
        }
    }

    async executeAICommand(intent, query, originalCommand) {
        switch (intent) {
            case 'play_music':
                this.playMusic(query || 'music');
                break;
            case 'search_web':
                this.searchWeb(query || originalCommand);
                break;
            case 'open_website':
                this.openWebsite(query || originalCommand.replace(/open\s+/i, ''));
                break;
            case 'navigate':
                if (query.includes('back') || query.includes('pichhe')) {
                    this.goBack();
                } else if (query.includes('forward') || query.includes('aage')) {
                    this.goForward();
                }
                break;
            case 'scroll':
                if (query.includes('up') || query.includes('upar')) {
                    this.scrollPage(-300);
                } else if (query.includes('down') || query.includes('neeche')) {
                    this.scrollPage(300);
                }
                break;
            case 'read_content':
                this.readPageContent();
                break;
            case 'summarize':
                this.summarizePage();
                break;
            case 'get_info':
                if (query.includes('time') || query.includes('samay')) {
                    this.speakTime();
                } else if (query.includes('date') || query.includes('taarikh')) {
                    this.speakDate();
                }
                break;
            default:
                this.speakFeedback(`I'm not sure how to handle: "${originalCommand}"`);
                this.addToCommandHistory(originalCommand, 'Command not understood', false);
        }
    }

    async processNaturalLanguage(command) {
        const lowerCommand = command.toLowerCase();

        // Enhanced Hinglish patterns
        const patterns = {
            'kya hal hai|kaise ho|how are you': () =>
                this.speakFeedback('Main theek hoon, dhanyavad! Aap kaise hain? Main aapki kya madad kar sakti hoon?'),

            'shukriya|thank you|dhanyavad|thanks': () =>
                this.speakFeedback('Koi baat nahin! Main aapki aur madad kar sakti hoon?'),

            'band karo|stop karo|ruk jao': () =>
                this.stopSpeaking(),

            'volume badhao|sound badhao': () =>
                this.increaseVolume(),

            'volume kam karo|sound kam karo': () =>
                this.decreaseVolume(),

            'screenshot lo|screen capture karo': () =>
                this.takeScreenshot(),

            'bookmark save karo|bookmark banao': () =>
                this.bookmarkCurrentPage(),

            'history dikhao|command history dikhao': () =>
                this.showCommandHistory(),

            'weather kaisa hai|mausam kaisa hai': () =>
                this.speakFeedback('Mujhe abhi weather ki jaankari nahin de sakti, lekin aap search kar sakte hain weather ke bare mein.'),

            'mera naam kya hai|what is my name': () =>
                this.speakFeedback('Mujhe aapka naam nahin pata, lekin aap ek smart user lagte hain!')
        };

        for (const [pattern, action] of Object.entries(patterns)) {
            if (new RegExp(pattern, 'i').test(command)) {
                await action();
                this.addToCommandHistory(command, 'Processed natural language command', true);
                return;
            }
        }

        // Default fallback
        this.speakFeedback(`Mujhe samajh nahin aaya: "${command}". Kya aap ise alag shabdon mein keh sakte hain? Ya "help" bolo available commands ke liye.`);
        this.addToCommandHistory(command, 'Command not understood', false);
    }

    // Enhanced command implementations
    playMusic(query) {
        if (!query) {
            this.openWebsite('https://youtube.com');
            this.speakFeedback('YouTube khol raha hoon');
        } else {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            chrome.tabs.create({ url: searchUrl });
            this.speakFeedback(`YouTube par ${query} search kar raha hoon`);
        }
        this.addToCommandHistory(`play ${query}`, 'Playing music', true);
    }

    createNewTab(url = 'https://www.google.com') {
        chrome.tabs.create({ url });
        this.speakFeedback('Naya tab khol raha hoon');
    }

    closeCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && !tabs[0].pinned) {
                chrome.tabs.remove(tabs[0].id);
                this.speakFeedback('Tab band kar diya');
            } else {
                this.speakFeedback('Yeh tab band nahin ho sakta');
            }
        });
    }

    switchToNextTab() {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (current) => {
                if (current[0]) {
                    const currentIndex = tabs.findIndex(tab => tab.id === current[0].id);
                    const nextIndex = (currentIndex + 1) % tabs.length;
                    chrome.tabs.update(tabs[nextIndex].id, { active: true });
                    this.speakFeedback('Agla tab khol raha hoon');
                }
            });
        });
    }

    switchToPreviousTab() {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (current) => {
                if (current[0]) {
                    const currentIndex = tabs.findIndex(tab => tab.id === current[0].id);
                    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    chrome.tabs.update(tabs[prevIndex].id, { active: true });
                    this.speakFeedback('Pichla tab khol raha hoon');
                }
            });
        });
    }

    async switchToTab(query) {
        return new Promise((resolve) => {
            chrome.tabs.query({}, (tabs) => {
                const matchingTab = tabs.find(tab =>
                    tab.title.toLowerCase().includes(query.toLowerCase()) ||
                    tab.url.toLowerCase().includes(query.toLowerCase())
                );

                if (matchingTab) {
                    chrome.tabs.update(matchingTab.id, { active: true });
                    this.speakFeedback(`${matchingTab.title} tab par ja raha hoon`);
                } else {
                    this.speakFeedback(`${query} wala tab nahin mila`);
                }
                resolve();
            });
        });
    }

    goBack() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.goBack(tabs[0].id);
                this.speakFeedback('Pichhe ja raha hoon');
            }
        });
    }

    goForward() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.goForward(tabs[0].id);
                this.speakFeedback('Aage ja raha hoon');
            }
        });
    }

    goHome() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.update(tabs[0].id, { url: 'https://www.google.com' });
                this.speakFeedback('Home page par ja raha hoon');
            }
        });
    }

    scrollPage(amount) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (scrollAmount) => {
                        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                    },
                    args: [amount]
                });
            }
        });
    }

    scrollToTop() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            }
        });
        this.speakFeedback('Top par scroll kar raha hoon');
    }

    scrollToBottom() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }
                });
            }
        });
        this.speakFeedback('Bottom par scroll kar raha hoon');
    }

    readPageContent() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'READ_PAGE_CONTENT' });
            }
        });
        this.speakFeedback('Page content padh raha hoon');
    }

    readSelectedText() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'READ_SELECTED_TEXT' });
            }
        });
    }

    async summarizePage() {
        if (!this.settings.useGemini || !CONFIG.GEMINI_API_KEY) {
            this.speakFeedback('Page summary feature requires Gemini API. Please enable AI features in settings.');
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTENT' }, async (response) => {
                    if (response && response.content) {
                        try {
                            const summary = await this.callGeminiAPI(`
                                Summarize the following webpage content in 2-3 sentences in Hinglish (Hindi-English mix):
                                ${response.content.substring(0, 3000)}
                            `);
                            this.speakFeedback(`Page summary: ${summary}`);
                            this.addToCommandHistory('summarize page', 'Generated page summary', true);
                        } catch (error) {
                            this.speakFeedback('Summary generate karne mein error aaya');
                        }
                    }
                });
            }
        });
    }

    highlightText(text) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'HIGHLIGHT_TEXT',
                    text: text
                });
            }
        });
        this.speakFeedback(`${text} highlight kar raha hoon`);
    }

    searchWeb(query) {
        if (!query) {
            this.openWebsite('https://google.com');
            this.speakFeedback('Google khol raha hoon');
        } else {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            chrome.tabs.create({ url: searchUrl });
            this.speakFeedback(`Google par ${query} search kar raha hoon`);
        }
    }

    openWebsite(url) {
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        chrome.tabs.create({ url });
        this.speakFeedback(`${url.replace('https://', '')} khol raha hoon`);
    }

    clickElement(elementType) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'CLICK_ELEMENT',
                    element: elementType
                });
            }
        });
    }

    refreshPage() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
        this.speakFeedback('Page refresh kar raha hoon');
    }

    speakTime() {
        const time = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        this.speakFeedback(`Samay hai ${time}`);
    }

    speakDate() {
        const date = new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        this.speakFeedback(`Aaj ki date hai ${date}`);
    }

    muteTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.update(tabs[0].id, { muted: true });
                this.speakFeedback('Tab mute kar diya');
            }
        });
    }

    unmuteTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.update(tabs[0].id, { muted: false });
                this.speakFeedback('Tab unmute kar diya');
            }
        });
    }

    stopSpeaking() {
        chrome.tts.stop();
        this.speakFeedback('Bolna band kar diya');
    }

    // Gemini AI Integration
    async callGeminiAPI(prompt) {
        if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
            throw new Error('Gemini API key not configured');
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async processWithGemini(text, context) {
        try {
            const response = await this.callGeminiAPI(`
                Context: ${context}
                Text: ${text}
                
                Process this text and provide appropriate response or action analysis.
            `);
            return { success: true, response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Custom Commands Management
    addCustomCommand(trigger, action) {
        this.customCommands[trigger.toLowerCase()] = action;
        chrome.storage.local.set({ customCommands: this.customCommands });
        this.speakFeedback(`Custom command "${trigger}" add kar diya`);
    }

    getCustomCommands(callback) {
        callback({ commands: this.customCommands });
    }

    deleteCustomCommand(trigger) {
        delete this.customCommands[trigger.toLowerCase()];
        chrome.storage.local.set({ customCommands: this.customCommands });
        this.speakFeedback(`Custom command "${trigger}" delete kar diya`);
    }

    executeCustomCommand(action, originalCommand) {
        if (action.startsWith('http')) {
            this.openWebsite(action);
        } else {
            this.processVoiceCommand(action);
        }
        this.addToCommandHistory(originalCommand, 'Executed custom command', true);
    }

    // Utility methods
    speakFeedback(text) {
        chrome.tts.speak(text, {
            rate: this.settings.voiceRate || CONFIG.DEFAULT_VOICE_RATE,
            pitch: this.settings.voicePitch || CONFIG.DEFAULT_VOICE_PITCH,
            volume: 1.0,
            lang: 'en-IN'
        });
    }

    addToCommandHistory(command, response, success) {
        const entry = {
            command: command,
            response: response,
            success: success,
            timestamp: new Date().toISOString()
        };

        this.commandHistory.push(entry);

        if (this.commandHistory.length > CONFIG.COMMAND_HISTORY_SIZE) {
            this.commandHistory = this.commandHistory.slice(-CONFIG.COMMAND_HISTORY_SIZE);
        }

        this.saveCommandHistory();
    }

    saveCommandHistory() {
        chrome.storage.local.set({ commandHistory: this.commandHistory });
    }

    saveSettings() {
        chrome.storage.local.set({ settings: this.settings });
    }

    clearCommandHistory() {
        this.commandHistory = [];
        this.saveCommandHistory();
        this.speakFeedback('Command history clear kar diya');
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    showCommandHistory() {
        chrome.runtime.sendMessage({ type: 'SHOW_HISTORY' });
    }

    increaseVolume() {
        this.speakFeedback('Volume increase feature coming soon');
    }

    decreaseVolume() {
        this.speakFeedback('Volume decrease feature coming soon');
    }

    takeScreenshot() {
        this.speakFeedback('Screenshot feature coming soon');
    }

    bookmarkCurrentPage() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.bookmarks.create({
                    title: tabs[0].title,
                    url: tabs[0].url
                });
                this.speakFeedback('Page bookmark kar diya');
            }
        });
    }

    pauseMedia() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'PAUSE_MEDIA' });
            }
        });
        this.speakFeedback('Media pause kar diya');
    }
}

// Initialize the assistant
const assistant = new VoiceAssistant();

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Vani Voice Assistant extension installed');

    chrome.storage.local.set({
        settings: {
            wakeWordEnabled: false,
            continuousListening: false,
            voiceRate: CONFIG.DEFAULT_VOICE_RATE,
            voicePitch: CONFIG.DEFAULT_VOICE_PITCH,
            autoRead: false,
            useGemini: true
        },
        commandHistory: [],
        customCommands: {}
    });
});