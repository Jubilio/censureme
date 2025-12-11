// Content Guard - Background Service Worker

let blocklist = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Content Guard Extension Installed");

  // Initialize default settings
  await chrome.storage.local.set({
    settings: {
      enabled: true,
      aiEnabled: true,
      keywordsEnabled: true,
      timestampsEnabled: true,
      siteBlockingEnabled: true,
      sensitivity: 50,
      defaultAction: "blur",
      keywords: ["gay", "lesbian", "queer", "homosexual", "romance"],
      security: {
        pin: null
      }
    },
  });

  // Load blocklist
  await loadBlocklist();
});

// Load blocklist on startup
chrome.runtime.onStartup.addListener(async () => {
  await loadBlocklist();
});

// Load blocklist from JSON file
async function loadBlocklist() {
  try {
    const response = await fetch(chrome.runtime.getURL('blocklist.json'));
    blocklist = await response.json();
    console.log('🚫 Blocklist loaded:', blocklist.sites.length, 'sites');
  } catch (e) {
    console.error('Failed to load blocklist:', e);
    blocklist = { enabled: true, sites: [], keywords: [] };
  }
}

// Ensure blocklist is loaded
async function ensureBlocklist() {
  if (!blocklist) {
    await loadBlocklist();
  }
  return blocklist;
}

// Check if URL should be blocked
function shouldBlockUrl(url) {
  if (!blocklist || !blocklist.enabled) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check against blocklist sites
    for (const site of blocklist.sites) {
      if (hostname.includes(site.toLowerCase())) {
        return true;
      }
    }
    
    // Check against keyword patterns in URL
    const fullUrl = url.toLowerCase();
    for (const keyword of blocklist.keywords) {
      if (fullUrl.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  } catch (e) {
    // Invalid URL
  }
  
  return false;
}

// Listen for navigation events
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only check main frame navigations
  if (details.frameId !== 0) return;
  
  // Check settings
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings || !settings.enabled || !settings.siteBlockingEnabled) return;
  
  // Ensure blocklist is loaded
  await ensureBlocklist();
  
  // Check if URL should be blocked
  if (shouldBlockUrl(details.url)) {
    console.log('🚫 Blocking access to:', details.url);
    
    // Redirect to blocked page
    const blockedPageUrl = chrome.runtime.getURL('blocked.html') + 
      '?url=' + encodeURIComponent(details.url);
    
    chrome.tabs.update(details.tabId, { url: blockedPageUrl });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBlocklist') {
    ensureBlocklist().then(() => {
      sendResponse({ blocklist: blocklist });
    });
    return true;
  }
  
  if (request.action === 'updateBlocklist') {
    blocklist = request.blocklist;
    sendResponse({ success: true });
    return true;
  }
  
  // AI Analysis via Offscreen Document
  if (request.action === 'analyzeFrame') {
    handleAnalyzeFrame(request.imageData).then(sendResponse);
    return true;
  }
  
  if (request.action === 'initOffscreenAI') {
    ensureOffscreenDocument().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// ============================================
// OFFSCREEN DOCUMENT MANAGEMENT
// ============================================

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) {
    return; // Already exists
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER', 'WORKERS'],
      justification: 'AI model inference for content analysis'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
    console.log('🤖 Offscreen document created for AI processing');
  }
}

async function handleAnalyzeFrame(imageData) {
  try {
    await ensureOffscreenDocument();
    
    // Send to offscreen for analysis
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeFrame',
      imageData: imageData,
      target: 'offscreen'
    });
    
    return response;
  } catch (e) {
    console.error('AI Analysis error:', e);
    return { error: e.message };
  }
}

// Initialize offscreen document on startup if AI is enabled
chrome.runtime.onStartup.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings && settings.aiEnabled) {
    await ensureOffscreenDocument();
  }
});

