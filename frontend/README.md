# 🇮🇳 MGNREGA Data Insights Dashboard

A full-stack analytics dashboard for visualizing **MGNREGA (Mahatma Gandhi National Rural Employment Guarantee Act)** program statistics.  
This system fetches live MGNREGA data, stores it in PostgreSQL, and presents interactive insights at the district level.

---

## 🚀 Features

### 🔄 Backend (Node.js + Express + PostgreSQL)
- Real-time government data sync
- Cron-based auto updater
- PostgreSQL + JSONB storage
- Redis caching (optional)
- Winston logging
- Secure ENV config
- PM2 process manager

### 📊 Frontend (React + Tailwind)
- Responsive dashboard UI
- State-level & district-level visualizations
- Auto district detection by location
- Filters + Search
- Charts & metrics widgets

### ☁️ Deployment
- AWS EC2 (Ubuntu)
- PM2 for auto-restart & logs
- Nginx optional

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
Frontend | React, Tailwind, Axios, Lucide Icons  
Backend | Node.js, Express, Axios, Winston, PM2  
Database | PostgreSQL (JSONB support)  
Cache *(optional)* | Redis  
Deployment | AWS EC2 + Ubuntu + PM2  

---

## 📁 Folder Structure

PROJECT/
├─ backend/
│  ├─ server.js
│  ├─ .env
│  └─ package.json
└─ frontend/
├─ src/
└─ package.json

---

## ⚙️ Installation Guide

### 1️⃣ Clone Repo

```bash
git clone https://github.com/your-username/mgnrega-dashboard.git
cd mgnrega-dashboard

2️⃣ Backend Setup
cd backend
npm install

Create .env file:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mgnrega_db
DB_USER=mgnrega_user
DB_PASSWORD=YOUR_SECURE_PASSWORD
PORT=3001
TARGET_STATE="UTTAR PRADESH"

Run backend:
pm2 start server.js --name mgnrega-app
pm2 save


3️⃣ Frontend Setup
cd frontend
npm install
npm run build

Serve build:
npx serve -s build -l 3000

Or configure with Nginx.

📡 API Endpoints
MethodEndpointDescriptionGET/api/districtsList districtsGET/api/state-summaryState-level summaryGET/api/district/:nameSingle district metrics

🧾 Database Table (mgnrega_data)
ColumnTypeDescriptionfin_yearTEXTFinancial yearstate_nameTEXTStatedistrict_nameTEXTDistrictavg_wage_rateNUMERICWage ratetotal_workersNUMERICTotal workersdata_payloadJSONBRaw payload


many more attributes…



📌 Commands
PM2
pm2 restart mgnrega-app
pm2 status
pm2 logs mgnrega-app --lines 50
pm2 save


🧪 Testing
Open browser:
http://YOUR-EC2-IP

Hard refresh cache:
CTRL + SHIFT + R

📸 Screenshots (add later)

Coming soon…


🛤 Roadmap


✅ UP state dashboard


🔜 Multi-state support


🔜 Export PDF, Excel


🔜 Forecast demand using ML



👨‍💻 Author
Hemant Kumar
Full-Stack Developer & AI Enthusiast

📜 License
MIT License — free to use & modify.

⭐ Contributing
PRs welcome — improve & submit 🚀

🙌 Credits


Govt. of India — MGNREGA Public Data Portal


PostgreSQL Community


TailwindCSS, React, Node.js



Want extras?
Comment and I will give you:
✅ Deployment Guide (EC2 + PM2 + Nginx)
✅ PPT + Project Report PDF
✅ ER Diagram
✅ API Docs


If this project helped you — star ⭐ the repo!


---

### ✅ You're good to paste this directly into GitHub.

Would you like:

- [ ] `deployment_guide.md`
- [ ] `architecture_diagram.png`
- [ ] `DB_schema.sql`
- [ ] `project_presentation.pptx`
- [ ] `Screenshots + GIF layout`

Tell me which ones you want & I’ll generate!
