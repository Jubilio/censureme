let model = null;

// Initialize model
// (init function moved to bottom and updated to accept URL)


// Handle messages from parent
// Don't auto-init from CDN anymore. Wait for local path from offscreen.js
// init();

window.addEventListener('message', async (event) => {
    const { action, imageData, id, url } = event.data;

    if (action === 'loadModel') {
        await init(url);
    }
    
    else if (action === 'analyzeFrame') {
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
                // ... (rest of logic same)
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

async function init(modelUrl) {
    try {
        if (typeof nsfwjs === 'undefined') {
            throw new Error('NSFWJS library not loaded');
        }
        
        console.log(`📥 [Sandbox] Loading model from: ${modelUrl || 'default CDN'}`);
        // If modelUrl is provided, load from there. Otherwise default to CDN.
        model = modelUrl ? await nsfwjs.load(modelUrl) : await nsfwjs.load();
        
        // Notify parent that model is ready
        window.parent.postMessage({ action: 'modelLoaded', success: true }, '*');
        console.log('✅ [Sandbox] Model loaded');
    } catch (e) {
        console.error('❌ [Sandbox] Model load failed:', e);
        window.parent.postMessage({ action: 'modelLoaded', success: false, error: e.message }, '*');
    }
}
