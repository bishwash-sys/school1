// Shree Navajagriti Chandi School - Backend Server
// Node.js + Express + SQLite (better-sqlite3)

require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'school.db');
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

// ---------- Payment provider config (sandbox defaults; swap via .env for production) ----------
const ESEWA_GATEWAY_URL = process.env.ESEWA_GATEWAY_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
const ESEWA_STATUS_URL = process.env.ESEWA_STATUS_URL || 'https://rc.esewa.com.np/api/epay/transaction/status/';
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';

const KHALTI_BASE_URL = process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2';
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || ''; // you must get your own sandbox key from test-admin.khalti.com

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''; // you must get your own test key from dashboard.stripe.com
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

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

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    purpose TEXT NOT NULL,
    payer_name TEXT,
    payer_email TEXT,
    student_name TEXT,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_ref TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS homework (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class TEXT NOT NULL,
    subject TEXT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    student_name TEXT NOT NULL,
    class TEXT,
    email TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    pinned INTEGER NOT NULL DEFAULT 0,
    posted_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_a TEXT NOT NULL,
    student_b TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_a, student_b)
);

CREATE TABLE IF NOT EXISTS chat_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    UNIQUE(group_id, username)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    sender_username TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Helper: generate a unique 6-digit student UID (used for friend search, not for login)
function generateStudentUid() {
    let uid;
    do {
        uid = String(Math.floor(100000 + Math.random() * 900000));
    } while (db.prepare('SELECT id FROM student_logins WHERE uid = ?').get(uid));
    return uid;
}

// Migration: add a UID column to existing student_logins tables (replaces the old QR contact_code)
const studentCols = db.prepare("PRAGMA table_info(student_logins)").all().map(c => c.name);
if (!studentCols.includes('uid')) {
    db.exec('ALTER TABLE student_logins ADD COLUMN uid TEXT');
}
// Backfill a UID for any student that doesn't have one yet
const noUid = db.prepare("SELECT id FROM student_logins WHERE uid IS NULL OR uid = ''").all();
for (const s of noUid) {
    db.prepare('UPDATE student_logins SET uid = ? WHERE id = ?').run(generateStudentUid(), s.id);
}

// Seed a default admission status if not already set
if (!db.prepare("SELECT value FROM settings WHERE key = 'admission_status'").get()) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('admission_status', 'Open')").run();
}

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
    if (!session || session.expires < Date.now() || session.type !== 'admin') {
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

// Student sessions are kept completely separate from admin sessions —
// a student token can never pass requireAuth, and an admin token can never pass requireStudentAuth.
function requireStudentAuth(req, res, next) {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const session = token && sessions.get(token);
    if (!session || session.expires < Date.now() || session.type !== 'student') {
        if (token) sessions.delete(token);
        return res.status(401).json({ error: 'Not authenticated. Please log in again.' });
    }
    session.expires = Date.now() + SESSION_TTL_MS;
    req.student = { username: session.username, name: session.studentName, class: session.studentClass };
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
    sessions.set(token, { username, role: row.role, type: 'admin', expires: Date.now() + SESSION_TTL_MS });
    res.json({ token, username, role: row.role, fullName: row.full_name });
});

// ---------- Student auth routes ----------
app.post('/api/student-login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    const row = db.prepare('SELECT * FROM student_logins WHERE username = ?').get(username);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = makeToken();
    sessions.set(token, {
        username, type: 'student', studentName: row.student_name, studentClass: row.class,
        expires: Date.now() + SESSION_TTL_MS
    });
    res.json({ token, username, studentName: row.student_name, class: row.class });
});

app.post('/api/student-logout', requireStudentAuth, (req, res) => {
    const auth = req.headers['authorization'] || '';
    sessions.delete(auth.slice(7));
    res.json({ ok: true });
});

// The logged-in student's own homework, filtered to their class only
app.get('/api/student/homework', requireStudentAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM homework WHERE class = ? ORDER BY id DESC').all(req.student.class);
    res.json(rows);
});

app.get('/api/student/me', requireStudentAuth, (req, res) => {
    res.json(req.student);
});

// ==========================================================
// STUDENT FRIENDS — search by UID, add/remove + group chat
// Safety notes: friends can only be added between two real, admin-created student
// accounts (no open signup, no strangers, no public directory browsing — a student
// must already know the other student's UID). Every group and message is visible to
// school admins for moderation — this is not a private/hidden channel.
// ==========================================================

// The logged-in student's own UID, shown on their dashboard so friends can find them
app.get('/api/student/my-uid', requireStudentAuth, (req, res) => {
    const row = db.prepare('SELECT uid FROM student_logins WHERE username = ?').get(req.student.username);
    if (!row) return res.status(404).json({ error: 'Account not found.' });
    res.json({ uid: row.uid });
});

function contactPairKey(a, b) {
    // Store pairs in a consistent order so (A,B) and (B,A) are treated as the same contact
    return [a, b].sort();
}

// Search for another student by their UID (does not reveal anything unless the exact UID matches)
app.get('/api/student/search', requireStudentAuth, (req, res) => {
    const uid = (req.query.uid || '').trim();
    if (!uid) return res.status(400).json({ error: 'Enter a UID to search.' });

    const other = db.prepare('SELECT username, student_name, class, uid FROM student_logins WHERE uid = ?').get(uid);
    if (!other) return res.status(404).json({ error: 'No student found with that UID.' });
    if (other.username === req.student.username) {
        return res.status(400).json({ error: 'That\'s your own UID.' });
    }

    const [a, b] = contactPairKey(req.student.username, other.username);
    const alreadyFriends = !!db.prepare('SELECT id FROM student_contacts WHERE student_a = ? AND student_b = ?').get(a, b);

    res.json({ username: other.username, name: other.student_name, class: other.class, uid: other.uid, alreadyFriends });
});

// Add a friend by UID
app.post('/api/student/contacts/add', requireStudentAuth, (req, res) => {
    const uid = (req.body && req.body.uid || '').trim();
    if (!uid) return res.status(400).json({ error: 'Missing UID.' });

    const other = db.prepare('SELECT * FROM student_logins WHERE uid = ?').get(uid);
    if (!other) return res.status(404).json({ error: 'No student found with that UID.' });
    if (other.username === req.student.username) {
        return res.status(400).json({ error: "You can't add yourself as a friend." });
    }

    const [a, b] = contactPairKey(req.student.username, other.username);
    const existing = db.prepare('SELECT id FROM student_contacts WHERE student_a = ? AND student_b = ?').get(a, b);
    if (!existing) {
        db.prepare('INSERT INTO student_contacts (student_a, student_b) VALUES (?,?)').run(a, b);
    }
    res.status(201).json({ ok: true, addedContact: { username: other.username, name: other.student_name, class: other.class } });
});

// Remove a friend
app.delete('/api/student/contacts/:username', requireStudentAuth, (req, res) => {
    const [a, b] = contactPairKey(req.student.username, req.params.username);
    db.prepare('DELETE FROM student_contacts WHERE student_a = ? AND student_b = ?').run(a, b);
    res.json({ ok: true });
});

// List this student's contacts
app.get('/api/student/contacts', requireStudentAuth, (req, res) => {
    const me = req.student.username;
    const rows = db.prepare('SELECT * FROM student_contacts WHERE student_a = ? OR student_b = ?').all(me, me);
    const otherUsernames = rows.map(r => (r.student_a === me ? r.student_b : r.student_a));
    if (!otherUsernames.length) return res.json([]);
    const placeholders = otherUsernames.map(() => '?').join(',');
    const contacts = db.prepare(`SELECT username, student_name, class FROM student_logins WHERE username IN (${placeholders})`).all(...otherUsernames);
    res.json(contacts);
});

// Create a group chat with one or more existing contacts
app.post('/api/student/chat-groups', requireStudentAuth, (req, res) => {
    const { name, member_usernames } = req.body || {};
    const me = req.student.username;
    if (!name || !Array.isArray(member_usernames) || member_usernames.length === 0) {
        return res.status(400).json({ error: 'A group name and at least one member are required.' });
    }

    // Safety check: every member added must already be a confirmed contact (scanned QR before)
    const myContacts = db.prepare('SELECT student_a, student_b FROM student_contacts WHERE student_a = ? OR student_b = ?').all(me, me);
    const contactSet = new Set(myContacts.map(r => (r.student_a === me ? r.student_b : r.student_a)));
    const invalid = member_usernames.filter(u => !contactSet.has(u));
    if (invalid.length) {
        return res.status(400).json({ error: 'You can only add students you\'ve already added as a contact via QR scan.' });
    }

    const info = db.prepare('INSERT INTO chat_groups (name, created_by) VALUES (?,?)').run(name, me);
    const groupId = info.lastInsertRowid;
    const addMember = db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, username) VALUES (?,?)');
    addMember.run(groupId, me);
    member_usernames.forEach(u => addMember.run(groupId, u));

    res.status(201).json({ id: groupId, name });
});

function isGroupMember(groupId, username) {
    return !!db.prepare('SELECT id FROM chat_group_members WHERE group_id = ? AND username = ?').get(groupId, username);
}

// List groups this student belongs to
app.get('/api/student/chat-groups', requireStudentAuth, (req, res) => {
    const rows = db.prepare(`
        SELECT g.id, g.name, g.created_by, g.created_at
        FROM chat_groups g
        JOIN chat_group_members m ON m.group_id = g.id
        WHERE m.username = ?
        ORDER BY g.id DESC
    `).all(req.student.username);
    res.json(rows);
});

// Get messages for a group (must be a member)
app.get('/api/student/chat-groups/:id/messages', requireStudentAuth, (req, res) => {
    if (!isGroupMember(req.params.id, req.student.username)) {
        return res.status(403).json({ error: 'You are not a member of this group.' });
    }
    const rows = db.prepare('SELECT * FROM chat_messages WHERE group_id = ? ORDER BY id ASC').all(req.params.id);
    res.json(rows);
});

// Send a message to a group (must be a member)
app.post('/api/student/chat-groups/:id/messages', requireStudentAuth, (req, res) => {
    if (!isGroupMember(req.params.id, req.student.username)) {
        return res.status(403).json({ error: 'You are not a member of this group.' });
    }
    const { message } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (message.length > 1000) return res.status(400).json({ error: 'Message is too long.' });

    const info = db.prepare('INSERT INTO chat_messages (group_id, sender_username, sender_name, message) VALUES (?,?,?,?)')
        .run(req.params.id, req.student.username, req.student.name, message.trim());
    const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
});

// ---------- Admin oversight of student chats (moderation, not editable) ----------
app.get('/api/chat-groups', requireAuth, (req, res) => {
    const rows = db.prepare(`
        SELECT g.id, g.name, g.created_by, g.created_at,
               (SELECT COUNT(*) FROM chat_group_members m WHERE m.group_id = g.id) AS member_count,
               (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = g.id) AS message_count
        FROM chat_groups g ORDER BY g.id DESC
    `).all();
    res.json(rows);
});

app.get('/api/chat-groups/:id/messages', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM chat_messages WHERE group_id = ? ORDER BY id ASC').all(req.params.id);
    res.json(rows);
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

// ---------- Site settings (e.g. admission status) ----------
app.get('/api/settings/admission-status', (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'admission_status'").get();
    res.json({ status: row ? row.value : 'Open' });
});

app.post('/api/settings/admission-status', requireAuth, (req, res) => {
    const { status } = req.body || {};
    const allowed = ['Open', 'Closed', 'Opening Soon'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Status must be one of: ' + allowed.join(', ') });
    }
    db.prepare("INSERT INTO settings (key, value) VALUES ('admission_status', ?) ON CONFLICT(key) DO UPDATE SET value = ?")
      .run(status, status);
    res.json({ ok: true, status });
});

// ---------- Notice board ----------
const NOTICE_CATEGORIES = ['General', 'Event', 'Urgent', 'Holiday'];

// Public: anyone (homepage visitors, students) can read notices, no login needed
app.get('/api/notices/public', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const rows = db.prepare('SELECT id, title, content, category, pinned, created_at FROM notices ORDER BY pinned DESC, id DESC LIMIT ?').all(limit);
    res.json(rows);
});

// Admin: manage notices
app.get('/api/notices', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM notices ORDER BY pinned DESC, id DESC').all());
});

app.post('/api/notices', requireAuth, (req, res) => {
    const { title, content, category, pinned } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });
    const cat = NOTICE_CATEGORIES.includes(category) ? category : 'General';
    const info = db.prepare('INSERT INTO notices (title, content, category, pinned, posted_by) VALUES (?,?,?,?,?)')
        .run(title, content, cat, (pinned === true || pinned === 'true' || pinned === 1 || pinned === '1') ? 1 : 0, req.admin);
    const row = db.prepare('SELECT * FROM notices WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
});

app.delete('/api/notices/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
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
registerCrud('homework', 'homework', ['class', 'subject', 'title', 'description', 'due_date']);

// ---------- Student account management (any logged-in admin/staff can do this) ----------
app.get('/api/student-accounts', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT id, username, student_name, class, email, uid FROM student_logins ORDER BY id DESC').all();
    res.json(rows);
});

app.post('/api/student-accounts', requireAuth, (req, res) => {
    const { username, password, student_name, class: className, email } = req.body || {};
    if (!username || !password || !student_name) {
        return res.status(400).json({ error: 'Username, password, and student name are required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const existing = db.prepare('SELECT id FROM student_logins WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'That username is already taken.' });

    const hash = bcrypt.hashSync(password, 10);
    const uid = generateStudentUid();
    const info = db.prepare('INSERT INTO student_logins (username, password_hash, student_name, class, email, uid) VALUES (?,?,?,?,?,?)')
        .run(username, hash, student_name, className || '', email || '', uid);
    const row = db.prepare('SELECT id, username, student_name, class, email, uid FROM student_logins WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
});

app.delete('/api/student-accounts/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM student_logins WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

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

// ==========================================================
// PAYMENTS — eSewa, Khalti, and Stripe (cards)
// Covers both fee payments and donations.
// ==========================================================

function newReference() {
    return 'PAY-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
}

function recordPayment({ reference, purpose, payer_name, payer_email, student_name, amount, method }) {
    db.prepare(`INSERT INTO payments (reference, purpose, payer_name, payer_email, student_name, amount, method, status)
                VALUES (?,?,?,?,?,?,?,'pending')`)
      .run(reference, purpose, payer_name || '', payer_email || '', student_name || '', amount, method);
}

function markPayment(reference, status, providerRef) {
    db.prepare('UPDATE payments SET status = ?, provider_ref = ? WHERE reference = ?')
      .run(status, providerRef || null, reference);
}

// ---------- List payments (admin only) ----------
app.get('/api/payments', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM payments ORDER BY id DESC').all());
});

// Deleting a financial record is sensitive — restricted to owner accounts only
app.delete('/api/payments/:id', requireAuth, requireOwner, (req, res) => {
    const row = db.prepare('SELECT id FROM payments WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Payment record not found.' });
    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// Deleting a financial record is restricted to owner accounts, to keep the
// payment ledger trustworthy — staff can view it but not erase history.
app.delete('/api/payments/:id', requireAuth, requireOwner, (req, res) => {
    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

// ---------- 1) eSewa ----------
// eSewa v2 works by redirecting the browser to eSewa with a signed form.
app.post('/api/payments/esewa/initiate', (req, res) => {
    const { purpose, payer_name, payer_email, student_name, amount } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'A valid amount is required.' });

    const reference = newReference();
    recordPayment({ reference, purpose, payer_name, payer_email, student_name, amount: amt, method: 'esewa' });

    const total_amount = amt;
    const signedString = `total_amount=${total_amount},transaction_uuid=${reference},product_code=${ESEWA_PRODUCT_CODE}`;
    const signature = crypto.createHmac('sha256', ESEWA_SECRET_KEY).update(signedString).digest('base64');

    res.json({
        gatewayUrl: ESEWA_GATEWAY_URL,
        fields: {
            amount: amt,
            tax_amount: 0,
            total_amount,
            transaction_uuid: reference,
            product_code: ESEWA_PRODUCT_CODE,
            product_service_charge: 0,
            product_delivery_charge: 0,
            success_url: `${SITE_URL}/api/payments/esewa/callback`,
            failure_url: `${SITE_URL}/payment-result.html?status=failed&method=esewa`,
            signed_field_names: 'total_amount,transaction_uuid,product_code',
            signature
        }
    });
});

// eSewa redirects the browser back here (GET) with a base64 "data" param
app.get('/api/payments/esewa/callback', async (req, res) => {
    try {
        const decoded = JSON.parse(Buffer.from(req.query.data, 'base64').toString('utf-8'));
        const { transaction_uuid, total_amount, status } = decoded;

        // Re-verify directly with eSewa's status API (never trust the redirect alone)
        const url = `${ESEWA_STATUS_URL}?product_code=${ESEWA_PRODUCT_CODE}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`;
        const verifyRes = await fetch(url);
        const verifyData = await verifyRes.json();

        if (verifyData.status === 'COMPLETE') {
            markPayment(transaction_uuid, 'completed', decoded.transaction_code || '');
            return res.redirect(`/payment-result.html?status=success&method=esewa&ref=${transaction_uuid}`);
        }
        markPayment(transaction_uuid, 'failed', '');
        res.redirect(`/payment-result.html?status=failed&method=esewa&ref=${transaction_uuid}`);
    } catch (err) {
        res.redirect(`/payment-result.html?status=failed&method=esewa`);
    }
});

// ---------- 2) Khalti ----------
app.post('/api/payments/khalti/initiate', async (req, res) => {
    if (!KHALTI_SECRET_KEY) {
        return res.status(503).json({ error: 'Khalti is not configured yet. Add KHALTI_SECRET_KEY to your .env file (get a free sandbox key from test-admin.khalti.com).' });
    }
    const { purpose, payer_name, payer_email, student_name, amount } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'A valid amount is required.' });

    const reference = newReference();
    recordPayment({ reference, purpose, payer_name, payer_email, student_name, amount: amt, method: 'khalti' });

    try {
        const khaltiRes = await fetch(`${KHALTI_BASE_URL}/epayment/initiate/`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                return_url: `${SITE_URL}/api/payments/khalti/callback`,
                website_url: SITE_URL,
                amount: Math.round(amt * 100), // Khalti expects paisa
                purchase_order_id: reference,
                purchase_order_name: purpose === 'donation' ? 'Donation' : 'School Fee Payment',
                customer_info: { name: payer_name || 'Guest', email: payer_email || 'guest@example.com' }
            })
        });
        const data = await khaltiRes.json();
        if (!khaltiRes.ok) throw new Error(data.detail || 'Khalti initiation failed.');
        res.json({ paymentUrl: data.payment_url });
    } catch (err) {
        markPayment(reference, 'failed', '');
        res.status(502).json({ error: 'Could not start Khalti payment: ' + err.message });
    }
});

app.get('/api/payments/khalti/callback', async (req, res) => {
    const { pidx, purchase_order_id } = req.query;
    try {
        const lookupRes = await fetch(`${KHALTI_BASE_URL}/epayment/lookup/`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pidx })
        });
        const data = await lookupRes.json();
        const reference = purchase_order_id;
        if (data.status === 'Completed') {
            markPayment(reference, 'completed', pidx);
            return res.redirect(`/payment-result.html?status=success&method=khalti&ref=${reference}`);
        }
        markPayment(reference, 'failed', pidx);
        res.redirect(`/payment-result.html?status=failed&method=khalti&ref=${reference}`);
    } catch (err) {
        res.redirect('/payment-result.html?status=failed&method=khalti');
    }
});

// ---------- 3) Stripe (international / local cards) ----------
app.post('/api/payments/stripe/initiate', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Card payments are not configured yet. Add STRIPE_SECRET_KEY to your .env file (free test key from dashboard.stripe.com).' });
    }
    const { purpose, payer_name, payer_email, student_name, amount } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'A valid amount is required.' });

    const reference = newReference();
    recordPayment({ reference, purpose, payer_name, payer_email, student_name, amount: amt, method: 'stripe' });

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'npr',
                    product_data: { name: purpose === 'donation' ? 'Donation to Shree Navajagriti Chandi School' : 'School Fee Payment' },
                    unit_amount: Math.round(amt * 100)
                },
                quantity: 1
            }],
            customer_email: payer_email || undefined,
            success_url: `${SITE_URL}/api/payments/stripe/callback?session_id={CHECKOUT_SESSION_ID}&ref=${reference}`,
            cancel_url: `${SITE_URL}/payment-result.html?status=failed&method=stripe&ref=${reference}`
        });
        res.json({ paymentUrl: session.url });
    } catch (err) {
        markPayment(reference, 'failed', '');
        res.status(502).json({ error: 'Could not start card payment: ' + err.message });
    }
});

app.get('/api/payments/stripe/callback', async (req, res) => {
    const { session_id, ref } = req.query;
    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status === 'paid') {
            markPayment(ref, 'completed', session.id);
            return res.redirect(`/payment-result.html?status=success&method=stripe&ref=${ref}`);
        }
        markPayment(ref, 'failed', session.id);
        res.redirect(`/payment-result.html?status=failed&method=stripe&ref=${ref}`);
    } catch (err) {
        res.redirect('/payment-result.html?status=failed&method=stripe');
    }
});

app.listen(PORT, () => {
    console.log(`Shree Navajagriti Chandi School server running at http://localhost:${PORT}`);
});
