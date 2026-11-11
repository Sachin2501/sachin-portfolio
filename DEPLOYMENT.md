# Deployment & MongoDB Atlas Setup Guide
**Author:** Sachin Kumar Portfolio & Admin Studio Architecture  
**Tech Stack:** Node.js, Express, MongoDB (Atlas/Local), React, Vite

---

## भाग 1: अपने खुद के MongoDB Database से कैसे कनेक्ट करें? (MongoDB Atlas Cloud Setup)

आप इस प्रोजेक्ट को अपने खुद के **MongoDB Atlas (Free Cloud Database)** या अपने कंप्यूटर के **Local MongoDB (`mongod`)** दोनों से कनेक्ट कर सकते हैं।

### स्टेप 1: MongoDB Atlas पर फ्री क्लस्टर बनाएं
1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) पर जाएं और लॉगिन/साइन अप करें।
2. **Create a Deployment** पर क्लिक करें और **M0 (Free Shared Cluster)** चुनें (AWS/Google Cloud, Mumbai `ap-south-1` या Singapore क्षेत्र चुनें)।
3. क्लस्टर का नाम रखें (उदा: `Cluster0`) और **Create** पर क्लिक करें।

### स्टेप 2: Database User और Password सेट करें
1. Left Sidebar में **Database Access** पर जाएं।
2. **Add New Database User** पर क्लिक करें।
3. **Authentication Method:** Password चुनें।
4. एक **Username** (उदा. `sachin`) और एक स्ट्रॉन्ग **Password** दर्ज करें।
5. **Database User Privileges:** `Read and write to any database` चुनें और **Add User** पर क्लिक करें।

### स्टेप 3: Network Access (IP Whitelist) चालू करें
1. Left Sidebar में **Network Access** पर जाएं।
2. **Add IP Address** पर क्लिक करें।
3. **Allow Access from Anywhere** (`0.0.0.0/0`) चुनें और Confirm करें। *(यह आवश्यक है ताकि Vercel या Render का सर्वर बिना ब्लॉक हुए आपके डेटाबेस से जुड़ सके)*।

### स्टेप 4: Connection String कॉपी करें
1. **Clusters / Databases** पेज पर आएं और अपने क्लस्टर के सामने **"Connect"** बटन पर क्लिक करें।
2. **Drivers** (Node.js) चुनें।
3. आपको इस तरह का कनेक्शन स्ट्रिंग मिलेगा:
   ```env
   mongodb+srv://sachin:<password>@cluster0.abcde.mongodb.net/sachin_portfolio_db?retryWrites=true&w=majority
   ```
4. `<password>` की जगह अपना असली पासवर्ड डालें।

### स्टेप 5: प्रोजेक्ट में सेट करें
आप दो तरीकों से कनेक्ट कर सकते हैं:

* **तरीका A (Admin Portal UI से सीधे):**
  1. Admin Panel खोलें और **"MongoDB & Node.js"** टैब पर जाएं।
  2. "Connect to Your Own MongoDB Atlas Database" बॉक्स में अपना कनेक्शन स्ट्रिंग पेस्ट करें।
  3. **"Test & Connect MongoDB"** पर क्लिक करें। यह तुरंत लाइव क्लाउड क्लस्टर से कनेक्ट हो जाएगा और डेटा को ऑटो-सिंक कर देगा!

* **तरीका B (`.env` फाइल से):**
  प्रोजेक्ट के रूट में `.env` फाइल बनाएं और लिखें:
  ```env
  MONGODB_URI=mongodb+srv://sachin:YourPasswordHere@cluster0.abcde.mongodb.net/sachin_portfolio_db?retryWrites=true&w=majority
  ```

---

## भाग 2: क्या Portfolio Frontend और Admin Frontend को अलग-अलग डिप्लॉय कर सकते हैं?

**उत्तर: हाँ, 100% बिल्कुल!**  
यह इंडस्ट्री का सबसे बेस्ट और प्रोफेशनल तरीका (Micro-Frontend / Decoupled Architecture) है:

```
                      ┌───────────────────────────────────────────────┐
                      │             MongoDB Atlas Cloud               │
                      │     (Projects, Certifications, Messages)      │
                      └──────────────────────▲────────────────────────┘
                                             │
                                             │ MONGODB_URI
                                             │
                      ┌──────────────────────┴────────────────────────┐
                      │       1. Backend API (Node.js + Express)      │
                      │       Hosted on: Render.com / Railway.app     │
                      │       URL: https://sachin-backend.onrender.com│
                      └──────────────▲─────────────────▲──────────────┘
                                     │                 │
                VITE_API_BASE_URL    │                 │   VITE_API_BASE_URL
                                     │                 │
      ┌──────────────────────────────┴──────┐   ┌──────┴──────────────────────────────┐
      │   2. Portfolio Frontend (Public)    │   │      3. Admin Frontend (Private)     │
      │   Hosted on: Vercel / Netlify       │   │      Hosted on: Vercel / Netlify     │
      │   URL: https://sachinkumar.dev      │   │      URL: https://admin.sachinkumar.dev
      │   Folder: /src/portfolio-frontend   │   │      Folder: /src/admin-frontend     │
      └─────────────────────────────────────┘   └─────────────────────────────────────┘
```

---

### Step-by-Step Separate Deployment Guide

### चरण 1: Backend को Render.com पर डिप्लॉय करें (Free Tier)
1. अपने GitHub रिपॉजिटरी में कोड पुश करें।
2. [Render.com](https://render.com) पर लॉगिन करें और **New + &rarr; Web Service** चुनें।
3. अपना GitHub Repo कनेक्ट करें।
4. सेटिंग्स दर्ज करें:
   - **Name:** `sachin-portfolio-backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. **Environment Variables** सेक्शन में जोड़ें:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = `mongodb+srv://sachin:<password>@cluster0.abcde.mongodb.net/sachin_portfolio_db?retryWrites=true&w=majority`
   - `ADMIN_PASSCODE` = `sachin2026`
6. **Deploy Web Service** पर क्लिक करें। कुछ ही मिनटों में आपको अपना लाइव बैकएंड URL मिल जाएगा (उदा: `https://sachin-portfolio-backend.onrender.com`).

---

### चरण 2: Public Portfolio Frontend को Vercel पर डिप्लॉय करें
1. [Vercel.com](https://vercel.com) पर जाएं और **Add New... &rarr; Project** चुनें।
2. अपना GitHub Repo इम्पोर्ट करें।
3. प्रोजेक्ट का नाम रखें: `sachin-portfolio`.
4. **Build and Output Settings:**
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. **Environment Variables** में जोड़ें:
   - `VITE_API_BASE_URL` = `https://sachin-portfolio-backend.onrender.com`
6. **Deploy** पर क्लिक करें। आपका पब्लिक पोर्टफोलियो लाइव हो जाएगा (उदा: `https://sachin-portfolio.vercel.app`)!

---

### चरण 3: Admin CMS Frontend को अलग सबडोमेन पर डिप्लॉय करें
1. Vercel पर एक और नया प्रोजेक्ट बनाएं: `sachin-admin-portal`.
2. वही GitHub Repo सिलेक्ट करें।
3. **Environment Variables** में जोड़ें:
   - `VITE_API_BASE_URL` = `https://sachin-portfolio-backend.onrender.com`
   - `VITE_ADMIN_ONLY` = `true`
4. **Custom Domain:** आप Vercel Domains सेटिंग में जाकर इसे सबडोमेन दे सकते हैं:
   - `admin.sachinkumar.dev` या `sachin-admin.vercel.app`
5. अब आपका एडमिन पोर्टल पब्लिक पोर्टफोलियो से बिल्कुल अलग, सुरक्षित और प्राइवेट डोमेन पर चलेगा!

---

### इस अलग आर्किटेक्चर के फायदे:
1. **Security**: पब्लिक विजिटर्स को कभी भी एडमिन कोड या एडमिन बंडल डाउनलोड करने की जरूरत नहीं होगी।
2. **Speed & SEO**: पोर्टफोलियो का बंडल सुपर-लाइटवेट और अल्ट्रा-फास्ट रहेगा जिससे 100/100 Google Lighthouse स्कोर मिलेगा।
3. **Independent Updates**: आप पोर्टफोलियो को छुए बिना एडमिन पोर्टल में नए टूल्स जोड़ सकते हैं।
4. **Cost**: MongoDB Atlas, Render.com और Vercel तीनों के 100% Free Tiers उपलब्ध हैं, यानी 0 खर्च में आपका पूरा फुल-स्टैक सिस्टम लाइव चलेगा!
