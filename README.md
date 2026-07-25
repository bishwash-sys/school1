# Shree Navajagriti Chandi School — Website + Admin Panel

A full school website with a working database-backed admin panel.

**Stack:** Node.js + Express (server) + SQLite (database, file: `data/school.db`)

## What's included
- **Public website** (`public/index.html`) — home page, about, live "school at a glance" stats pulled from the database, and a contact form that saves messages to the database.
- **Admin login** (`public/admin-login.html`) — checks credentials against the `admins` table (passwords are hashed with bcrypt, not stored in plain text).
- **Admin dashboard** (`public/admin-dashboard.html`) — manage Students, Teachers, Classes, Attendance, Fees, and Results. Every add/delete goes straight to the SQLite database through the API.
- **Backend** (`server.js`) — REST API (`/api/...`) with session-token auth. No page can read/write data without a valid login token.

## Payments (fees + donations)
The public **Pay Fees / Donate** page (`public/pay.html`) accepts payments via **eSewa**, **Khalti**, and **cards (Stripe)**. Every payment attempt is logged in the `payments` table and visible to admins under **Payments** in the dashboard.

### Setup
1. Copy `.env.example` to a new file named `.env`.
2. **eSewa** — already works out of the box using eSewa's published public **test** credentials (safe for sandbox testing, not real money).
3. **Khalti** — sign up for a free sandbox account at https://test-admin.khalti.com, copy your secret key, and set `KHALTI_SECRET_KEY` in `.env`.
4. **Stripe (cards)** — sign up free at https://dashboard.stripe.com, copy your **test** secret key (starts with `sk_test_...`), and set `STRIPE_SECRET_KEY` in `.env`.
5. Restart the server after editing `.env`.

### Going live with real money
Each provider requires you to register an actual verified merchant account before it will process real payments (this is standard for any payment gateway, not specific to this code):
- **eSewa** — apply for a merchant account at https://merchant.esewa.com.np, then replace `ESEWA_GATEWAY_URL`, `ESEWA_STATUS_URL`, `ESEWA_PRODUCT_CODE`, and `ESEWA_SECRET_KEY` in `.env` with your production values.
- **Khalti** — after successful sandbox testing, apply for a live merchant account at https://khalti.com, then swap in your live secret key and change `KHALTI_BASE_URL` to `https://khalti.com/api/v2`.
- **Stripe** — activate your account (business details + bank account) in the Stripe dashboard, then swap in your live secret key (starts with `sk_live_...`).

No code changes are needed to go live — only the `.env` values change.

## Student QR Chat Groups
Students can add classmates as contacts by scanning each other's personal QR code, then form group chats with confirmed contacts.

- Every student has a unique QR code (on their dashboard) encoding a private "contact code."
- Scanning a classmate's QR (using the device camera) adds them as a mutual contact.
- Group chats can only include students who are already confirmed contacts — there's no way to add a stranger who hasn't been scanned.
- **Every group and every message is visible to admins** under **Student Chats** in the dashboard, for moderation and safety. This is a supervised system, not a private/hidden one — worth mentioning to students and parents.
- Messages refresh automatically every few seconds (no separate chat server needed).

## Homework & Student Accounts
Students get their own separate login — completely walled off from the admin panel.

- **Admin side:** in the dashboard, **Homework** lets any admin/staff post homework per class. **Student Accounts** lets you create a username/password for each student (give these to students directly — there's no self-signup).
- **Student side:** students log in at `student-login.html`, and land on `student-dashboard.html`, where they see only their own class's homework, plus a **Pay Fees** button that jumps straight to the payment page with their name pre-filled.
- **Security:** student logins and admin logins use entirely separate session types — a student's login token is rejected by every admin API route, and an admin's token is rejected by every student API route. Tested and verified.

## Default admin login (owner account)
```
username: admin
password: ChangeMe@123
```
**Change this immediately** — either add a "change password" call to `/api/change-password`, or edit the `admins` table directly. Do not leave the default password in place on a live site.

## Restricting who can use the admin panel
There are two kinds of logins:
- **Owner** — full access, and the only role that can create or remove other logins. The seeded `admin` account is an owner. Use this for the principal or whoever should have final control.
- **Staff** — full access to the panel (students, teachers, classes, attendance, fees, results) but **cannot** see or manage other admin logins. Use this for the accountant or authorized teachers.

Log in as the owner account, open **Admin Users** in the sidebar (only owners see this menu item), and create a separate username/password for each authorized person — e.g. the accountant, or specific teachers. Don't share the owner password with them.

The admin pages are also hidden from the public homepage nav and blocked from search engines (`robots.txt`), so casual visitors won't stumble onto the login page — though the real protection is always the login itself, not the hidden link.

## Running it locally
```bash
npm install
node server.js
```
Then open **http://localhost:3000** in your browser.

## ⚠️ About hosting
You asked for a **PHP + MySQL host**, but this build uses **Node.js + Express + SQLite** (per your other answer). These are two different server technologies:

- A typical shared PHP/MySQL host (cPanel-style hosting, most "cheap" hosting plans) **cannot run this project as-is** — it doesn't run Node.js processes or serve an Express app.
- To use this exact code, you need a host that runs Node.js, for example: **Render, Railway, Fly.io, a DigitalOcean/Linode VPS, or Replit.** Most of these have free or very low-cost tiers and are simple to deploy to (push the folder, set the start command to `node server.js`).
- If you specifically need it to run on your current PHP/MySQL hosting, I can rebuild the backend in **PHP + MySQL** instead (same look, same features) — just say the word and I'll convert it.

## Project structure
```
school-website/
├── server.js              # Express server + all API routes
├── package.json
├── data/school.db          # SQLite database (auto-created on first run)
└── public/
    ├── index.html          # Public homepage
    ├── admin-login.html    # Admin login page
    ├── admin-dashboard.html# Admin panel (protected)
    ├── css/
    │   ├── site.css
    │   ├── login.css
    │   └── admin.css
    └── js/
        ├── site.js
        ├── admin-login.js
        └── admin-dashboard.js
```

## Database tables
`admins`, `students`, `teachers`, `classes`, `attendance`, `fees`, `results`, `messages` (contact form submissions).
