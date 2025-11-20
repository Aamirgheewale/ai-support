# Embedding AI Support Widget

## Building the Embeddable Widget

To build the widget as a standalone library:

```bash
cd apps/widget
pnpm build
```

This creates `dist/ai-support-widget.umd.js` and `dist/ai-support-widget.es.js`.

## Embedding in Customer Sites

### Option 1: Direct Script Tag

```html
<div id="ai-support-widget"></div>

<script src="https://yourcdn.com/ai-support-widget.umd.js"></script>
<script>
  AiSupportWidgetInit({
    targetId: 'ai-support-widget',
    apiBase: 'https://api.yoursite.com',
    initialSessionId: 'optional-session-id'
  });
</script>
```

### Option 2: With Data Attributes (Auto-init)

```html
<div id="ai-support-widget"></div>

<script 
  src="https://yourcdn.com/ai-support-widget.umd.js"
  data-target-id="ai-support-widget"
  data-api-base="https://api.yoursite.com"
  data-session-id="optional-session-id"
></script>
```

## Theme Customization

Themes are applied via CSS variables. Set theme on the backend:

```javascript
POST /session/:sessionId/theme
{
  "themeVars": {
    "primary-color": "#667eea",
    "secondary-color": "#764ba2",
    "background": "#ffffff"
  }
}
```

The widget will automatically fetch and apply themes when a session starts.

