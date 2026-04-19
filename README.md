![Project Image 1](<img/WhatsApp%20Image%202026-04-19%20at%2010.47.01%20(1).jpeg>)
![Project Image 2](<img/WhatsApp%20Image%202026-04-19%20at%2010.47.01%20(2).jpeg>)
![Project Image 3](img/WhatsApp%20Image%202026-04-19%20at%2010.47.01.jpeg)

# BeyondInfinity

Smart Campus Water Tank Monitoring and Automation System with role-based access, admin approval flow, analytics, reports, and hardware-triggered SMS alerts.

## Overview

BeyondInfinity is a full-stack water tank monitoring platform built for campus/hostel use. It combines:

- Live tank monitoring dashboard
- Role-based authentication (ADMIN, WARDEN, STUDENT)
- Admin approval and user management
- Tank control APIs (pump/mode/history/analytics)
- Dry run report management and CSV export
- Hardware integration endpoint for IoT devices
- CircuitDigest SMS notification integration

## Main Features

- Authentication and Authorization
  - User registration and login
  - JWT-based auth
  - Role-based route protection
  - Device authentication using x-api-key

- Admin Panel
  - View all users by status
  - Approve or reject pending users
  - Delete users

- Tank Operations
  - Read tank data (single/all)
  - Ingest sensor data
  - Manual pump control (staff)
  - Mode control AUTO/MANUAL (admin)
  - History and analytics APIs

- Reports
  - Save dry-run resolution records
  - View reports by month/year/all
  - Download CSV report

- Hardware and Alerts
  - Hardware can call secure alert API
  - Backend sends SMS through CircuitDigest Cloud

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MongoDB Atlas, Mongoose
- Auth: jsonwebtoken, bcryptjs
- Uploads: multer
- CSV Export: json2csv
- Dev Runtime: nodemon

## Project Structure

```text
BeyondInfinity/
  index.html
  data.html
  script.js
  auth.js
  admin.js
  CSS/
  img/
  backend/
    server.js
    routes/
      authRoutes.js
      adminRoutes.js
      tankRoutes.js
      reportRoutes.js
    controllers/
    models/
    db/
    middleware/
    utils/
```

## Installation

1. Clone the repository.
2. Open terminal at project root.
3. Install dependencies:

```bash
npm install
```

4. Create .env from .env.example and fill values.
5. Start server:

```bash
npm start
```

For development mode:

```bash
npm run dev
```

## Environment Variables

Create a .env file in root with values similar to:

```env
PORT=3000
MONGO_URI=mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER>.mongodb.net/<DATABASE>?appName=<APP_NAME>
MONGO_PASSWORD=your_mongodb_password_here
DB_HISTORY_LIMIT=10

DEVICE_API_KEY=your_device_key_here

CD_SMS_API_KEY=cd_xxxxxxxxxxxxxxxxxxxx
CD_SMS_BASE_URL=https://www.circuitdigest.cloud
CD_SMS_TEMPLATE_ID=103
CD_SMS_MOBILE=91xxxxxxxxxx

JWT_SECRET=your_jwt_secret_here
```

## Default Admin (Auto Seed)

On first run, default admin is auto-created if missing:

- Email: admin@bitsindri.ac.in
- Password: admin123

Important: change this password in production.

## Routes and APIs

### Base URLs

- Dashboard: /
- Data page: /data
- Health: /health

### Auth APIs

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Admin APIs (ADMIN only)

- GET /api/admin/users
- POST /api/admin/approve
- DELETE /api/admin/users/:userId

### Tank APIs

- GET /api/tank
- POST /api/tank
- POST /api/pump
- POST /api/mode
- GET /api/history
- GET /api/analytics
- GET /api/db/history

### Hardware Alert API

- POST /api/hardware/alert
- Auth: x-api-key header using DEVICE_API_KEY

Sample request:

```http
POST /api/hardware/alert
x-api-key: your_device_key_here
Content-Type: application/json
```

```json
{
  "tankId": "T-01",
  "faultType": "DRY_RUN",
  "message": "Motor ON but level not increasing",
  "level": 12
}
```

This endpoint sends SMS through CircuitDigest using template/mobile from env (or optional values from body).

### Report APIs

- POST /api/dryrun/save
- GET /api/reports/dryrun
- GET /api/reports/download

## CircuitDigest SMS Integration

The backend SMS sender uses:

- Authorization header = CD_SMS_API_KEY
- Endpoint format:
  - https://www.circuitdigest.cloud/api/v1/send_sms?ID=<templateId>

Payload format:

```json
{
  "mobiles": "91xxxxxxxxxx",
  "var1": "T-01",
  "var2": "DRY_RUN @ 12%"
}
```

## Access Control Summary

- STUDENT:
  - View allowed dashboard parts
  - Restricted from admin/staff actions

- WARDEN:
  - Staff-level tank actions
  - No admin-only operations

- ADMIN:
  - Full access including user approval, mode changes, and report admin actions

- DEVICE:
  - Allowed through x-api-key authentication for hardware-triggered APIs

## Notes

- Server has automatic port fallback if selected port is busy.
- Frontend is served statically from project root.
- Uploads are served from /uploads.

## Quick Start Checklist

- Fill .env correctly
- Run npm install
- Run npm start
- Open dashboard in browser
- Register users and approve via admin
- Test hardware alert API with x-api-key
- Verify SMS delivery in CircuitDigest logs

## License

MIT
