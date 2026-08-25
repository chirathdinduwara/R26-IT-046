# 🌍 Geonix — Geo-Based Smart Environmental Warning System

> A full-stack mobile application delivering real-time, location-aware warnings for floods, dengue outbreaks, paddy crop advisories, and safe route navigation — keeping communities informed and protected.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Modules](#modules)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Mobile App Setup](#mobile-app-setup)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Geonix** is a geolocation-driven smart warning platform built as part of research project **R26-IT-046**. It combines a Python-powered prediction and advisory API with a cross-platform React Native mobile application to deliver four critical, location-specific services to users in real time.

The platform is designed to:

- Warn users about flood risks and dengue outbreak zones near their location
- Advise paddy farmers on crop health, disease, and seasonal conditions
- Guide users through safe routes that avoid hazardous or high-risk areas
- Empower communities and authorities with actionable, geo-referenced intelligence

---

## Modules

### 🌊 Flood Prediction

Analyses rainfall, river levels, and geographic data to predict flood risk zones. Users receive proactive alerts when their location enters a high-risk area, with severity levels and expected impact zones visualised on a map.

### 🦟 Dengue Warning

Monitors epidemiological data to detect and forecast dengue outbreak hotspots. The system generates risk scores based on the user's GPS location and highlights affected areas with colour-coded risk levels (low / moderate / high).

### 🌾 Paddy Advisory

Provides location-specific agricultural advisories for paddy farmers. Recommendations cover crop disease alerts, optimal irrigation timing, pest warnings, and seasonal best practices — all driven by local environmental and weather data.

### 🛡️ Safe Routes

Calculates and displays navigation routes that avoid flood zones, dengue hotspots, and other identified hazards. Users can request safe route guidance between two points, with the system dynamically re-routing around active risk areas.

---

## Project Structure

```
R26-IT-046/
├── Geonix-backend/                 # Python backend services
│   ├── dengue-warning/
│   │   └── api/                    # Dengue warning & risk scoring API
│   │       └── .env.example
│   ├── flood-prediction/           # Flood risk prediction service
│   ├── paddy-advisory/             # Paddy crop advisory service
│   ├── safe-routes/                # Safe route computation service
│   ├── .venv/                      # Python virtual environment (not committed)
│   └── __pycache__/
│
├── Geonix-mobile/                  # React Native (Expo) mobile app
│   ├── src/
│   │   ├── screens/                # App screens (Home, Map, Advisory, Routes…)
│   │   ├── components/             # Reusable UI components
│   │   └── services/               # API service layer
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| Mobile App        | React Native · Expo                 |
| Backend API       | Python (FastAPI / Flask)            |
| Geolocation       | Device GPS · Map integration        |
| Prediction Engine | Python ML models                    |
| Package Manager   | npm / yarn (mobile) · pip (backend) |

---

## Getting Started

### Prerequisites

- **Node.js** v18+ and npm
- **Python** 3.10+
- **Expo CLI** — `npm install -g expo-cli`
- A physical device or emulator for mobile testing

---

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd Geonix-backend

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
.venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp dengue-warning/api/.env.example dengue-warning/api/.env
# Edit the .env file with your configuration

# 5. Start the desired API service (example: dengue warning)
cd dengue-warning/api
python main.py
```

Repeat step 5 for each service module (`flood-prediction`, `paddy-advisory`, `safe-routes`) as needed. Each service runs as an independent API.

---

### Mobile App Setup

```bash
# 1. Navigate to the mobile directory
cd Geonix-mobile

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your API base URLs and any API keys

# 4. Start the Expo development server
npx expo start
```

Scan the QR code in the **Expo Go** app (iOS / Android), or press `a` for Android emulator / `i` for iOS simulator.

---

## Environment Variables

### Backend (`Geonix-backend/dengue-warning/api/.env`)

| Variable       | Description                              |
| -------------- | ---------------------------------------- |
| `DATABASE_URL` | Connection string for the database       |
| `SECRET_KEY`   | Secret key for JWT / session signing     |
| `DEBUG`        | Enable debug mode (`true` / `false`)     |
| `PORT`         | Port to run the API on (default: `8000`) |

### Mobile (`Geonix-mobile/.env`)

| Variable         | Description                                     |
| ---------------- | ----------------------------------------------- |
| `DENGUE_API_URL` | Base URL of the Dengue Warning API              |
| `FLOOD_API_URL`  | Base URL of the Flood Prediction API            |
| `PADDY_API_URL`  | Base URL of the Paddy Advisory API              |
| `ROUTES_API_URL` | Base URL of the Safe Routes API                 |
| `MAPS_API_KEY`   | API key for map provider (Google Maps / Mapbox) |

> **Note:** Never commit `.env` files. Copy from `.env.example` and fill in your values locally.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please follow the existing code style and include relevant tests where applicable.

---

## License

This project was developed as part of academic research project **R26-IT-046**. All rights reserved by the contributors.

---

<p align="center">
  Built with ❤️ by the R26-IT-046 team
</p>
