let model = null;

// Initialize model
async function init() {
    try {
        if (typeof nsfwjs === 'undefined') {
            throw new Error('NSFWJS library not loaded');
        }
        // Sandbox pages can't access chrome.runtime.getURL directly for resources outside their sandbox
        // calling .load() without args loads from CDN by default which works fine in sandbox
        model = await nsfwjs.load();
        
        // Notify parent that model is ready
        window.parent.postMessage({ action: 'modelLoaded', success: true }, '*');
        console.log('✅ [Sandbox] Model loaded');
    } catch (e) {
        console.error('❌ [Sandbox] Model load failed:', e);
        window.parent.postMessage({ action: 'modelLoaded', success: false, error: e.message }, '*');
    }
}

// Handle messages from parent
window.addEventListener('message', async (event) => {
    const { action, imageData, id } = event.data;

    if (action === 'analyzeFrame') {
        if (!model) {
            window.parent.postMessage({ 
                action: 'analyzeResult', 
                id,
                error: 'Model not loaded' 
            }, '*');
            return;
        }

        try {
            const img = new Image();
            img.onload = async () => {
                const predictions = await model.classify(img);
                window.parent.postMessage({
                    action: 'analyzeResult',
                    id,
                    success: true,
                    predictions: predictions.map(p => ({
                        className: p.className,
                        probability: p.probability
                    }))
                }, '*');
            };
            img.onerror = (e) => {
                window.parent.postMessage({ 
                    action: 'analyzeResult', 
                    id, 
                    error: 'Image load failed' 
                }, '*');
            };
            img.src = imageData;
        } catch (e) {
            window.parent.postMessage({ 
                action: 'analyzeResult', 
                id, 
                error: e.message 
            }, '*');
        }
    }
});

// Start initialization
init();
