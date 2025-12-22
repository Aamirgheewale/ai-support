/**
 * AI Support Widget Embed Script
 * This script injects the chat widget into any website via an iframe.
 */

(function() {
  'use strict';

  // Configuration
  const WIDGET_URL = 'https://charming-nourishment-production.up.railway.app/';

  // Prevent duplicate widget injection
  if (document.getElementById('ai-widget-iframe')) {
    return;
  }

  
  // Create iframe element
  const iframe = document.createElement('iframe');

  // Get host page data to pass to widget
  const hostTitle = encodeURIComponent(document.title);
  const hostUrl = encodeURIComponent(window.location.href);
  const widgetUrlWithParams = `${WIDGET_URL}?hostTitle=${hostTitle}&hostUrl=${hostUrl}`;

  // Set iframe attributes
  iframe.id = 'ai-widget-iframe';
  iframe.src = widgetUrlWithParams;
  iframe.setAttribute('allow', 'microphone; camera');
  iframe.setAttribute('frameborder', '0');

  // Apply default styling (Closed State - small bubble size)
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.right = '20px';
  iframe.style.width = '90px';
  iframe.style.height = '90px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '999999';
  iframe.style.boxShadow = 'none';
  iframe.style.background = 'transparent';
  iframe.style.transition = 'width 0.3s ease, height 0.3s ease';

  // Listen for messages from the iframe to resize it
  window.addEventListener('message', function(event) {
    // Security: Verify origin if needed (optional but recommended)
    // if (event.origin !== 'https://charming-nourishment-production.up.railway.app') return;
    
    if (event.data === 'chat-opened') {
      // Resize iframe to full chat widget size
      iframe.style.width = '400px';
      iframe.style.height = '680px';
    } else if (event.data === 'chat-closed') {
      // Resize iframe back to small bubble size
      iframe.style.width = '150px';
      iframe.style.height = '150px';
    }
  });

  // Inject iframe into the page
  document.body.appendChild(iframe);
})();

