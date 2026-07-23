// Shree Navajagriti Chandi School - Backend Server
// Node.js + Express + SQLite (better-sqlite3)

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'school.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    full_name TEXT
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT,
    name TEXT NOT NULL,
    class TEXT,
    email TEXT
);

CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT,
    email TEXT
);

CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    teacher TEXT,
    students_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT,
    date TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    amount REAL,
    due_date TEXT,
    status TEXT DEFAULT 'Pending'
);

CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    subject TEXT,
    marks INTEGER
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    subject TEXT,
    message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Seed a default admin account if none exists yet.
// This first account is an "owner" — the only role that can create/remove other logins.
const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
if (adminCount === 0) {
    const defaultUser = 'admin';
    const defaultPass = 'ChangeMe@123'; // CHANGE THIS after first login
    const hash = bcrypt.hashSync(defaultPass, 10);
    db.prepare('INSERT INTO admins (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)')
      .run(defaultUser, hash, 'owner', 'Principal / Owner Account');
    console.log('Seeded default admin -> username: admin | password: ChangeMe@123 (please change it)');
}

// Seed a little sample data if tables are empty (first run only)
if (db.prepare('SELECT COUNT(*) AS c FROM students').get().c === 0) {
    db.prepare('INSERT INTO students (roll_no, name, class, email) VALUES (?,?,?,?)')
      .run('001', 'Ram Thapa', 'Class 10', 'ram@school.com');
    db.prepare('INSERT INTO teachers (name, subject, email) VALUES (?,?,?)')
      .run('Sita Sharma', 'Mathematics', 'sita@school.com');
    db.prepare('INSERT INTO classes (name, teacher, students_count) VALUES (?,?,?)')
      .run('Class 10 A', 'Sita Sharma', 45);
    db.prepare('INSERT INTO fees (student_name, amount, due_date, status) VALUES (?,?,?,?)')
      .run('Ram Thapa', 5000, '2026-08-01', 'Pending');
    db.prepare('INSERT INTO results (student_name, subject, marks) VALUES (?,?,?)')
      .run('Ram Thapa', 'Mathematics', 85);
}

// ---------- App middleware ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Very simple in-memory session token store.
// Token -> { username, expires }
const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

function makeToken() {
    return crypto.randomBytes(24).toString('hex');
}

function requireAuth(req, res, next) {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const session = token && sessions.get(token);
    if (!session || session.expires < Date.now()) {
        if (token) sessions.delete(token);
        return res.status(401).json({ error: 'Not authenticated. Please log in again.' });
    }
    session.expires = Date.now() + SESSION_TTL_MS; // sliding expiry
    req.admin = session.username;
    req.role = session.role;
    next();
}

// Only the owner account (e.g. the principal / primary accountant) can manage other logins
function requireOwner(req, res, next) {
    if (req.role !== 'owner') {
        return res.status(403).json({ error: 'Only the owner account can manage admin users.' });
    }
    next();
}

// ---------- Auth routes ----------
app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = makeToken();
    sessions.set(token, { username, role: row.role, expires: Date.now() + SESSION_TTL_MS });
    res.json({ token, username, role: row.role, fullName: row.full_name });
});

app.post('/api/logout', requireAuth, (req, res) => {
    const auth = req.headers['authorization'] || '';
    const token = auth.slice(7);
    sessions.delete(token);
    res.json({ ok: true });
});

app.post('/api/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(req.admin);
    if (!row || !bcrypt.compareSync(currentPassword || '', row.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, req.admin);
    res.json({ ok: true });
});

// ---------- Admin user management (owner only) ----------
// The owner (e.g. principal / primary accountant) decides who else may log in —
// for example the accountant or specific teachers — each with their own username/password.
app.get('/api/admins', requireAuth, requireOwner, (req, res) => {
    const rows = db.prepare('SELECT id, username, role, full_name FROM admins ORDER BY id').all();
    res.json(rows);
});

app.post('/api/admins', requireAuth, requireOwner, (req, res) => {
    const { username, password, full_name, role } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const safeRole = role === 'owner' ? 'owner' : 'staff';
    const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
    if (existing) {
        return res.status(409).json({ error: 'That username is already taken.' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO admins (username, password_hash, role, full_name) VALUES (?,?,?,?)')
        .run(username, hash, safeRole, full_name || '');
    const row = db.prepare('SELECT id, username, role, full_name FROM admins WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
});

app.delete('/api/admins/:id', requireAuth, requireOwner, (req, res) => {
    const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Admin not found.' });
    if (target.username === req.admin) {
        return res.status(400).json({ error: "You can't remove the account you're currently logged in as." });
    }
    if (target.role === 'owner') {
        const ownerCount = db.prepare("SELECT COUNT(*) AS c FROM admins WHERE role = 'owner'").get().c;
        if (ownerCount <= 1) {
            return res.status(400).json({ error: 'At least one owner account must remain.' });
        }
    }
    db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// ---------- Public stats (no login needed, shown on homepage) ----------
app.get('/api/public-stats', (req, res) => {
    const students = db.prepare('SELECT COUNT(*) AS c FROM students').get().c;
    const teachers = db.prepare('SELECT COUNT(*) AS c FROM teachers').get().c;
    const classes = db.prepare('SELECT COUNT(*) AS c FROM classes').get().c;
    res.json({ students, teachers, classes });
});

// ---------- Dashboard (admin only, includes fees) ----------
app.get('/api/dashboard-stats', requireAuth, (req, res) => {
    const students = db.prepare('SELECT COUNT(*) AS c FROM students').get().c;
    const teachers = db.prepare('SELECT COUNT(*) AS c FROM teachers').get().c;
    const classes = db.prepare('SELECT COUNT(*) AS c FROM classes').get().c;
    const pendingFees = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM fees WHERE status = 'Pending'").get().s;
    res.json({ students, teachers, classes, pendingFees });
});

// ---------- Generic CRUD helper ----------
function registerCrud(resource, table, columns) {
    // List
    app.get(`/api/${resource}`, requireAuth, (req, res) => {
        const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
        res.json(rows);
    });
    // Create
    app.post(`/api/${resource}`, requireAuth, (req, res) => {
        const body = req.body || {};
        const cols = columns.filter(c => body[c] !== undefined);
        if (cols.length === 0) return res.status(400).json({ error: 'No valid fields provided.' });
        const placeholders = cols.map(() => '?').join(',');
        const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
        const info = stmt.run(...cols.map(c => body[c]));
        const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
        res.status(201).json(row);
    });
    // Delete
    app.delete(`/api/${resource}/:id`, requireAuth, (req, res) => {
        db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
        res.json({ ok: true });
    });
}

registerCrud('students', 'students', ['roll_no', 'name', 'class', 'email']);
registerCrud('teachers', 'teachers', ['name', 'subject', 'email']);
registerCrud('classes', 'classes', ['name', 'teacher', 'students_count']);
registerCrud('attendance', 'attendance', ['class', 'date', 'status']);
registerCrud('fees', 'fees', ['student_name', 'amount', 'due_date', 'status']);
registerCrud('results', 'results', ['student_name', 'subject', 'marks']);

// ---------- Public contact form (no auth needed) ----------
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email and message are required.' });
    }
    db.prepare('INSERT INTO messages (name, email, subject, message) VALUES (?,?,?,?)')
      .run(name, email, subject || '', message);
    res.status(201).json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Shree Navajagriti Chandi School server running at http://localhost:${PORT}`);
});
