// Updated popup.js for the new UI
const voiceBubble = document.getElementById('voice-bubble');
const statusDiv = document.getElementById('status');
const wakeWordBtn = document.getElementById('wake-word-btn');
const wakeWordStatus = document.getElementById('wake-word-status');
const wakeWordDot = document.getElementById('wake-word-dot');
const wakeWordText = document.getElementById('wake-word-text');
const historyBtn = document.getElementById('history-btn');
const closeHistory = document.getElementById('close-history');
const historyPanel = document.getElementById('history-panel');
const commandHistory = document.getElementById('command-history');

let recognition = null;
let isListening = false;
let wakeWordEnabled = false;
let pressTimer = null;

// Initialize the popup
document.addEventListener('DOMContentLoaded', function () {
    loadCommandHistory();
    loadSettings();
    setupEventListeners();
});

function setupEventListeners() {
    // Voice bubble interactions
    voiceBubble.addEventListener('mousedown', startListening);
    voiceBubble.addEventListener('mouseup', stopListening);
    voiceBubble.addEventListener('mouseleave', stopListening);
    voiceBubble.addEventListener('touchstart', startListening);
    voiceBubble.addEventListener('touchend', stopListening);

    // Control buttons
    wakeWordBtn.addEventListener('click', toggleWakeWord);
    historyBtn.addEventListener('click', toggleHistoryPanel);
    closeHistory.addEventListener('click', closeHistoryPanel);

    // Close history when clicking outside
    document.addEventListener('click', (e) => {
        if (!historyPanel.contains(e.target) && e.target !== historyBtn) {
            closeHistoryPanel();
        }
    });
}

function startListening(e) {
    e.preventDefault();
    if (!recognition || isListening) return;

    // Add ripple effect
    createRipple(e);

    pressTimer = setTimeout(() => {
        recognition.start();
    }, 300); // Short delay to indicate press & hold
}

function stopListening(e) {
    e.preventDefault();
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }

    if (isListening && recognition) {
        recognition.stop();
    }
}

function createRipple(e) {
    const ripple = document.createElement('div');
    ripple.classList.add('ripple');

    const rect = voiceBubble.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    voiceBubble.appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Load command history from storage
function loadCommandHistory() {
    chrome.storage.local.get(['commandHistory'], function (result) {
        const history = result.commandHistory || [];
        commandHistory.innerHTML = '';

        if (history.length === 0) {
            commandHistory.innerHTML = '<div class="empty-history">No commands yet</div>';
            return;
        }

        history.slice(-8).reverse().forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${item.success ? 'success' : 'error'}`;
            historyItem.innerHTML = `
                <div class="history-command">${item.command}</div>
                <div class="history-details">
                    <span>${item.response}</span>
                    <span>${item.timestamp}</span>
                </div>
            `;
            commandHistory.appendChild(historyItem);
        });
    });
}

// Load settings
function loadSettings() {
    chrome.storage.local.get(['wakeWordEnabled'], function (result) {
        wakeWordEnabled = result.wakeWordEnabled || false;
        updateWakeWordUI();
    });
}

// Toggle wake word
function toggleWakeWord() {
    wakeWordEnabled = !wakeWordEnabled;

    chrome.storage.local.set({ wakeWordEnabled: wakeWordEnabled }, function () {
        updateWakeWordUI();

        // Send message to background script
        chrome.runtime.sendMessage({
            type: 'TOGGLE_WAKE_WORD',
            enabled: wakeWordEnabled
        });
    });
}

function updateWakeWordUI() {
    if (wakeWordEnabled) {
        wakeWordBtn.classList.add('active');
        wakeWordBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
            Hey Vani
        `;
        wakeWordDot.classList.add('active');
        wakeWordText.textContent = 'Listening';
    } else {
        wakeWordBtn.classList.remove('active');
        wakeWordBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            Hey Vani
        `;
        wakeWordDot.classList.remove('active');
        wakeWordText.textContent = 'Hey Vani';
    }
}

// History panel controls
function toggleHistoryPanel() {
    historyPanel.classList.toggle('open');
}

function closeHistoryPanel() {
    historyPanel.classList.remove('open');
}

// Status display
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.style.color = type === 'error' ? '#ef4444' :
        type === 'success' ? '#10b981' : 'white';
}

// Speech recognition setup
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = function () {
        isListening = true;
        voiceBubble.classList.add('listening');
        showStatus('Listening... Speak now', 'info');
    };

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        showStatus(`Heard: "${transcript}"`, 'success');

        // Send command to background script
        chrome.runtime.sendMessage({
            type: 'VOICE_COMMAND',
            command: transcript
        });

        // Reload history after a short delay
        setTimeout(loadCommandHistory, 500);
    };

    recognition.onerror = function (event) {
        showStatus(`Error: ${event.error}`, 'error');
        resetBubble();
    };

    recognition.onend = function () {
        resetBubble();
    };
} else {
    voiceBubble.style.opacity = '0.5';
    voiceBubble.style.cursor = 'not-allowed';
    showStatus('Speech recognition not supported', 'error');
}

function resetBubble() {
    isListening = false;
    voiceBubble.classList.remove('listening');
    showStatus('Ready for voice commands', 'info');
}

document.addEventListener("DOMContentLoaded", () => {
    const voiceBubble = document.getElementById("voice-bubble");
    const iframeContainer = document.getElementById("iframe-container");
    const webIframe = document.getElementById("web-iframe");
    const closeIframe = document.getElementById("close-iframe");

    // When bubble is clicked — show iframe
    voiceBubble.addEventListener("click", () => {
        webIframe.src = "https://voiceassistantv1.netlify.app/"; // 👈 Change this to your target site
        iframeContainer.style.display = "flex";
        iframeContainer.style.flexDirection = "column";
    });

    // Close iframe
    closeIframe.addEventListener("click", () => {
        iframeContainer.style.display = "none";
        webIframe.src = ""; // reset iframe
    });
});
