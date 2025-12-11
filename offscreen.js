// Offscreen Bridge - Communicates between Background and Sandbox
let sandboxFrame = null;
let pendingRequests = new Map();

// Initialize
function init() {
    sandboxFrame = document.getElementById('sandbox');
    console.log('🌉 [Offscreen] Bridge initialized');
}

// Handle messages from sandbox
window.addEventListener('message', (event) => {
    // Verify origin if needed, or simply trust local iframe
    const { action, id, success, predictions, error } = event.data;

    if (action === 'analyzeResult') {
        const resolve = pendingRequests.get(id);
        if (resolve) {
            if (success) {
                resolve({ success: true, predictions });
            } else {
                resolve({ error: error || 'Unknown error from sandbox', predictions: null });
            }
            pendingRequests.delete(id);
        }
    } else if (action === 'modelLoaded') {
        console.log(`✅ [Offscreen] Sandbox model loaded: ${success}`);
    }
});

// Handle messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeFrame') {
        analyzeFrameInSandbox(request.imageData).then(sendResponse);
        return true; 
    }
    
    if (request.action === 'initModel') {
        // Sandbox inits itself on load, just check if frame exists
        sendResponse({ success: !!sandboxFrame });
        return true;
    }
});

function analyzeFrameInSandbox(imageData) {
    return new Promise((resolve) => {
        if (!sandboxFrame || !sandboxFrame.contentWindow) {
            resolve({ error: 'Sandbox not ready', predictions: null });
            return;
        }

        const id = Math.random().toString(36).substring(7);
        pendingRequests.set(id, resolve);

        sandboxFrame.contentWindow.postMessage({
            action: 'analyzeFrame',
            id,
            imageData
        }, '*');

        // Timeout fallback
        setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                resolve({ error: 'Sandbox timeout', predictions: null });
            }
        }, 5000); 
    });
}

// Start
init();
