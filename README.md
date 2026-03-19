# 🗑️ Smart Waste Management System V2

AI-powered urban waste monitoring and collection optimization system.
Built for **India Innovates 2026** by **Algorithmic Thunder Squad**.

## 🚀 Features
- Real-time dustbin monitoring via IoT sensors
- YOLOv8 AI waste classification (82% accuracy)
- Dynamic route optimization using TSP + OR-Tools
- Live GPS fleet tracking
- Citizen complaint reporting
- WebSocket real-time dashboard

## 🛠️ Tech Stack
- **Backend**: FastAPI + SQLite + SQLAlchemy
- **AI**: YOLOv8n (trained on 469 images)
- **Frontend**: React + Vite + Leaflet
- **Mobile**: React Native + Firebase
- **IoT**: ESP32 + Raspberry Pi

## 🏃 Quick Start

### Backend
cd smart-waste-backend-v2
pip install -r requirements.txt
python seed_admin.py
python main.py

### Dashboard
cd waste-dashboard
npm install
npm run dev

### IoT Simulator
cd smart-waste-backend-v2
python simulate_iot.py

## 🔑 Demo Login
- URL: http://localhost:5173
- Email: admin@smartwaste.city.in
- Password: admin123

## 👥 Team
Algorithmic Thunder Squad
- Sohit Narayan
- Nikhil Gupta
- Ankush
- Harsh Saini
- Naman Singla
- Arghadeep Das

## 📊 Results
- AI Accuracy: 82% overall
- Fuel Reduction: 35%
- CO2 Saved: 180kg/month
- Cost Saved: ₹8,400/month
