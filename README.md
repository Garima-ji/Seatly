# Seatly — Real-Time Ticket Booking Platform
### *Technical Assignment Submission for Unthinkable Solutions*

**Seatly** is a high-concurrency ticket booking platform designed to handle real-time ticket sales. It features interactive visual seat maps, automatic TTL-bound holds, automated waitlist reallocation, and Gmail-compatible QR code ticket delivery.

---

## 🚀 Live Deployments

* **Frontend:** Deployed on **Vercel** (e.g., `https://seatly-nu.vercel.app/`)
* **Backend API:** Deployed on **Hugging Face Spaces** (Gradio SDK running a Node.js process proxy)
* **Database:** Hosted on **Supabase PostgreSQL** (utilizing the IPv4 Session Pooler)
* **Cache/PubSub:** Hosted on **Upstash Serverless Redis**

---

## 🛠️ Core Engineering Features

### 1. High-Concurrency Seat Locking & TTL Holds
* **Atomic Row-Level Locking:** Prevents duplicate holds and double-booking at high request volumes using relational transaction boundaries (`SELECT ... FOR UPDATE` equivalent patterns).
* **10-Minute Holds:** Seats are temporarily held for 10 minutes upon selection. If checkout is not completed, a background cron job automatically releases the holds back to the available pool.
* **Real-Time Map Synchronization:** All seat selection states are broadcasted to active visitors in real-time using **WebSockets (Socket.io)**.

### 2. Automated Waitlist Queue & Time-Bound Reallocation
* When an event category sells out, customers can join a sequential **Waitlist**.
* If a booking is cancelled, the system automatically allocates the freed seat to the next customer in the queue.
* The waitlist candidate receives a **30-minute booking offer** via email. If they fail to claim it, the offer expires and is reallocated to the next candidate in line.

### 3. Secure Gmail-Compatible QR Code Tickets
* Upon successful payment, a unique QR code is generated representing the ticket booking.
* Standard base64 inline images are blocked by Gmail's secure proxy. To bypass this, tickets are sent via **SendGrid** with the QR code attached as an inline Content-ID (`cid:qrCode`) attachment, ensuring native rendering across all major email clients.

### 4. Role-Based Portals
* **Customers:** Browse events, pick seats in real-time, register/verify emails, and review booking histories.
* **Organisers:** Create and manage events, publish showtimes, set seat pricing tiers, and monitor revenue analytics.
* **Admins:** Manage physical venues, layout dimensions, and seat categories.

---

## 💻 Tech Stack

* **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, Zustand, Socket.io-client.
* **Backend:** Node.js, Express, TypeScript, Socket.io (WebSockets), Node-Cron.
* **Database:** PGlite (local in-process WASM Postgres) / Supabase PostgreSQL (production).
* **Cache/PubSub:** ioredis-mock (local in-memory Redis simulator) / Upstash Redis (production).

---

## ⚙️ How to Run the Project Locally

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (create a `.env` file):
   ```env
   PORT=4000
   DATABASE_URL=postgres://localhost/local_database
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=tq4GvR2oXQZ5LpY8sKbVjDwH2mN5qF7t
   JWT_REFRESH_SECRET=xK7vM8n2P9sQbY4tDwR6zJ1cK3vL5pG7
   WAITLIST_TOKEN_SECRET=yP9sQbY4tDwR6zJ1cK3vL5pG7tq4GvR2
   SENDGRID_API_KEY=your_sendgrid_api_key
   EMAIL_FROM=your_sender_email@gmail.com
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
   > The backend will automatically run migrations, seed initial demo data, and listen at **http://localhost:4000**.

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   > The frontend will load at **http://localhost:5174** (or `5173`).

---

## 🔑 Authentication & Testing
For security and production compliance, all mock/bypass guest login buttons have been removed. 

1. Visit the **Sign Up** screen to create a new Customer, Organiser, or Admin account.
2. An email verification link will be generated.
3. Access your email or the terminal console to complete verification and start testing the real-time seat selector and booking flow!
