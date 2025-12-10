document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const aiToggle = document.getElementById('ai-toggle');
    const keywordsToggle = document.getElementById('keywords-toggle');
    const timestampsToggle = document.getElementById('timestamps-toggle');
    const blockingToggle = document.getElementById('blocking-toggle');
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const sensitivityValue = document.getElementById('sensitivity-value');
    const actionSelect = document.getElementById('action-select');
    const keywordsInput = document.getElementById('keywords-input');
    const keywordSection = document.getElementById('keyword-section');
    const saveKeywordsBtn = document.getElementById('save-keywords');
    const saveBtn = document.getElementById('save-btn');
    const logoImg = document.getElementById('logo-img');

    // Load current settings
    const stored = await chrome.storage.local.get('settings');
    let settings = stored.settings || {
        aiEnabled: true,
        keywordsEnabled: true,
        timestampsEnabled: true,
        siteBlockingEnabled: true,
        sensitivity: 50,
        defaultAction: 'blur',
        keywords: ['gay', 'lesbian', 'queer', 'homosexual', 'romance']
    };

    // Apply settings to UI
    aiToggle.checked = settings.aiEnabled;
    keywordsToggle.checked = settings.keywordsEnabled;
    timestampsToggle.checked = settings.timestampsEnabled;
    blockingToggle.checked = settings.siteBlockingEnabled !== false;
    sensitivitySlider.value = settings.sensitivity;
    sensitivityValue.textContent = `${settings.sensitivity}%`;
    actionSelect.value = settings.defaultAction;
    keywordsInput.value = settings.keywords.join(', ');

    // Toggle Keyword Section Visibility
    toggleKeywordSection(settings.keywordsEnabled);

    // Event Listeners
    sensitivitySlider.addEventListener('input', (e) => {
        sensitivityValue.textContent = `${e.target.value}%`;
    });

    keywordsToggle.addEventListener('change', (e) => {
        toggleKeywordSection(e.target.checked);
    });

    saveBtn.addEventListener('click', async () => {
        const newSettings = {
            aiEnabled: aiToggle.checked,
            keywordsEnabled: keywordsToggle.checked,
            timestampsEnabled: timestampsToggle.checked,
            siteBlockingEnabled: blockingToggle.checked,
            sensitivity: parseInt(sensitivitySlider.value),
            defaultAction: actionSelect.value,
            keywords: parseKeywords(keywordsInput.value)
        };

        await chrome.storage.local.set({ settings: newSettings });
        
        // Visual feedback
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = 'var(--success-color)';
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    });

    saveKeywordsBtn.addEventListener('click', () => {
        // Just triggers the save logic visually for this section, 
        // in reality the main save button handles everything, but this UX feels better
        saveBtn.click();
    });

    // Test button - sends message to content script to trigger censorship
    const testBtn = document.getElementById('test-btn');
    testBtn.addEventListener('click', async () => {
        // Get the current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // First, try to inject the content script (in case it wasn't loaded)
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (e) {
            // Script might already be injected, that's okay
            console.log('Script injection:', e.message);
        }
        
        // Wait a moment for script to initialize
        setTimeout(() => {
            // Send message to content script
            chrome.tabs.sendMessage(tab.id, { action: 'testCensorship' }, (response) => {
                if (chrome.runtime.lastError) {
                    testBtn.textContent = '❌ No video found';
                    testBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                } else if (response && response.success) {
                    testBtn.textContent = '✅ Triggered!';
                    testBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                } else {
                    testBtn.textContent = '❌ No video found';
                    testBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                }
                
                setTimeout(() => {
                    testBtn.textContent = '🧪 Test Censorship';
                    testBtn.style.background = '';
                }, 2000);
            });
        }, 300);
    });

    // Helper Functions
    function toggleKeywordSection(show) {
        keywordSection.style.display = show ? 'block' : 'none';
        keywordSection.style.opacity = show ? '1' : '0'; // Could add transition
    }

    function parseKeywords(input) {
        return input.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }
});
