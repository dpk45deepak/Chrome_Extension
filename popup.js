class VaniPopup {
    constructor() {
        this.isListening = false;
        this.isContinuousListeningMode = false;
        this.recognition = null;
        this.settings = {};
        this.customCommands = {};
        this.init();
    }

    async init() {
        console.log('Vani Popup Initializing...');
        await this.loadSettings();
        await this.loadCustomCommands();
        this.setupEventListeners();
        this.initSpeechRecognition();
        this.updateUI();
        console.log('Vani Popup Initialized');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        const voiceOrb = document.getElementById('voice-orb');
        if (!voiceOrb) {
            console.error('Voice orb element not found!');
            return;
        }

        // Voice orb interactions
        voiceOrb.addEventListener('mousedown', (e) => this.startListening(e));
        voiceOrb.addEventListener('mouseup', (e) => this.stopListening(e));
        voiceOrb.addEventListener('mouseleave', (e) => this.stopListening(e));
        voiceOrb.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startListening(e);
        });
        voiceOrb.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopListening(e);
        });

        // Quick commands
        document.querySelectorAll('.quick-command').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.getAttribute('data-command');
                console.log('Quick command clicked:', command);
                this.executeQuickCommand(command);
            });
        });

        // Control buttons
        const historyBtn = document.getElementById('history-btn');
        const customCmdBtn = document.getElementById('custom-cmd-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const helpBtn = document.getElementById('help-btn');
        
        if (historyBtn) historyBtn.addEventListener('click', () => this.showHistory());
        if (customCmdBtn) customCmdBtn.addEventListener('click', () => this.showCustomCommands());
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettings());
        if (helpBtn) helpBtn.addEventListener('click', () => this.showHelp());

        // Modal controls
        const closeSettings = document.getElementById('close-settings');
        const closeHistory = document.getElementById('close-history');
        const closeCustomCommands = document.getElementById('close-custom-commands');
        const clearHistoryBtn = document.getElementById('clear-history');
        const addCommandBtn = document.getElementById('add-command-btn');
        const saveCommandBtn = document.getElementById('save-command');
        
        if (closeSettings) closeSettings.addEventListener('click', () => this.hideSettings());
        if (closeHistory) closeHistory.addEventListener('click', () => this.hideHistory());
        if (closeCustomCommands) closeCustomCommands.addEventListener('click', () => this.hideCustomCommands());
        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        if (addCommandBtn) addCommandBtn.addEventListener('click', () => this.showAddCommandForm());
        if (saveCommandBtn) saveCommandBtn.addEventListener('click', () => this.saveCustomCommand());

        // Settings controls
        const wakeWordToggle = document.getElementById('wake-word-toggle');
        const continuousToggle = document.getElementById('continuous-toggle');
        const geminiToggle = document.getElementById('gemini-toggle');
        const voiceRate = document.getElementById('voice-rate');
        const voicePitch = document.getElementById('voice-pitch');
        const geminiApiKey = document.getElementById('gemini-api-key');
        
        if (wakeWordToggle) wakeWordToggle.addEventListener('change', (e) => this.toggleWakeWord(e.target.checked));
        if (continuousToggle) continuousToggle.addEventListener('change', (e) => this.toggleContinuousListening(e.target.checked));
        if (geminiToggle) geminiToggle.addEventListener('change', (e) => this.toggleGemini(e.target.checked));
        if (voiceRate) voiceRate.addEventListener('input', (e) => this.updateVoiceRate(e.target.value));
        if (voicePitch) voicePitch.addEventListener('input', (e) => this.updateVoicePitch(e.target.value));
        if (geminiApiKey) geminiApiKey.addEventListener('change', (e) => this.updateGeminiApiKey(e.target.value));

        // Note: Modals no longer close when clicking outside
        // User must click the X button to close modals
        // This keeps the popup window open and prevents accidental closes

        console.log('Event listeners setup complete');
    }

    initSpeechRecognition() {
        console.log('Initializing speech recognition...');

        if (!('webkitSpeechRecognition' in window)) {
            console.error('Speech Recognition API not supported in this browser');
            this.updateStatus('Speech recognition not supported in this browser', 'error');
            this.disableVoiceInterface();
            return;
        }

        try {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                console.log('Speech recognition started');
                this.isListening = true;
                this.updateListeningUI(true);
                this.startVisualization();
            };

            this.recognition.onresult = (event) => {
                console.log('Speech recognition result received');
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (interimTranscript) {
                    console.log('Interim transcript:', interimTranscript);
                    this.updateStatus(`Listening: ${interimTranscript}`, 'info');
                }

                if (finalTranscript) {
                    console.log('Final transcript:', finalTranscript);
                    this.updateStatus(`Heard: ${finalTranscript}`, 'success');
                    this.processCommand(finalTranscript);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.updateStatus(`Error: ${this.getErrorDescription(event.error)}`, 'error');
                this.stopListening();
            };

            this.recognition.onend = () => {
                console.log('Speech recognition ended');
                this.isListening = false;
                this.updateListeningUI(false);
                this.stopVisualization();
                
                // Handle continuous listening restart
                this.handleContinuousListeningEnd();
            };

            console.log('Speech recognition initialized successfully');
        } catch (error) {
            console.error('Error initializing speech recognition:', error);
            this.updateStatus('Error initializing speech recognition', 'error');
            this.disableVoiceInterface();
        }
    }

    getErrorDescription(error) {
        const errorMap = {
            'no-speech': 'No speech was detected',
            'audio-capture': 'No microphone was found',
            'not-allowed': 'Permission to use microphone was denied',
            'network': 'Network error occurred',
            'aborted': 'Listening was aborted',
            'bad-grammar': 'Speech grammar error',
            'language-not-supported': 'Language not supported'
        };
        return errorMap[error] || `Unknown error: ${error}`;
    }

    disableVoiceInterface() {
        const voiceOrb = document.getElementById('voice-orb');
        if (voiceOrb) {
            voiceOrb.style.opacity = '0.5';
            voiceOrb.style.cursor = 'not-allowed';
            voiceOrb.style.pointerEvents = 'none';
        }
    }

    startListening(e) {
        e.preventDefault();
        console.log('Start listening triggered');

        if (!this.recognition) {
            console.error('Speech recognition not initialized');
            this.updateStatus('Speech recognition not available', 'error');
            return;
        }

        if (this.isListening) {
            console.log('Already listening, ignoring start request');
            return;
        }

        try {
            this.recognition.start();
            this.createRippleEffect(e);
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.updateStatus('Error starting voice recognition', 'error');
        }
    }

    stopListening(e) {
        if (e) e.preventDefault();
        console.log('Stop listening triggered');

        if (this.isListening && this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
        }
        this.updateListeningUI(false);
        this.stopVisualization();
    }

    updateListeningUI(listening) {
        const voiceOrb = document.getElementById('voice-orb');
        const instructionText = document.getElementById('instruction-text');

        if (listening) {
            voiceOrb.classList.add('listening');
            instructionText.textContent = 'Listening... Speak now';
            this.updateStatus('', 'info');
        } else {
            voiceOrb.classList.remove('listening');
            instructionText.textContent = 'Tap and hold to speak';
            this.updateStatus('Ready to help with your commands', 'info');
        }
    }

    startVisualization() {
        const bars = document.querySelectorAll('.visualization-bars .bar');
        bars.forEach(bar => {
            bar.style.animation = 'bar-pulse 0.5s ease-in-out infinite alternate';
        });
    }

    stopVisualization() {
        const bars = document.querySelectorAll('.visualization-bars .bar');
        bars.forEach(bar => {
            bar.style.animation = 'none';
        });
    }

    createRippleEffect(e) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple-effect';

        const rect = e.currentTarget.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        e.currentTarget.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.remove();
            }
        }, 600);
    }

    processCommand(command) {
        const trimmedCommand = command.trim();
        console.log('Processing command:', trimmedCommand);
        this.updateStatus(`Executing: ${trimmedCommand}`, 'success');

        // Send command to background script
        chrome.runtime.sendMessage({
            type: 'VOICE_COMMAND',
            command: trimmedCommand
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message to background:', chrome.runtime.lastError);
                this.updateStatus('Error communicating with extension', 'error');
            } else {
                console.log('Command sent to background successfully');
            }
        });

        // Refresh history after a delay
        setTimeout(() => this.loadCommandHistory(), 1000);
    }

    executeQuickCommand(command) {
        console.log('Executing quick command:', command);
        this.updateStatus(`Quick command: ${command}`, 'info');
        this.processCommand(command);
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['settings'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Error loading settings:', chrome.runtime.lastError);
                    this.settings = this.getDefaultSettings();
                } else {
                    this.settings = result.settings || this.getDefaultSettings();
                    console.log('Settings loaded:', this.settings);
                }
                this.updateSettingsUI();
                resolve();
            });
        });
    }

    getDefaultSettings() {
        return {
            wakeWordEnabled: false,
            continuousListening: false,
            voiceRate: 1.0,
            voicePitch: 1.0,
            useGemini: true,
            geminiApiKey: ''
        };
    }

    updateSettingsUI() {
        // Update toggle switches
        const wakeWordToggle = document.getElementById('wake-word-toggle');
        const continuousToggle = document.getElementById('continuous-toggle');
        const geminiToggle = document.getElementById('gemini-toggle');
        
        if (wakeWordToggle) wakeWordToggle.checked = this.settings.wakeWordEnabled || false;
        if (continuousToggle) continuousToggle.checked = this.settings.continuousListening || false;
        if (geminiToggle) geminiToggle.checked = this.settings.useGemini || false;

        // Update sliders
        const voiceRate = document.getElementById('voice-rate');
        const voicePitch = document.getElementById('voice-pitch');
        const voiceRateValue = document.getElementById('voice-rate-value');
        const voicePitchValue = document.getElementById('voice-pitch-value');
        
        if (voiceRate) voiceRate.value = this.settings.voiceRate || 1.0;
        if (voicePitch) voicePitch.value = this.settings.voicePitch || 1.0;
        if (voiceRateValue) voiceRateValue.textContent = this.settings.voiceRate || 1.0;
        if (voicePitchValue) voicePitchValue.textContent = this.settings.voicePitch || 1.0;

        // Update API key
        const geminiApiKey = document.getElementById('gemini-api-key');
        if (geminiApiKey) geminiApiKey.value = this.settings.geminiApiKey || '';

        // Update status indicators
        document.getElementById('wake-word-dot').classList.toggle('active', this.settings.wakeWordEnabled);
        document.getElementById('continuous-dot').classList.toggle('active', this.settings.continuousListening);

        document.getElementById('wake-word-text').textContent = this.settings.wakeWordEnabled ? 'Wake Word On' : 'Wake Word Off';
        document.getElementById('continuous-text').textContent = this.settings.continuousListening ? 'Continuous On' : 'Continuous Off';
    }

    toggleWakeWord(enabled) {
        console.log('Toggling wake word:', enabled);
        this.settings.wakeWordEnabled = enabled;
        this.saveSettings();

        chrome.runtime.sendMessage({
            type: 'TOGGLE_WAKE_WORD',
            enabled: enabled
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error toggling wake word:', chrome.runtime.lastError);
            } else {
                console.log('Wake word toggled successfully');
            }
        });

        this.updateSettingsUI();
    }

    toggleContinuousListening(enabled) {
        console.log('Toggling continuous listening:', enabled);
        this.settings.continuousListening = enabled;
        this.saveSettings();

        if (enabled) {
            this.startContinuousListening();
        } else {
            this.stopContinuousListening();
        }

        chrome.runtime.sendMessage({
            type: 'TOGGLE_CONTINUOUS_LISTENING',
            enabled: enabled
        }).catch(() => {
            // Background might not respond
        });

        this.updateSettingsUI();
    }

    startContinuousListening() {
        console.log('Starting continuous listening');
        if (!this.recognition) {
            console.error('Speech recognition not initialized');
            this.updateStatus('Speech recognition not available', 'error');
            return;
        }

        this.isContinuousListeningMode = true;
        this.startContinuousListeningSession();
    }

    stopContinuousListening() {
        console.log('Stopping continuous listening');
        this.isContinuousListeningMode = false;
        
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        
        this.updateListeningUI(false);
        this.updateStatus('Continuous listening stopped', 'info');
    }

    startContinuousListeningSession() {
        if (!this.isContinuousListeningMode) return;
        
        if (this.isListening) {
            console.log('Already listening, waiting...');
            return;
        }

        console.log('Starting continuous listening session');
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting continuous listening:', error);
            if (error.message.includes('already started')) {
                // Recognition already started, will handle in onend
            }
        }
    }

    handleContinuousListeningEnd() {
        console.log('Continuous listening session ended');
        
        if (this.isContinuousListeningMode) {
            // Restart after a short delay
            console.log('Restarting continuous listening...');
            setTimeout(() => {
                this.startContinuousListeningSession();
            }, 500);
        }
    }

    toggleGemini(enabled) {
        console.log('Toggling Gemini AI:', enabled);
        this.settings.useGemini = enabled;
        this.saveSettings();
        this.updateSettingsUI();
    }

    updateVoiceRate(rate) {
        this.settings.voiceRate = parseFloat(rate);
        const voiceRateValue = document.getElementById('voice-rate-value');
        if (voiceRateValue) voiceRateValue.textContent = rate;
        this.saveSettings();

        chrome.runtime.sendMessage({
            type: 'UPDATE_SETTINGS',
            settings: { voiceRate: this.settings.voiceRate }
        });
    }

    updateVoicePitch(pitch) {
        this.settings.voicePitch = parseFloat(pitch);
        const voicePitchValue = document.getElementById('voice-pitch-value');
        if (voicePitchValue) voicePitchValue.textContent = pitch;
        this.saveSettings();

        chrome.runtime.sendMessage({
            type: 'UPDATE_SETTINGS',
            settings: { voicePitch: this.settings.voicePitch }
        });
    }

    updateGeminiApiKey(apiKey) {
        this.settings.geminiApiKey = apiKey;
        this.saveSettings();

        // Also update in background script
        chrome.runtime.sendMessage({
            type: 'UPDATE_SETTINGS',
            settings: { geminiApiKey: apiKey }
        });
    }

    saveSettings() {
        chrome.storage.local.set({ settings: this.settings }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving settings:', chrome.runtime.lastError);
            } else {
                console.log('Settings saved successfully');
            }
        });
    }

    async loadCustomCommands() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_CUSTOM_COMMANDS' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error loading custom commands:', chrome.runtime.lastError);
                    this.customCommands = {};
                } else {
                    this.customCommands = response.commands || {};
                    console.log('Custom commands loaded:', Object.keys(this.customCommands).length);
                }
                resolve();
            });
        });
    }

    async loadCommandHistory() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_COMMAND_HISTORY' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error loading command history:', chrome.runtime.lastError);
                    this.displayCommandHistory([]);
                } else {
                    const history = response?.history || [];
                    console.log('Loaded command history:', history.length, 'items');
                    this.displayCommandHistory(history);
                }
                resolve();
            });
        });
    }

    displayCommandHistory(history) {
        const historyList = document.getElementById('command-history-list');

        if (!historyList) {
            console.error('History list element not found');
            return;
        }

        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-history">No commands yet. Start by using voice commands!</div>';
            return;
        }

        historyList.innerHTML = history.slice(-15).reverse().map(item => `
            <div class="history-item ${item.success ? 'success' : 'error'}">
                <div class="history-command">"${this.escapeHtml(item.command)}"</div>
                <div class="history-response">${this.escapeHtml(item.response)}</div>
                <div class="history-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
    }

    displayCustomCommands() {
        const commandsList = document.getElementById('custom-commands-list');

        if (!commandsList) {
            console.error('Custom commands list element not found');
            return;
        }

        const commands = Object.entries(this.customCommands);

        if (commands.length === 0) {
            commandsList.innerHTML = '<div class="empty-history">No custom commands yet. Add your first command!</div>';
            return;
        }

        commandsList.innerHTML = commands.map(([trigger, action]) => `
            <div class="custom-command-item">
                <div class="command-details">
                    <strong>"${this.escapeHtml(trigger)}"</strong>
                    <span>→ ${this.escapeHtml(action)}</span>
                </div>
                <button class="delete-command" data-trigger="${this.escapeHtml(trigger)}" title="Delete Command">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // Add event listeners to delete buttons
        commandsList.querySelectorAll('.delete-command').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trigger = e.target.closest('.delete-command').getAttribute('data-trigger');
                this.deleteCustomCommand(trigger);
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearHistory() {
        console.log('Clearing command history');
        chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing history:', chrome.runtime.lastError);
            } else {
                this.loadCommandHistory();
            }
        });
    }

    showAddCommandForm() {
        const form = document.getElementById('add-command-form');
        form.style.display = 'block';

        // Clear form
        document.getElementById('command-trigger').value = '';
        document.getElementById('command-action').value = '';

        // Focus on trigger input
        document.getElementById('command-trigger').focus();
    }

    hideAddCommandForm() {
        const form = document.getElementById('add-command-form');
        form.style.display = 'none';
    }

    saveCustomCommand() {
        const trigger = document.getElementById('command-trigger').value.trim();
        const action = document.getElementById('command-action').value.trim();

        if (!trigger || !action) {
            this.showNotification('Please fill in both fields', 'error');
            return;
        }

        console.log('Saving custom command:', trigger, action);

        chrome.runtime.sendMessage({
            type: 'ADD_CUSTOM_COMMAND',
            command: trigger,
            action: action
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error saving custom command:', chrome.runtime.lastError);
                this.showNotification('Error saving command', 'error');
            } else {
                this.showNotification('Custom command saved successfully!', 'success');
                this.hideAddCommandForm();
                this.loadCustomCommands().then(() => this.displayCustomCommands());
            }
        });
    }

    deleteCustomCommand(trigger) {
        console.log('Deleting custom command:', trigger);

        chrome.runtime.sendMessage({
            type: 'DELETE_CUSTOM_COMMAND',
            command: trigger
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error deleting custom command:', chrome.runtime.lastError);
                this.showNotification('Error deleting command', 'error');
            } else {
                this.showNotification('Custom command deleted', 'success');
                this.loadCustomCommands().then(() => this.displayCustomCommands());
            }
        });
    }

    showHistory() {
        this.loadCommandHistory();
        document.getElementById('history-modal').style.display = 'flex';
    }

    hideHistory() {
        document.getElementById('history-modal').style.display = 'none';
    }

    showCustomCommands() {
        this.displayCustomCommands();
        document.getElementById('custom-commands-modal').style.display = 'flex';
        this.hideAddCommandForm();
    }

    hideCustomCommands() {
        document.getElementById('custom-commands-modal').style.display = 'none';
    }

    showSettings() {
        document.getElementById('settings-modal').style.display = 'flex';
    }

    hideSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    showHelp() {
        const commands = [
            '🎵 "play [song name]" or "gaana chalao" - Play music on YouTube',
            '🔍 "search [query]" or "khojo" - Search the web',
            '📑 "new tab" or "naya tab kholo" - Open a new tab',
            '📖 "read page" or "page padho" - Read page content',
            '📄 "summarize page" or "page ka summary do" - Get page summary',
            '⬆️ "scroll up/down" or "upar/neeche scroll karo" - Scroll the page',
            '↩️ "go back/forward" or "pichhe/aage jao" - Browser navigation',
            '⏹️ "stop" or "band karo" - Stop speaking',
            '🔇 "mute/unmute" - Mute/unmute tab',
            '🕐 "what time" or "time kya hai" - Get current time',
            '📅 "what date" or "date kya hai" - Get current date',
            '🌟 "hey vani" - Activate wake word (if enabled)'
        ];

        const helpText = `Available Commands:\n\n${commands.join('\n')}\n\nYou can also mix Hindi and English (Hinglish) for natural commands!`;
        alert(helpText);
    }

    hideModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('status-text');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = type;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    updateUI() {
        this.updateSettingsUI();
        this.loadCommandHistory();
    }
}

// Add CSS for notifications
const notificationStyles = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing Vani Popup');
    try {
        new VaniPopup();
    } catch (error) {
        console.error('Error initializing Vani Popup:', error);
        const statusElement = document.getElementById('status-text');
        if (statusElement) {
            statusElement.textContent = 'Error initializing extension';
            statusElement.className = 'error';
        }
    }
});

// Test background script connection
chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
    if (chrome.runtime.lastError) {
        console.error('Background script not responding:', chrome.runtime.lastError);
    } else {
        console.log('Background script is responsive');
    }
});


// popup.js

const MORE_URL = 'https://voiceassistantv1.netlify.app/';

// Create persistent window functionality
document.addEventListener('DOMContentLoaded', () => {
    const detachBtn = document.getElementById('detach-btn');
    if (detachBtn) {
        detachBtn.addEventListener('click', () => {
            openPersistentWindow();
        });
    }
});

function openPersistentWindow() {
    console.log('Opening persistent window...');
    
    // Get the current extension URL
    const popupUrl = chrome.runtime.getURL('popup.html');
    
    // Create a new window with the popup content
    chrome.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 420,
        height: 700,
        focused: true
    }, (window) => {
        if (chrome.runtime.lastError) {
            console.error('Error opening window:', chrome.runtime.lastError);
        } else {
            console.log('Persistent window opened:', window.id);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const moreBtn = document.getElementById('more-btn');
    if (!moreBtn) return;

    moreBtn.addEventListener('click', () => {
        // For Chrome/Edge/Firefox extension, use the appropriate API if available:
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url: MORE_URL });
            return;
        }

        // Fallback for non-extension contexts:
        window.open(MORE_URL, '_blank', 'noopener,noreferrer');
    });
});
