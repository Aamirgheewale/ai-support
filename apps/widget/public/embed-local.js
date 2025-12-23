/**
 * AI Support Widget Embed Script - LOCAL VERSION
 * This script injects the chat widget into any website via an iframe.
 * Use this for local testing only!
 */

(function() {
  'use strict';

  // Configuration - LOCAL TESTING
  const WIDGET_URL = 'http://localhost:5173/'; // Change to your local widget URL

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
  iframe.setAttribute('allowtransparency', 'true');

  // Apply default styling (Closed State - small bubble size)
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.right = '20px';
  iframe.style.width = '90px';
  iframe.style.height = '90px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '999999';
  iframe.style.boxShadow = 'none';
  iframe.style.backgroundColor = 'transparent';
  iframe.style.background = 'transparent';
  iframe.style.colorScheme = 'none';
  iframe.style.transition = 'width 0.3s ease, height 0.3s ease';

  // Listen for messages from the iframe to resize it
  window.addEventListener('message', function(event) {
    // Security: Verify origin if needed (optional but recommended)
    // For local testing, we allow all origins
    // if (event.origin !== 'http://localhost:5173') return;
    
    if (event.data === 'chat-opened') {
      // Resize iframe to full chat widget size
      iframe.style.width = '400px';
      iframe.style.height = '680px';
      iframe.style.border = 'none';

    } else if (event.data === 'chat-closed') {
      // Resize iframe back to small bubble size
      iframe.style.width = '90px';
      iframe.style.height = '100px';
      iframe.style.border = '2px solid red';

    }
  });

  // Inject iframe into the page
  document.body.appendChild(iframe);
})();

