# SEEN - NFT Gallery

Clean, working rebuild of SEEN for Vercel deployment.

## Structure

```
seen-rebuild/
├── api/                    # Serverless functions
│   ├── index.js           # Main API handler
│   └── alchemy.js         # Alchemy SDK service
├── src/                    # React frontend
│   ├── main.jsx
│   ├── App.jsx
│   ├── Gallery.jsx
│   ├── Gallery.css
│   ├── Admin.jsx
│   ├── Admin.css
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "SEEN rebuild"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

### 2. Import to Vercel

1. Go to vercel.com
2. Click "Import Project"
3. Select your GitHub repo
4. Vercel will auto-detect settings

### 3. Add Neon Postgres

1. In Vercel project → Storage → Create Database
2. Select "Neon" (Serverless Postgres)
3. Name it (e.g., "seen-db")
4. Click Create

### 4. Add Environment Variables

In Vercel → Settings → Environment Variables:

```
ALCHEMY_API_KEY=eprkUYTWwDDqT9DOnqAvt-l4z
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123
```

(POSTGRES_URL is auto-added by Neon)

### 5. Deploy

Click "Deploy" - that's it!

## Usage

### Public Gallery
Visit: `https://your-app.vercel.app/`

### Admin Panel
1. Visit: `https://your-app.vercel.app/admin`
2. Login with credentials from env vars
3. Add keyword (e.g., "manifold", "generative art")
4. Click "ACTIVATE" to fetch NFTs
5. View gallery to see rotating artwork

## Features

✅ Pure black/white design
✅ 8-second fade transitions
✅ No transactional elements
✅ Artist attribution only
✅ Admin panel for keywords
✅ Analytics tracking
✅ Serverless architecture
✅ Works on Vercel out of the box

## No Bullshit

- Single repo
- No nested client/server folders
- Vite builds everything
- API routes as serverless functions
- Postgres for persistence
- That's it.
