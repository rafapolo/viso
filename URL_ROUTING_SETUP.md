# URL Routing Setup Guide

## Overview

The application now supports shareable URLs with the following structure:
- **Deputados**: `/deputado/{nome}-{partido}` (e.g., `/deputado/fulano-de-tal-pt`)
- **Empresas**: `/empresa/{nome}` (e.g., `/empresa/empresa-exemplo-ltda`)

## Server Configuration Required

Since this is a Single Page Application (SPA), the web server must be configured to serve `index.html` for all routes that don't correspond to actual files.

### For Development (Vite)

If using Vite (which appears to be the case based on the build setup), add this to your `vite.config.js`:

```javascript
export default {
  // ... other config
  server: {
    historyApiFallback: true
  }
}
```

### For Production Deployment

#### Apache (.htaccess)
```apache
RewriteEngine On
RewriteRule ^(deputado|empresa)/.*$ /index.html [L]
```

#### Nginx
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

#### Node.js/Express
```javascript
app.get(['/deputado/*', '/empresa/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});
```

## How It Works

1. **URL Generation**: When a user clicks on a node, the app generates a path-based URL using `history.pushState()`
2. **Direct Navigation**: When someone visits a URL like `/deputado/fulano-pt`, the app parses the path and automatically selects the corresponding node
3. **Backward Compatibility**: Old fragment-based URLs (`#parlamentar-fulano-pt`) still work
4. **Browser Navigation**: Back/forward buttons work correctly with the new routing system

## URL Structure Details

### Deputado URLs
- Format: `/deputado/{name}-{party}`
- Name and party are slugified (lowercase, spaces become hyphens, special characters removed)
- Example: "FULANO DE TAL (PT)" becomes `/deputado/fulano-de-tal-pt`

### Empresa URLs  
- Format: `/empresa/{company-name}`
- Company name is slugified and truncated to 50 characters
- Example: "Empresa Exemplo LTDA" becomes `/empresa/empresa-exemplo-ltda`

## Testing

You can test the routing by:
1. Clicking on any node to see the URL change
2. Copying the URL and opening it in a new tab
3. Using browser back/forward buttons
4. Testing with old fragment URLs for backward compatibility