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
    // Elements - Dashboard & Nav
    const dashboardView = document.getElementById('dashboard-view');
    const settingsView = document.getElementById('settings-view');
    const settingsBtn = document.getElementById('settings-btn');
    const backBtn = document.getElementById('back-btn');
    const masterToggle = document.getElementById('master-toggle');
    const statusCircle = document.getElementById('status-circle');
    const statusText = document.getElementById('status-text');

    // Default Settings
    let settings = stored.settings || {
        enabled: true,
        aiEnabled: true,
        keywordsEnabled: true,
        timestampsEnabled: true,
        siteBlockingEnabled: true,
        sensitivity: 50,
        defaultAction: 'blur',
        keywords: ['gay', 'lesbian', 'queer', 'homosexual'],
        security: { pin: null }
    };
    
    // Safety check for incomplete settings (e.g. from older version)
    if (!settings.security) settings.security = { pin: null };
    if (typeof settings.enabled === 'undefined') settings.enabled = true;

    // Apply settings to UI (Dashboard)
    updateDashboardUI(settings.enabled);

    // Apply settings to UI (Settings)
    aiToggle.checked = settings.aiEnabled;
    keywordsToggle.checked = settings.keywordsEnabled;
    timestampsToggle.checked = settings.timestampsEnabled;
    blockingToggle.checked = settings.siteBlockingEnabled !== false;
    sensitivitySlider.value = settings.sensitivity;
    sensitivityValue.textContent = `${settings.sensitivity}%`;
    actionSelect.value = settings.defaultAction;
    keywordsInput.value = settings.keywords.join(', ');

    toggleKeywordSection(settings.keywordsEnabled);


    // --- Navigation Logic ---
    settingsBtn.addEventListener('click', () => {
        if (settings.security && settings.security.pin) {
            requestLogin(() => {
                showSettings();
            });
        } else {
            showSettings();
        }
    });

    backBtn.addEventListener('click', () => {
        settingsView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
    });

    // --- Master Switch Logic ---
    // --- Master Switch Logic ---
    // Use 'click' to intercept the potential state change before it visually happens
    // We prevent default behavior and manage checked state manually
    masterToggle.addEventListener('change', async (e) => {
        const desiredState = e.target.checked;
        const previousState = !desiredState;

        // If protected, revert immediately and verify
        if (settings.security && settings.security.pin) {
            e.target.checked = previousState; // Revert visually
            
            requestLogin(async () => {
                // Login success: Apply desired state
                settings.enabled = desiredState;
                updateDashboardUI(settings.enabled);
                await saveSettings();
            });
        } else {
            // Not protected: Allow change
            settings.enabled = desiredState;
            updateDashboardUI(settings.enabled);
            await saveSettings();
        }
    });

    function updateDashboardUI(enabled) {
        masterToggle.checked = enabled;
        if (enabled) {
            statusCircle.className = 'status-circle active';
            statusText.textContent = 'Protected';
            document.body.style.borderColor = 'var(--success-color)';
        } else {
            statusCircle.className = 'status-circle inactive';
            statusText.textContent = 'Disabled';
            document.body.style.borderColor = '#ef4444';
        }
    }

    function showSettings() {
        dashboardView.classList.add('hidden');
        settingsView.classList.remove('hidden');
    }

    // --- Settings Logic ---
    async function saveSettings() {
        // Collect current state (handled by individual specific listeners below or global save)
        await chrome.storage.local.set({ settings });
    }

    // Event Listeners (Individual Toggles auto-save)
    aiToggle.addEventListener('change', async (e) => {
        settings.aiEnabled = e.target.checked;
        await saveSettings();
    });
    
    keywordsToggle.addEventListener('change', async (e) => {
        settings.keywordsEnabled = e.target.checked;
        toggleKeywordSection(e.target.checked);
        await saveSettings();
    });

    timestampsToggle.addEventListener('change', async (e) => {
        settings.timestampsEnabled = e.target.checked;
        await saveSettings();
    });

    blockingToggle.addEventListener('change', async (e) => {
        settings.siteBlockingEnabled = e.target.checked;
        await saveSettings();
    });

    sensitivitySlider.addEventListener('input', (e) => {
        sensitivityValue.textContent = `${e.target.value}%`;
    });
    
    sensitivitySlider.addEventListener('change', async (e) => {
        settings.sensitivity = parseInt(e.target.value);
        await saveSettings();
    });

    actionSelect.addEventListener('change', async (e) => {
        settings.defaultAction = e.target.value;
        await saveSettings();
    });

    saveBtn.addEventListener('click', async () => {
        // Explicit save for keywords and potentially other inputs
        settings.keywords = parseKeywords(keywordsInput.value);
        await saveSettings();
        
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
        saveBtn.click();
    });

    // Test button 
    const testBtn = document.getElementById('test-btn');
    testBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // Content script is already injected via manifest
        // We just need to send the message
        
        setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'testCensorship' }, (response) => {
                if (chrome.runtime.lastError || !response || !response.success) {
                    testBtn.textContent = '❌ No video found';
                    testBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                } else {
                    testBtn.textContent = '✅ Triggered!';
                    testBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                }
                
                setTimeout(() => {
                    testBtn.textContent = '🧪 Test Censorship';
                    testBtn.style.background = '';
                }, 2000);
            });
        }, 300);
    });

    // PIN Logic
    const loginView = document.getElementById('login-view');
    const mainView = document.getElementById('main-view');
    const pinInput = document.getElementById('pin-input');
    const unlockBtn = document.getElementById('unlock-btn');
    const loginError = document.getElementById('login-error');
    const setupPinBtn = document.getElementById('setup-pin-btn');
    
    let pendingAuthCallback = null;

    // Init Logic - Always show Main unless blocked by action
    showMain();
    
    function requestLogin(callback) {
        pendingAuthCallback = callback;
        showLogin();
    }

    // Unlock
    unlockBtn.addEventListener('click', () => {
        if (pinInput.value === settings.security.pin) {
            showMain();
            pinInput.value = '';
            loginError.classList.add('hidden');
            
            // Execute pending action
            if (pendingAuthCallback) {
                pendingAuthCallback();
                pendingAuthCallback = null;
            }
        } else {
            loginError.classList.remove('hidden');
            pinInput.value = '';
            pinInput.focus();
        }
    });

    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') unlockBtn.click();
    });
    
    // Add "Cancel" button logic for login view? 
    // Currently no cancel button, user must close popup. Simple enough.

    // Setup PIN
    setupPinBtn.addEventListener('click', async () => {
        // If PIN exists, ask for it first? Or just allow removal if we are in Dashboard?
        // If we want strict security, even removing PIN needs PIN.
        if (settings.security && settings.security.pin) {
            requestLogin(async () => {
                 const confirmRemove = confirm('Do you want to REMOVE the PIN protection?');
                if (confirmRemove) {
                    settings.security.pin = null;
                    await chrome.storage.local.set({ settings });
                    setupPinBtn.textContent = 'Set PIN Protection';
                    alert('PIN removed.');
                }
            });
            return;
        }

        // Set new PIN
        const newPin = prompt('Enter a 4-digit PIN to secure this extension:');
        if (newPin && newPin.length === 4 && !isNaN(newPin)) {
            if (!settings.security) settings.security = {};
            settings.security.pin = newPin;
            await chrome.storage.local.set({ settings });
            setupPinBtn.textContent = 'Remove PIN Protection';
            alert('PIN set successfully! Sensitive actions will now require this PIN.');
        } else if (newPin !== null) {
            alert('Invalid PIN. Please enter exactly 4 digits.');
        }
    });
    
    // Update button text on load
    if (settings.security && settings.security.pin) {
        setupPinBtn.textContent = 'Remove PIN Protection';
    }

    function showLogin() {
        loginView.classList.remove('hidden');
        mainView.classList.add('hidden');
        pinInput.focus();
    }

    function showMain() {
        loginView.classList.add('hidden');
        mainView.classList.remove('hidden');
    }

    // Helper Functions
    function toggleKeywordSection(show) {
        keywordSection.style.display = show ? 'block' : 'none';
        keywordSection.style.opacity = show ? '1' : '0'; // Could add transition
    }

    function parseKeywords(input) {
        return input.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }
});
