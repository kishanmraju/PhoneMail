# PhoneMail

**PhoneMail** is a phone-number-based email and messaging platform that combines the conversational experience of WhatsApp with the functionality of email.

A PhoneMail account is identified by a phone number and corresponding PhoneMail address:

```text
9876543210
        ↓
9876543210@phonemail.com
```

The project contains a **React web client**, an **Expo/React Native mobile client**, and a shared **Node.js/Express backend** connected to **MongoDB**.

---

## ✨ Features

### Authentication
- Phone-number based authentication
- OTP verification using **MSG91**
- JWT-based authentication for API access
- Shared authentication/backend between web and mobile clients

### Email & Conversations
- Send and receive messages
- Conversation/thread-based email view
- Reply to messages
- Read/unread status
- Favorites
- Drafts
- Spam
- Trash
- Restore messages
- Permanently delete messages
- Sent mail

### Clients
- **Web application** with a Gmail-style experience
- **Mobile application** with a WhatsApp-style conversational experience
- Both clients use the same backend and MongoDB database

### Real-time communication
- Socket.IO is integrated for real-time email notifications.
- REST APIs remain the primary persistence/retrieval mechanism.

---

## 🏗️ Architecture

```text
                         PhoneMail
                            │
              ┌─────────────┴─────────────┐
              │                           │
        React Web App              Expo Mobile App
              │                           │
              └─────────────┬─────────────┘
                            │
                       REST / JWT
                       Socket.IO
                            │
                     Node.js / Express
                            │
                 ┌──────────┴──────────┐
                 │                     │
              MongoDB              MSG91
           Users + Emails          OTP Auth
```

---

## 📁 Project Structure

```text
PhoneMail/
│
├── client/                 # React + Vite web application
│
├── mobile/                 # Expo / React Native mobile application
│
├── server/                 # Node.js + Express backend
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.js
│   │
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── package-lock.json
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Web | React + Vite |
| Mobile | Expo / React Native |
| Backend | Node.js + Express |
| Database | MongoDB |
| Authentication | MSG91 OTP + JWT |
| Real-time | Socket.IO |
| API testing | Postman |
| Containerization | Docker + Docker Compose |

---

# 🚀 Running the Project

## Prerequisites

Install:

- Node.js
- npm
- Docker Desktop
- Git

For mobile development, Expo tooling is also required.

---

# 🐳 Run Backend + MongoDB with Docker

From the project root:

```bash
docker compose up -d
```

Check running containers:

```bash
docker compose ps
```

View backend logs:

```bash
docker compose logs server
```

Stop the services:

```bash
docker compose down
```

MongoDB data is persisted through the Docker volume defined in `docker-compose.yml`.

### Backend

The API is exposed on:

```text
http://localhost:5000
```

The root endpoint should return:

```json
{
  "message": "PhoneMail API is running"
}
```

---

# ⚙️ Environment Variables

## Backend

Create:

```text
server/.env
```

Example:

```env
PORT=5000
MONGO_URI=mongodb://mongodb:27017/phonemail
JWT_SECRET=your_jwt_secret
MSG91_AUTHKEY=your_msg91_authkey
```

**Never commit `.env` or real secrets to GitHub.**

---

## Web

Create the required environment file in `client/`.

Example:

```env
VITE_API_URL=http://localhost:5000
VITE_MSG91_WIDGET_ID=your_widget_id
VITE_MSG91_WIDGET_TOKEN=your_widget_token
```

---

## Mobile

Create the required environment file in `mobile/`.

Example:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_MSG91_WIDGET_ID=your_widget_id
EXPO_PUBLIC_MSG91_WIDGET_TOKEN=your_widget_token
```

---

# 💻 Run the Web Application

```bash
cd client
npm install
npm run dev
```

Vite will display the local development URL in the terminal.

The web application communicates with the PhoneMail backend through:

```text
http://localhost:5000
```

---

# 📱 Run the Mobile Application

```bash
cd mobile
npm install
npx expo start
```

For a browser-based Expo run:

```bash
npx expo start --web
```

---

# 🔌 API Overview

The backend provides endpoints for:

```text
/api/auth
/api/users
/api/emails
```

Important email operations include:

```text
POST   /api/emails
GET    /api/emails
GET    /api/emails/sent
GET    /api/emails/thread/:threadId

POST   /api/emails/drafts
GET    /api/emails/drafts

GET    /api/emails/spam
GET    /api/emails/trash

POST   /api/emails/:id/reply

PATCH  /api/emails/:id/read
PATCH  /api/emails/:id/favorite
PATCH  /api/emails/:id/trash
PATCH  /api/emails/:id/spam
PATCH  /api/emails/:id/restore

DELETE /api/emails/:id
POST   /api/emails/:id/send
```

Protected endpoints require a valid JWT:

```text
Authorization: Bearer <token>
```

---

# 🔐 Security Notes

- MSG91 authentication credentials must remain private.
- `MSG91_AUTHKEY` belongs only on the backend.
- `.env` files should never be committed.
- JWT authentication protects authenticated API routes.
- MongoDB is accessed by the backend rather than directly by the clients.

---

# 🧪 Basic Test Flow

A complete two-user test can be performed using two PhoneMail accounts:

```text
User A
   │
   │ sends message
   ▼
PhoneMail Backend
   │
   ▼
MongoDB
   │
   ▼
User B
   │
   └── opens conversation
       └── replies
```

Test the same flow between:

- Web → Web
- Web → Mobile
- Mobile → Web
- Mobile → Mobile

Also test:

- OTP login
- Send
- Receive
- Reply
- Read/unread
- Favorites
- Drafts
- Spam
- Restore
- Trash
- Permanent delete

---

# 📌 Important Docker Note

The current Docker Compose setup is intended to start the **backend and MongoDB** services:

```text
docker compose up -d
```

The React web client and Expo mobile client can be run separately during development.

If the hackathon evaluator interprets **"the software must be up and running at `docker compose up -d`"** as requiring the **web client itself** to start from Compose as well, the `client` service should also be added to `docker-compose.yml` before submission.

---

## 🎯 Project Goal

PhoneMail aims to make email communication as simple and conversational as messaging:

> **Your phone number becomes your email identity.**

Instead of navigating traditional email inboxes, users can communicate through familiar conversation-based interactions while retaining email-style functionality.

---

## 👥 Team

**PhoneMail — ALPHASTACK 7-Day Buildathon**

Built as a hackathon project combining:

- Web
- Mobile
- Backend APIs
- OTP authentication
- Database persistence
- Real-time communication
- Dockerized backend infrastructure
