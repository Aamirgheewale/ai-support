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

  // Set iframe attributes
  iframe.id = 'ai-widget-iframe';
  iframe.src = WIDGET_URL;
  iframe.setAttribute('allow', 'microphone; camera');
  iframe.setAttribute('frameborder', '0');

  // Apply default styling (Closed State)
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.right = '20px';
  iframe.style.width = '360px';
  iframe.style.height = '600px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '999999';
  iframe.style.boxShadow = 'none';
  iframe.style.background = 'transparent';

  // Inject iframe into the page
  document.body.appendChild(iframe);
})();

