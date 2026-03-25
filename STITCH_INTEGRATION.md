# Using Google Stitch with AI Stock Predictor

## Overview

This guide explains how to integrate Google Stitch with your React AI Stock Predictor application to create a professional landing page with embedded app functionality.

## Architecture

```
Google Stitch (Landing Page + Branding)
        ↓
    Navigation/Links
        ↓
React App (Dashboard + Functionality)
```

## Step 1: Import Landing Page into Stitch

### Option A: Use the Pre-Built HTML
1. Open [stitch.withgoogle.com](https://stitch.withgoogle.com)
2. Create a new site
3. Go to **Settings → Import**
4. Upload `landing.html` from `frontend/public/landing.html`

### Option B: Build in Stitch
1. Create a new Stitch site
2. Add sections matching `landing.html`:
   - Navigation bar
   - Hero section
   - Features grid (6 cards)
   - How it works timeline
   - Stats section
   - Call-to-action section
   - Footer

## Step 2: Configure Navigation Links

In your Stitch site:

1. **"Get Started" button** → Points to `/app`
2. **"Launch App" button** → Points to `/app`
3. **All CTA buttons** → Point to `/app`

These links will navigate to your React dashboard.

## Step 3: Deploy React App

### Local Setup
```bash
cd frontend
npm install
npm start
```

The React app runs at `http://localhost:3000`

### Production Deployment

**Option 1: Same Domain**
```
https://yourdomain.com/         ← Stitch landing page
https://yourdomain.com/app      ← React app
```

**Option 2: Subdomain**
```
https://stitch.yourdomain.com/  ← Stitch landing page
https://app.yourdomain.com/     ← React app
```

**Option 3: Embedded iFrame**
```html
<!-- In Stitch, add an embed block with: -->
<iframe src="https://yourappurl.com" 
        width="100%" 
        height="800px"
        style="border: none;"></iframe>
```

## Step 4: Style Consistency

### Stitch Design → React App
Use the same color scheme across both:

**Primary Colors** (from landing page):
```
Blue: #007bff
Dark Blue: #0056b3
Light Background: #f8f9fa
Text: #1a1a1a
```

**Update React Components** to match:
Edit `frontend/src/App.css`:
```css
:root {
  --primary-color: #007bff;
  --primary-dark: #0056b3;
  --background-light: #f8f9fa;
  --text-primary: #1a1a1a;
}
```

## Step 5: Navigation Flow

### Landing Page (Stitch)
Users land here first:
- Learn about features
- See how it works
- View stats
- Click "Launch App" → Goes to React dashboard

### React App Dashboard
Located at `/app`:
- Predictions Tab
- News Tab
- Algorithm Tab
- Weights History Tab

### Return to Landing
Add a link in React app header:
```javascript
<a href="/">← Back to Home</a>
```

## Step 6: Domain Configuration

### For Production:

**Option A: Stitch Primary, React Subdomain**
```
yourdomain.com          → Stitch sites domain
app.yourdomain.com      → React app (separate deployment)
```

**Option B: Subdirectory**
```
yourdomain.com/         → Stitch landing page
yourdomain.com/app      → React app (requires server routing)
```

**Option C: Different Domains**
```
landing.yourdomain.com  → Stitch
app.yourdomain.com      → React
```

## Deployment Checklist

- [ ] Stitch site created with landing page
- [ ] Navigation links point to React app URL
- [ ] React app deployed and accessible
- [ ] Colors/fonts match between Stitch and React
- [ ] All CTA buttons link to React app
- [ ] Footer links configured
- [ ] Mobile responsive tested
- [ ] CORS configured if on different domains

## Stitch Features to Use

### Design Elements
- ✅ Hero section with gradient
- ✅ Feature cards grid
- ✅ Timeline/steps section
- ✅ Statistics showcase
- ✅ Call-to-action section
- ✅ Navigation bar
- ✅ Footer

### Stitch Capabilities
- Drag-and-drop builder
- Built-in SEO tools
- Mobile responsive
- Analytics integration
- Form handling
- Image optimization
- Custom domain support

## SEO Optimization in Stitch

1. **Page Title**: "AI Stock Predictor - Intelligent Stock Predictions"
2. **Meta Description**: "AI-powered stock prediction with news analysis and algorithm optimization"
3. **Keywords**: Stock predictions, AI trading, financial analysis
4. **Alt Text**: Add to all feature/timeline images
5. **URL Structure**: Use clean URLs

## Analytics

### Google Analytics Setup
```javascript
<!-- Add to Stitch head section -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

### Track Events
- Landing page views
- App launch clicks
- Feature section engagement
- CTA button clicks

## Troubleshooting

### Links Not Working
- Verify `/app` route exists in React
- Check domain/subdomain configuration
- Test CORS settings if different domains

### Styling Inconsistencies
- Use same fonts (Inter) everywhere
- Ensure color codes match
- Test on mobile devices

### Performance
- Optimize Stitch images
- Use lazy loading
- Cache React app assets
- Minimize CSS/JS

## Example Stitch Site Structure

```
Header (Navigation)
├─ Logo
├─ Links: Features, How It Works, About
└─ CTA Button: Launch App

Hero Section
├─ Headline
├─ Subtitle
└─ Two Buttons: Get Started, Learn More

Features Section
├─ 6 Feature Cards (Grid)
│  ├─ Icon
│  ├─ Title
│  └─ Description
└─ View All Features Link

How It Works Section
├─ Timeline with 4 Steps
│  ├─ Step 1: Monday Morning
│  ├─ Step 2: Daily Updates
│  ├─ Step 3: Wed & Fri Checks
│  └─ Step 4: Learn & Improve
└─ Download PDF Guide

Stats Section
├─ 4 Statistics
│  ├─ 5 Factor Analysis
│  ├─ Infinite Tickers
│  ├─ Daily Updates
│  └─ Real-Time Accuracy
└─ View Full Analytics

CTA Section
├─ Headline
├─ Subheading
└─ Call-to-Action Button

Footer
├─ Copyright
├─ Links: Privacy, Terms, Contact
└─ Social Icons
```

## Next Steps

1. Create Stitch account at https://stitch.withgoogle.com
2. Import or build landing page
3. Deploy React app to production
4. Link Stitch navigation to React app
5. Test full user flow
6. Set up analytics
7. Monitor traffic and engagement

---

For React app setup, see: `QUICKSTART.md`
For API configuration, see: `CONFIG.md`
