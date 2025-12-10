// Guard against multiple injections
if (window.contentCensurLoaded) {
    console.log('Content script already loaded, skipping...');
} else {
    window.contentCensurLoaded = true;

let settings = {};
let model = null;
let isModelLoading = false;

// Initialize
(async () => {
    await loadSettings();
    await loadDatabase();
    initObserver();
    
    // Initialize AI in offscreen document if enabled
    if (settings.aiEnabled) {
        chrome.runtime.sendMessage({ action: 'initOffscreenAI' });
    }
})();

// Load the community database
async function loadDatabase() {
    try {
        const url = chrome.runtime.getURL('database_mock.json');
        const response = await fetch(url);
        window.censurDatabase = await response.json();
        console.log('📚 Database loaded:', window.censurDatabase.videos.length, 'videos');
    } catch (e) {
        console.warn('Could not load database:', e);
        window.censurDatabase = null;
    }
}

// Load settings from storage
async function loadSettings() {
    const data = await chrome.storage.local.get('settings');
    if (data.settings) {
        settings = data.settings;
    }
}

// Watch for changes in settings
chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
        settings = changes.settings.newValue;
        if (settings.aiEnabled) {
            chrome.runtime.sendMessage({ action: 'initOffscreenAI' });
        }
    }
});

// Listen for test messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'testCensorship') {
        // Reload settings first to get the current action
        chrome.storage.local.get('settings', (data) => {
            if (data.settings) {
                settings = data.settings;
            }
            
            const video = document.querySelector('video');
            if (video) {
                const action = settings.defaultAction || 'blur';
                console.log(`🧪 TEST: Triggering ${action} manually`);
                applyAction(video, action, 'Manual Test');
                
                // Remove after 3 seconds (except for skip which is instant)
                if (action !== 'skip') {
                    setTimeout(() => {
                        removeAction(video);
                        console.log('🧪 TEST: Censorship removed');
                    }, 3000);
                }
                
                sendResponse({ success: true, action: action });
            } else {
                sendResponse({ success: false, error: 'No video found' });
            }
        });
    }
    return true; // Keep message channel open for async response
});

// AI Model Loading handled by Offscreen Document
// No local loading needed due to Trusted Types restrictions

// Track current URL for SPA navigation detection
let currentUrl = window.location.href;

// Observe DOM for video elements
function initObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'VIDEO') {
                    attachVideoListener(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('video').forEach(attachVideoListener);
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Attach to existing videos
    document.querySelectorAll('video').forEach(attachVideoListener);
    
    // Detect SPA navigation (URL changes without page reload)
    setupNavigationDetection();
}

// Detect YouTube SPA navigation
function setupNavigationDetection() {
    // Method 1: Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', handleNavigation);
    
    // Method 2: Monitor URL changes via polling (for YouTube's pushState)
    setInterval(() => {
        if (window.location.href !== currentUrl) {
            console.log('🔄 URL changed:', currentUrl, '→', window.location.href);
            handleNavigation();
        }
    }, 500);
    
    // Method 3: Listen for YouTube's specific navigation events
    document.addEventListener('yt-navigate-finish', handleNavigation);
}

function handleNavigation() {
    currentUrl = window.location.href;
    console.log('🔄 Navigation detected, resetting video attachments');
    
    // Reset all video attachments so they get re-analyzed for the new URL
    document.querySelectorAll('video[data-censur-attached]').forEach(video => {
        delete video.dataset.censurAttached;
        // Clear any active censorship from previous video
        video.style.filter = '';
        if (video.dataset.censurMuted === 'true') {
            video.muted = false;
            delete video.dataset.censurMuted;
        }
    });
    
    // Remove any overlay
    const overlay = document.querySelector('.censur-overlay');
    if (overlay) overlay.remove();
    
    // Re-attach to videos after a short delay (YouTube needs time to update the player)
    setTimeout(() => {
        document.querySelectorAll('video').forEach(attachVideoListener);
    }, 1000);
}

function attachVideoListener(video) {
    if (video.dataset.censurAttached) return;
    video.dataset.censurAttached = 'true';
    console.log("Attached to video:", video);
    
    // Track current active scene
    let activeScene = null;

    // Analysis loop (throttled)
    setInterval(async () => {
        if (video.paused || video.ended) return;
        
        const timestampMatch = checkTimestamps(video.currentTime);
        
        // Handle timestamp-based detection (priority)
        if (timestampMatch && settings.timestampsEnabled) {
            if (!activeScene || activeScene.description !== timestampMatch.description) {
                activeScene = timestampMatch;
                const reason = `📍 ${timestampMatch.type.toUpperCase()}: ${timestampMatch.description}`;
                console.log(`🎬 Scene detected: ${reason} (${timestampMatch.action})`);
                applyAction(video, timestampMatch.action, reason);
            }
            return;
        }
        
        // If we had an active scene but it ended, remove the action
        if (activeScene && !timestampMatch) {
            console.log('🎬 Scene ended, removing censorship');
            activeScene = null;
            removeAction(video);
        }

        if (settings.keywordsEnabled) {
            const keywordMatch = checkKeywords();
            if (keywordMatch) {
                applyAction(video, settings.defaultAction, `Keyword Match: ${keywordMatch}`);
                return;
            }
        }

        if (settings.aiEnabled) {
            const prediction = await runAIInference(video);
            if (prediction) {
                applyAction(video, settings.defaultAction, `AI Detection: ${prediction}`);
            } else if (!activeScene) {
                removeAction(video);
            }
        } else {
             // If AI is off and no other trigger, verify we clean up
             if (!timestampMatch && !settings.keywordsEnabled) {
                 removeAction(video);
             }
        }

    }, 2000); // 0.5Hz check (slower for AI performance)
}

function checkTimestamps(currentTime) {
    // Check if we have a loaded database and current URL matches any video
    if (!window.censurDatabase) return null;
    
    const currentUrl = window.location.href.toLowerCase();
    const currentTitle = document.title.toLowerCase();
    
    // Find matching video in database
    for (const video of window.censurDatabase.videos) {
        // Check if URL or title matches any pattern
        const matches = video.urlPatterns.some(pattern => 
            currentUrl.includes(pattern.toLowerCase()) || 
            currentTitle.includes(pattern.toLowerCase())
        );
        
        if (matches) {
            // Check each scene
            for (const scene of video.scenes) {
                if (currentTime >= scene.start && currentTime <= scene.end) {
                    // Get the action for this scene type
                    const sceneTypeConfig = window.censurDatabase.sceneTypes[scene.type];
                    const action = sceneTypeConfig ? sceneTypeConfig.defaultAction : 'blur';
                    
                    return {
                        action: action,
                        type: scene.type,
                        description: scene.description,
                        endTime: scene.end
                    };
                }
            }
        }
    }
    
    return null;
}

function checkKeywords() {
    // Naive implementation: check all text in the video container/subtitles
    // Real implementation would rely on specific track elements or ARIA labels
    const textContent = document.body.innerText.toLowerCase(); 
    // NOTE: Checking full body is expensive and noisy. 
    // Optimally, check standard subtitle containers .ytp-caption-segment etc.
    
    for (const word of settings.keywords) {
        if (textContent.includes(word)) return word;
    }
    return null;
}

async function runAIInference(video) {
    try {
        // Create an offscreen canvas to capture the frame
        const canvas = document.createElement('canvas');
        canvas.width = 224; // Resize for model efficiency
        canvas.height = 224;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // check for black/drm frame
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frameData.data;
        let isAllBlack = true;
        // Check every 100th pixel for performance
        for (let i = 0; i < data.length; i += 400) {
             if (data[i] > 10 || data[i+1] > 10 || data[i+2] > 10) {
                 isAllBlack = false;
                 break;
             }
        }
        
        if (isAllBlack) {
            // console.log("⚫ Black frame detected (DRM?), skipping AI");
            return null;
        }

        // Convert to data URL
        const imageData = canvas.toDataURL('image/jpeg', 0.5);
        
        // Send to offscreen document for analysis
        const response = await chrome.runtime.sendMessage({
            action: 'analyzeFrame',
            imageData: imageData
        });
        
        if (response && response.success && response.predictions) {
            // Check predictions against sensitivity
            const forbiddenClasses = ['Porn', 'Hentai', 'Sexy'];
            // Sensitivity 50 means > 0.5 probability (inverse logic: higher sensitivity = lower threshold)
            // But we implemented: (100 - sensitivity) / 100
            // sensitivity 100 => threshold 0.0 (detect everything)
            // sensitivity 0 => threshold 1.0 (detect nothing)
            const threshold = (100 - settings.sensitivity) / 100;
            
            for (const pred of response.predictions) {
                 if (forbiddenClasses.includes(pred.className) && pred.probability > threshold) {
                     return `${pred.className} (${Math.round(pred.probability * 100)}%)`;
                 }
            }
        }
    } catch (e) {
        // AI inference failed or timed out
    }
    return null;
}

function applyAction(video, action, reason) {
    // First, clear any previous effects
    video.style.filter = '';
    const existingOverlay = video.parentNode.querySelector('.censur-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // Apply the selected action
    switch (action) {
        case 'blur':
            video.style.filter = 'blur(20px)';
            console.log(`Applied blur due to ${reason}`);
            break;
            
        case 'overlay':
            showOverlay(video, reason);
            console.log(`Applied overlay due to ${reason}`);
            break;
            
        case 'skip':
            video.currentTime += 5; // Skip 5 seconds
            console.log(`Skipped 5 seconds due to ${reason}`);
            break;
            
        case 'mute':
            if (!video.muted) {
                video.muted = true;
                video.dataset.censurMuted = 'true';
            }
            console.log(`Muted audio due to ${reason}`);
            break;
            
        default:
            video.style.filter = 'blur(20px)';
            console.log(`Applied default blur due to ${reason}`);
    }
}

function removeAction(video) {
    video.style.filter = '';
    
    // Remove overlay if exists (now in body)
    const overlay = document.querySelector('.censur-overlay');
    if (overlay) overlay.remove();
    
    // Unmute if we muted it
    if (video.dataset.censurMuted === 'true') {
        video.muted = false;
        delete video.dataset.censurMuted;
    }
}

function showOverlay(video, text) {
    // Remove any existing overlay first
    const existingOverlay = document.querySelector('.censur-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // Create new overlay
    const overlay = document.createElement('div');
    overlay.className = 'censur-overlay';
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: rgba(0, 0, 0, 0.95) !important;
        color: white !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        font-family: Arial, sans-serif !important;
        font-size: 24px !important;
        text-align: center !important;
        pointer-events: none !important;
    `;
    overlay.innerHTML = `
        <div style="padding: 40px; background: rgba(100, 100, 100, 0.3); border-radius: 16px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🛡️</div>
            <div style="font-weight: bold;">Content Hidden</div>
            <div style="font-size: 14px; opacity: 0.7; margin-top: 8px;">${text}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    console.log('Overlay shown');
}

} // End of else block (guard against multiple injections)
