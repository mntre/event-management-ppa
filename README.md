# Event Management - QR Scanner

QR Code Scanner for Year-End Party 2026 Attendance System

## 🚀 Live Demo

This app is deployed on Vercel: [Add your URL here after deployment]

## 📱 Features

- Real-time QR code scanning
- Instant attendance marking
- Duplicate detection
- Live statistics
- Employee information display
- Mobile responsive

## 🔧 Setup

### Configuration

When you open the app, enter:

1. **Apps Script API URL** - Your deployed Google Apps Script URL
2. **Google Sheet ID** - Your Google Sheet identifier
3. **Attendance Tab Name** - Usually "Attendance"

### Usage

1. Click "Start Scanner"
2. Allow camera access
3. Point camera at QR codes
4. Attendance is marked automatically

## 🏗️ Architecture

- **Frontend:** HTML + JavaScript (this repo)
- **Backend API:** Google Apps Script
- **Database:** Google Sheets
- **Hosting:** Vercel

## 📄 Files

- `index.html` - Scanner interface
- `scanner.js` - QR scanning logic and API integration
- `vercel.json` - Vercel deployment configuration

## 🔒 Security

- API URL is configurable (not hardcoded)
- Google Apps Script handles authentication
- No sensitive data stored in frontend code

## 💻 Local Development

To test locally:

```bash
npx http-server -p 8080
```

Open http://localhost:8080

## 📞 Support

For issues or questions, contact the IT department.
