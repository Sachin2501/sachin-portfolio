# Complete Setup, GitHub Upload & Deployment Guide (Vercel & Render)

Portfolio & Admin Portal (React + Vite + Tailwind CSS + Node.js Express + MongoDB) ko GitHub pe upload karne aur Vercel ya Render par deploy karne ka step-by-step complete guide.

---

## 1. Project Architecture Overview

Aapka project do tarike se deploy ho sakta hai:
- **Option A (Sabse Aasan & Recommended - Full-Stack on Render)**:
  Single Web Service jisme Express Server (`server.js`) frontend static build (`dist/`) ko serve karta hai aur saari `/api/*` requests ko MongoDB ke saath handle karta hai. Zero CORS issue!
- **Option B (Decoupled - Frontend on Vercel + Backend on Render)**:
  - Frontend SPA Vite build Vercel par host hoti hai.
  - Backend Node.js Express API Render par host hoti hai.
  - Frontend me `VITE_API_BASE_URL=https://your-backend.onrender.com` set kiya jata hai.

---

## 2. GitHub Par Upload Karne Ka Step-by-Step Method

### Step 2.1: Prerequisites
- Git installed hona chahiye (`git --version`)
- GitHub account hona chahiye ([github.com](https://github.com))

### Step 2.2: Local Project me Git Initialize & Commit karein
Apne project ke root folder me terminal open karke ye commands chalayein:

```bash
# 1. Git repository initialize karein
git init

# 2. Main branch set karein
git branch -M main

# 3. .gitignore verify karein (node_modules aur .env push nahi honge)
# Humne .gitignore pehle se setup kar diya hai

# 4. Saari files stage karein
git add .

# 5. Pehla production commit create karein
git commit -m "feat: complete responsive portfolio & admin portal with mongo audit logs"
```

### Step 2.3: GitHub Par Naya Repository Banayein
1. [github.com/new](https://github.com/new) par jayein.
2. **Repository name** enter karein (e.g. `sachin-portfolio` ya `portfolio-admin`).
3. Repository ko **Public** ya **Private** select karein.
4. **"Initialize this repository with a README" ko UNCHECK rakhein** (kyunki hamare paas already local code hai).
5. **Create repository** button par click karein.

### Step 2.4: Local Code ko GitHub pe Push karein
GitHub repo page se remote URL copy karke terminal me ye run karein (apna username aur repo name replace karein):

```bash
# GitHub remote add karein
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# Code push karein
git push -u origin main
```

---

## 3. Render Par Full-Stack Deploy Kaise Karein (Recommended)

Render par aapka complete project (Frontend + Node.js Backend API + MongoDB) ek hi free URL par deploy ho jata hai.

### Step 3.1: MongoDB Atlas (Cloud Database) Free Cluster Setup
1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) par free account banayein ya login karein.
2. **Create a Database** -> **M0 Free Tier** select karein.
3. **Database Access** me jakar ek Database User banayein (Username: `admin`, ek strong Password set karein).
4. **Network Access** me jakar IP Access List me `0.0.0.0/0` (Allow Access from Anywhere) add karein.
5. **Database** -> **Connect** -> **Drivers** -> Connection string copy karein:
   ```
   mongodb+srv://admin:<password>@cluster0.abcde.mongodb.net/sachin_portfolio_db?retryWrites=true&w=majority
   ```

### Step 3.2: Render Web Service Banayein
1. [dashboard.render.com](https://dashboard.render.com) par login karein.
2. **New +** button click karein aur **Web Service** select karein.
3. **Build and deploy from a Git repository** choose karke apna GitHub repository connect karein.
4. Settings fill karein:
   - **Name**: `sachin-portfolio`
   - **Region**: Singapore ya Frankfurt (closest to India)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Instance Type**: `Free`

5. **Environment Variables** section me jakar ye variables add karein:
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (ya blank chhod de, Render auto-assign karta hai) |
   | `MONGODB_URI` | *Aapki MongoDB Atlas connection string* |
   | `ADMIN_PASSCODE` | *Aapka secure master passcode* |

6. **Create Web Service** par click karein.
   - Render automatically `npm install` karega, `vite build` se `dist/` generate karega, aur `server.js` start karega.
   - Kuch minute me aapko live URL mil jayega (e.g. `https://sachin-portfolio.onrender.com`).
   - Is URL par frontend bhi chalega, aur `/admin` par secure admin portal bhi!

---

## 4. Vercel Par Frontend Deploy Kaise Karein (Option B)

Agar aap frontend ko Vercel ki global edge network par chalana chahte hain:

### Step 4.1: Vercel Project Import karein
1. [vercel.com](https://vercel.com) par GitHub se login karein.
2. **Add New...** -> **Project** par click karein.
3. Apna GitHub repository select karein aur **Import** click karein.

### Step 4.2: Build Settings Configure karein
Vercel automatically project ko Vite detect kar lega (`vercel.json` already added hai):
- **Framework Preset**: `Vite`
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 4.3: Environment Variables Set karein
**Environment Variables** dropdown open karein aur add karein:
- **Key**: `VITE_API_BASE_URL`
- **Value**: `https://your-backend-app.onrender.com` (Render par bani hui backend API ka URL)

### Step 4.4: Deploy Click karein
- **Deploy** button click karein.
- 1 minute ke andar aapka portfolio Vercel URL (e.g. `https://sachin-portfolio.vercel.app`) par live ho jayega.
- Client-side navigation (`/admin`, etc.) `vercel.json` ke rewrites rule ki wajah se smoothly work karegi without 404 errors.

---

## 5. Deployment Verification Checklist

Deploy hone ke baad ye test karein:
1. **Frontend Portfolio Home Page**:
   - Check all sections (Hero, About, Tech Stack, Github Contribution graph, Projects, Experience, Certifications, Contact).
   - Responsive check: Mobile (320px–480px), Tablet (768px), aur Desktop.
2. **Contact Form**:
   - Test message send karein -> Check karein ki Admin Portal me receive ho raha hai.
3. **Admin Portal (`/admin`)**:
   - Admin Login / Master Access verify karein.
   - Projects me Add / Edit / Delete test karein.
   - Experience me Add / Edit / Delete test karein.
   - **Audit Logs** tab me verify karein ki har action ka user, timestamp aur diff trail record ho raha hai.
   - Mobile responsive bottom bar & drawer test karein.

---

## 6. Common Issues & Solutions

1. **Vercel me 404 on Refreshing `/admin`**:
   - Solution: Humne root me `vercel.json` rewrite file create kar di hai jo sabhi routes ko `index.html` par point karti hai.
2. **CORS Error (Frontend on Vercel, Backend on Render)**:
   - Solution: Backend me `cors` middleware pehle se configured hai jo credentials aur dynamic origins allow karta hai.
3. **Render Sleep on Free Tier**:
   - Render Free tier par 15 minutes inactive rehne par service sleep hoti hai aur first request par 30-50 seconds cold start leti hai. Isko active rakhne ke liye [cron-job.org](https://cron-job.org) ya [uptimerobot.com](https://uptimerobot.com) se free ping lagaya ja sakta hai.
