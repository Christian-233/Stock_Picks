# Google Stitch + React App Setup Guide

## 🎯 What You're Building

A professional web experience with:
1. **Google Stitch Landing Page** - Beautiful marketing/landing page (built in Stitch)
2. **React App Dashboard** - Interactive stock prediction tool (at `/app` URL)
3. **Seamless Navigation** - Landing → App → Home

---

## 📋 Prerequisites

- ✅ Google Account (for Stitch)
- ✅ Node.js & npm installed
- ✅ AI Stock Predictor repo (already set up)
- ✅ Hosting provider (for deployment)

---

## 🚀 STEP 1: Set Up React App (Local)

### 1. Install Dependencies
```bash
cd ~/AI\ Stock\ Pick/frontend
npm install
```

### 2. Start React Development Server
```bash
npm start
```

The app will run at **http://localhost:3000/app**

✅ **You can now access:**
- Landing page: http://localhost:3000
- App dashboard: http://localhost:3000/app

---

## 🎨 STEP 2: Create Stitch Landing Page

### Option A: Import Pre-Built HTML (Fastest)

1. **Go to:** https://stitch.withgoogle.com
2. **Sign in** with Google Account
3. **Create New Site**
4. **Click:** Settings → Import
5. **Upload:** `frontend/public/landing.html` (use the file from your project)
6. **Stitch will import** the entire landing page

### Option B: Build in Stitch Manually (Custom)

1. **Create New Site** in Stitch
2. **Add Sections:** (matching landing.html)
   - Navigation bar with logo & links
   - Hero section (blue gradient background)
   - 6 Feature cards
   - Timeline with 4 "How it Works" steps
   - Stats section (4 numbers)
   - Call to Action section
   - Footer

**Use these colors:**
- Primary Blue: `#007bff`
- Dark Blue: `#0056b3`
- Light Background: `#f8f9fa`
- Text: `#1a1a1a`

---

## 🔗 STEP 3: Configure Navigation Links in Stitch

### In Stitch Site Editor:

1. **Navigation Bar → "Get Started" Button**
   - Link to: `/app`

2. **Navigation Bar → "Launch App" Button**
   - Link to: `/app`

3. **Hero Section → "Get Started" Button**
   - Link to: `/app`

4. **Hero Section → "Learn More" Button**
   - Link to: `#features`

5. **CTA Section → "Launch Dashboard" Button**
   - Link to: `/app`

---

## 🌍 STEP 4: Deploy to Production

### Option A: Deploy Both on Same Hosting (Recommended)

**Example with Vercel:**

1. **Deploy React App:**
   ```bash
   npm install -g vercel
   cd frontend
   vercel
   ```
   
   ✅ Your app is live: `https://your-app.vercel.app`

2. **Publish Stitch Site:**
   - In Stitch: **Publish** button
   - Choose custom domain: `yourdomain.com`
   - Or use Stitch provided domain

3. **Result:**
   ```
   https://yourdomain.com/          ← Stitch landing page
   https://your-app.vercel.app/app  ← React dashboard
   ```

### Option B: Same Domain (Advanced)

Use a reverse proxy or server to serve both:

```
yourdomain.com/             → Stitch site
yourdomain.com/app          → React app (routed via server)
```

**Requires:** Production server setup

### Option C: Subdomains

```
stitch.yourdomain.com/      ← Stitch landing page
app.yourdomain.com/         ← React app
```

**In Stitch:** Update all `/app` links to `https://app.yourdomain.com`

---

## 🔌 STEP 5: Update React App for Production

### Update API Endpoint

**Edit:** `frontend/.env`

```env
REACT_APP_API_URL=https://your-backend-url.com/api
PORT=3000
```

Replace `your-backend-url.com` with your actual backend domain.

### Update Stitch Links

If your app is at a different URL, update all buttons in Stitch to point to the correct URL:
- Change `/app` → `https://your-app.vercel.app/app`
- Or keep as `/app` if on same domain

---

## ✅ STEP 6: Test Everything

### Local Testing

1. **Start React:**
   ```bash
   cd frontend
   npm start
   ```

2. **Test App:**
   - Go to: http://localhost:3000/app
   - Add tickers
   - Generate predictions
   - Verify all tabs work

3. **Test Navigation:**
   - Back link returns to home
   - All features work

### Production Testing

1. **Visit landing page:**
   - https://yourdomain.com (or your Stitch domain)

2. **Click "Get Started" button**
   - Should navigate to app

3. **Use app features:**
   - Predictions
   - News
   - Algorithm
   - Weights

4. **Click back link (← in header)**
   - Should return to landing page

---

## 🎛️ Customization Options

### Change App Header Back Link

**Edit:** `frontend/src/App.js`

```javascript
<a href="/" className="back-link" title="Back to home">←</a>
```

Change `href="/"` to point to your landing page URL:
```javascript
<a href="https://yourdomain.com" className="back-link">←</a>
```

### Change Colors in React

**Edit:** `frontend/src/App.css`

```css
:root {
  --primary-color: #007bff;
  --primary-dark: #0056b3;
  --background-light: #f8f9fa;
}
```

Use the same colors as your Stitch site.

### Customize Landing Page

The HTML is at: `frontend/public/landing.html`

You can:
- Edit text/headings
- Change colors
- Add/remove feature cards
- Add images
- Modify footer

---

## 📊 Analytics Setup

### Google Analytics in Stitch

1. **Stitch Settings → Analytics**
2. **Add Google Analytics ID**
3. **Track events:**
   - Landing page views
   - "Launch App" clicks
   - CTA button clicks

### Analytics in React App

1. **Edit:** `frontend/src/index.js`

2. **Add Analytics:**
   ```javascript
   import ReactGA from 'react-ga';
   
   ReactGA.initialize('GA_ID');
   ReactGA.pageview('/app');
   ```

3. **Track events:**
   ```javascript
   ReactGA.event({
     category: 'Predictions',
     action: 'Generated Prediction'
   });
   ```

---

## 🚨 Troubleshooting

### Links Not Working

**Problem:** Clicking "Launch App" doesn't go anywhere

**Solution:**
1. Check the button link in Stitch (should be `/app` or full URL)
2. Verify React app is running
3. If different domains, update link to full URL

### Styling Mismatch

**Problem:** Landing page looks different from React app

**Solution:**
1. Use same color codes everywhere
2. Use same fonts (Inter)
3. Test on mobile devices
4. Update CSS variables in React

### Backend Not Connecting

**Problem:** App can't reach backend API

**Solution:**
1. Check `REACT_APP_API_URL` in frontend `.env`
2. Verify backend is running/deployed
3. Check CORS settings in backend
4. Use full URL if on different domains

### Performance Issues

**Solution:**
1. Optimize images in Stitch
2. Enable caching in browser
3. Minimize CSS/JS bundles
4. Use CDN for static assets

---

## 🔒 SSL/HTTPS Setup

### Required for Production

1. **Get SSL Certificate**
   - Let's Encrypt (free)
   - AWS Certificate Manager
   - CloudFlare (free tier)

2. **Configure in Hosting Provider**
   - Enable HTTPS
   - Redirect HTTP → HTTPS

3. **Test:**
   - Visit `https://yourdomain.com`
   - Should be secure (lock icon)

---

## 📱 Responsive Design

Both Stitch and React are mobile-responsive!

### Test on Mobile:
- iPhone (375px width)
- iPad (768px width)
- Android devices
- Desktop (1920px width)

### Check:
- ✅ Navigation works on mobile
- ✅ Feature cards stack properly
- ✅ Buttons are tap-friendly
- ✅ Text is readable

---

## 🔄 Workflow Summary

```
┌─────────────────────────────────────────┐
│  User visits landing page (Stitch)     │
├─────────────────────────────────────────┤
│  1. Sees features and stats             │
│  2. Clicks "Get Started" button         │
├─────────────────────────────────────────┤
│  3. Navigates to React app (/app)      │
├─────────────────────────────────────────┤
│  4. Uses dashboard:                     │
│     - Manages tickers                   │
│     - Generates predictions             │
│     - Views news                        │
│     - Adjusts algorithm                 │
├─────────────────────────────────────────┤
│  5. Clicks ← back link                  │
├─────────────────────────────────────────┤
│  6. Returns to landing page             │
└─────────────────────────────────────────┘
```

---

## ✨ Final Checklist

Before going live:

- [ ] Google Stitch account created
- [ ] Landing page imported/built in Stitch
- [ ] All navigation links configured
- [ ] React app deployed
- [ ] Backend API deployed
- [ ] Environment variables (.env) configured
- [ ] Colors match between Stitch and React
- [ ] Typography consistent
- [ ] Mobile responsive tested
- [ ] Analytics configured
- [ ] HTTPS/SSL enabled
- [ ] Domain configured
- [ ] All buttons tested
- [ ] Back link works
- [ ] API calls successful
- [ ] Performance optimized

---

## 📞 Support

**Need help?**
- Stitch docs: https://support.google.com/stitch
- React docs: https://react.dev
- Setup issues: See `QUICKSTART.md`
- Config help: See `CONFIG.md`
- Integration guide: See `STITCH_INTEGRATION.md`

---

## 🎉 You're Ready!

Your complete Stitch + React stock prediction system is ready to launch.

**Next Steps:**
1. Create Google Stitch account
2. Import landing page
3. Deploy React app
4. Configure links
5. Go live!

**Happy launching! 🚀**
