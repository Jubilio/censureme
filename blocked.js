// blocked.js - Script for the blocked page
document.addEventListener('DOMContentLoaded', () => {
    // Get the blocked URL from the query parameter
    const params = new URLSearchParams(window.location.search);
    const blockedUrl = params.get('url') || 'Unknown';
    document.getElementById('blocked-url').textContent = blockedUrl;
});
