const listenBtn = document.getElementById('listen-btn');
const statusDiv = document.getElementById('status');

let recognition = null;
let isListening = false;

// Check if speech recognition is available
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = function () {
        isListening = true;
        listenBtn.textContent = 'Listening...';
        listenBtn.classList.add('listening');
        statusDiv.textContent = 'Speak now...';
    };

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript.toLowerCase();
        statusDiv.textContent = `Heard: "${transcript}"`;

        // Send command to background script
        chrome.runtime.sendMessage({ command: transcript });
    };

    recognition.onerror = function (event) {
        statusDiv.textContent = `Error: ${event.error}`;
        resetButton();
    };

    recognition.onend = function () {
        resetButton();
    };

} else {
    listenBtn.disabled = true;
    statusDiv.textContent = 'Speech recognition not supported';
}

function resetButton() {
    isListening = false;
    listenBtn.textContent = 'Start Listening';
    listenBtn.classList.remove('listening');
}

listenBtn.addEventListener('click', function () {
    if (!recognition) return;

    if (!isListening) {
        recognition.start();
    } else {
        recognition.stop();
        resetButton();
    }
});