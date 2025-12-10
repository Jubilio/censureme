// Offscreen AI Processor - Runs in isolated context without Trusted Types
let model = null;
let isModelLoading = false;

// Initialize model on load
async function initModel() {
    if (isModelLoading || model) return;
    isModelLoading = true;
    
    console.log('🤖 [Offscreen] Loading NSFW.js model...');
    
    try {
        // Check if nsfwjs is available
        if (typeof nsfwjs !== 'undefined') {
            // Try to load from local model folder
            try {
                const modelUrl = chrome.runtime.getURL('libs/model/');
                model = await nsfwjs.load(modelUrl, { size: 299 });
                console.log('✅ [Offscreen] Model loaded from local folder');
            } catch (e) {
                console.warn('⚠️ [Offscreen] Local model load failed, falling back to CDN:', e);
                // Fallback to default CDN model
                model = await nsfwjs.load();
                console.log('✅ [Offscreen] Model loaded from CDN');
            }
        } else {
            throw new Error('NSFW.js not available');
        }
    } catch (e) {
        console.error('❌ [Offscreen] Failed to load model:', e);
        model = null;
    }
    
    isModelLoading = false;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeFrame') {
        analyzeFrame(request.imageData).then(sendResponse);
        return true; // Keep channel open for async response
    }
    
    if (request.action === 'initModel') {
        initModel().then(() => {
            sendResponse({ success: model !== null });
        });
        return true;
    }
    
    if (request.action === 'getStatus') {
        sendResponse({
            modelLoaded: model !== null,
            isLoading: isModelLoading
        });
        return true;
    }
});

// Analyze a frame (receives base64 image data)
async function analyzeFrame(imageDataUrl) {
    if (!model) {
        return { error: 'Model not loaded', predictions: null };
    }
    
    try {
        // Create image element from data URL
        const img = new Image();
        img.src = imageDataUrl;
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        // Run inference
        const predictions = await model.classify(img);
        
        console.log('🔍 [Offscreen] Predictions:', predictions);
        
        return {
            success: true,
            predictions: predictions.map(p => ({
                className: p.className,
                probability: p.probability
            }))
        };
    } catch (e) {
        console.error('❌ [Offscreen] Analysis error:', e);
        return { error: e.message, predictions: null };
    }
}

// Auto-init on load
initModel();
