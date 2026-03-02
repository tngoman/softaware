# React App Deployment Guide

## Production Deployment Steps

### 1. Build the Application
```bash
cd react-app
npm run build
```

This creates an optimized production build in the `build/` directory.

### 2. Deploy to Production Server

#### Option A: Deploy to Document Root
If deploying to the root domain (e.g., `https://billing.softaware.co.za/`):

1. Upload all contents of `build/` directory to your web server's document root
2. Ensure `.htaccess` file is included (handles client-side routing)

#### Option B: Deploy to Subdirectory
If deploying to a subdirectory (e.g., `https://example.com/billing/`):

1. Update `package.json` homepage field:
   ```json
   {
     "homepage": "/billing"
   }
   ```

2. Rebuild the app:
   ```bash
   npm run build
   ```

3. Upload `build/` contents to `/billing/` directory on server

### 3. Server Configuration

#### Apache (.htaccess)
The `.htaccess` file is automatically included in the build. It handles:
- Client-side routing (redirects all routes to index.html)
- Excludes API routes from rewriting
- Security headers
- Asset caching
- Compression

**Verify .htaccess is working:**
- Refresh any route (e.g., `/login`, `/contacts`) - should work without 404

#### Nginx Configuration
If using Nginx instead of Apache, add this to your server block:

```nginx
server {
    listen 80;
    server_name billing.softaware.co.za;
    root /path/to/build;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for HTML
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

### 4. Environment Configuration

The app automatically detects the environment:

**Local Development:**
- Uses `http://billing.host/api`

**Production:**
- Dynamically constructs API URL based on current domain
- Example: `https://billing.softaware.co.za` → API: `https://billing.softaware.co.za/api`

**Custom API URL:**
Set via Admin Settings in the app:
1. Go to Settings > Application Settings
2. Set "Site Base URL" (e.g., `https://billing.softaware.co.za/api`)

### 5. Verify Deployment

Test these scenarios:

1. **Home page loads:** `https://billing.softaware.co.za/`
2. **Direct navigation works:** `https://billing.softaware.co.za/login`
3. **Refresh on any route works:** Navigate to `/contacts`, then refresh
4. **API calls work:** Login and check network tab
5. **Assets load:** Check logo and images
6. **Routing works:** Click through different pages

### 6. Troubleshooting

**404 on refresh:**
- ✅ Fixed! `.htaccess` file handles this
- Verify `.htaccess` is in the deployed directory
- Check Apache has `mod_rewrite` enabled: `sudo a2enmod rewrite`
- Ensure `AllowOverride All` in Apache config

**API calls fail:**
- Check browser console for CORS errors
- Verify API is accessible at the constructed URL
- Check Settings > Application Settings > Site Base URL

**Blank page:**
- Check browser console for errors
- Verify all files uploaded correctly
- Check homepage field in package.json matches deployment path

**Assets not loading:**
- Check file paths in browser network tab
- Verify images are in `build/images/` directory
- Check CORS headers if assets on different domain

### 7. Post-Deployment Checklist

- [ ] App loads on production URL
- [ ] All routes work (including refresh)
- [ ] Login functionality works
- [ ] API calls successful
- [ ] Images and assets load
- [ ] Navigation works smoothly
- [ ] No console errors
- [ ] HTTPS enabled and working
- [ ] Performance acceptable (check Lighthouse score)
- [ ] Mobile responsive

### 8. Updates and Redeployment

When making changes:

1. Update code in `src/`
2. Run `npm run build`
3. Upload new `build/` contents to server
4. Clear browser cache if needed

**Note:** The `.htaccess` is regenerated on each build, so any manual changes will be lost.

## Additional Notes

### Homepage Field
In `package.json`, the `homepage` field controls the base path:

```json
// Root deployment
"homepage": "/"

// Subdirectory deployment
"homepage": "/billing"

// Full URL (not recommended - use for CDN)
"homepage": "https://cdn.example.com/app"
```

### CDN Deployment
For assets on CDN, update `homepage` to CDN URL and deploy build files to CDN.

### Environment Variables
Create `.env.production` for production-specific settings:

```env
REACT_APP_API_URL=https://billing.softaware.co.za/api
```

Then use in code:
```typescript
const apiUrl = process.env.REACT_APP_API_URL || getApiBaseUrl();
```
