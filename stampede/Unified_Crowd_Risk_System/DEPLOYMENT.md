# Sahyatri Unified Crowd Risk System (UCRS) - Deployment Guide

This guide provides step-by-step instructions for deploying the Sahyatri UCRS backend (Flask + YOLO + P2PNet).

## Prerequisites

Because this system uses computer vision models (YOLO and PyTorch for P2PNet), it requires:
1. **Python 3.9+**
2. **At least 1GB of RAM** (2GB+ recommended)
3. **Environment variables** to manage emails and configurations securely.

---

## Configuration (`.env`)

Before deploying, ensure you configure your environment variables. The application loads configurations automatically using `python-dotenv`.

Create a `.env` file based on `.env.example`:
```env
FLASK_ENV=production
FLASK_PORT=5002

# Email settings for DANGER alerts
ENABLE_EMAIL_ALERTS=True
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_admin_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
ADMIN_ALERT_EMAIL=admin_to_receive_alerts@domain.com
```

> **Note on Gmail:** If using Gmail, you must use an **App Password** (enabled via 2-Step Verification) instead of your regular password.

---

## Recommended Deployment Platforms

Because UCRS processes video streams and uses PyTorch, lightweight serverless platforms (like Vercel or Netlify) are **not suitable**. They have severe timeouts and memory limitations that break video streaming and PyTorch. 

The best platforms for this are containerized or virtual machine hosting solutions like **Render**, **Hugging Face Spaces**, or **Railway**.

### Option 1: Render (Web Service) - Recommended

Render offers easy Docker and Python deployment.

1. Create a `Render.yaml` or connect your GitHub repository directly to Render.
2. Choose **Web Service**.
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `gunicorn -w 1 -b 0.0.0.0:$PORT app:app --timeout 120`
5. Go to the **Environment** tab in Render and add all the variables from your `.env` file.
6. **Important:** Due to PyTorch's memory footprint, you may need a paid "Starter" tier ($7/mo) rather than the Free tier.

### Option 2: Hugging Face Spaces (Docker)

Hugging Face Spaces is excellent for ML applications and offers a free tier with decent CPU/RAM.

1. Create a new Space on Hugging Face.
2. Select **Docker** as the Space SDK.
3. Create a `Dockerfile` in the root of `Unified_Crowd_Risk_System`:
   ```dockerfile
   FROM python:3.9-slim

   # Install system dependencies for OpenCV
   RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0

   WORKDIR /app
   COPY . .

   RUN pip install --no-cache-dir -r requirements.txt

   # Huggingface spaces run on port 7860 by default
   EXPOSE 7860
   ENV FLASK_PORT=7860

   CMD ["python", "app.py"]
   ```
4. Push your code.
5. Add your `.env` variables in the Space settings under **Repository Secrets**.

### Option 3: Railway or Heroku

1. Connect your GitHub repo.
2. Add a `Procfile` to the root:
   ```text
   web: gunicorn app:app -b 0.0.0.0:$PORT --timeout 120 --workers 1 --threads 2
   ```
3. Add the `Aptfile` for OpenCV dependencies:
   ```text
   libgl1-mesa-glx
   libglib2.0-0
   ```
4. Set the `.env` variables in the platform's Dashboard.

---

## 📱 Sahyatri Mobile Application (APK Build)

To build the APK for the Sahyatri Mobile app (which integrates this backend):

1. Navigate to the `mobile/` directory:
   ```bash
   cd ../mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update the `.env` in the `mobile` folder to point to your new deployed UCRS backend URL (e.g., `UCRS_API_URL=https://your-render-app.onrender.com`).
4. Build the Android APK using EAS (Expo Application Services):
   ```bash
   npm install -g eas-cli
   eas login
   eas build -p android --profile preview
   ```
5. Once the build completes, EAS will provide a direct download link for the `.apk` file that you can install on any Android device.

---

## Verification Checklist

- [ ] `.env` is populated with a valid App Password for email alerts.
- [ ] `gunicorn` is used in production (do not use `python app.py`).
- [ ] WebSockets/Streaming isn't buffered (Nginx users should use `proxy_buffering off;`).
