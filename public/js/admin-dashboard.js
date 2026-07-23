// Admin dashboard logic — Shree Navajagriti Chandi School
// Talks to the Express + SQLite API using the session token from login.

// ---------- Auth guard ----------
const token = sessionStorage.getItem('adminToken');
if (!token) {
    alert('Access denied. Please log in first.');
    window.location.href = 'admin-login.html';
}

function authHeaders(extra) {
    return Object.assign({ 'Authorization': 'Bearer ' + token }, extra || {});
}

function showToast(msg, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

async function apiRequest(url, options) {
    const res = await fetch(url, Object.assign({}, options, { headers: authHeaders(options && options.headers) }));
    if (res.status === 401) {
        sessionStorage.clear();
        alert('Your session expired. Please log in again.');
        window.location.href = 'admin-login.html';
        throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

wireResource({
    resource: 'homework',
    tbodyId: 'tbl-homework',
    formId: 'form-homework',
    colspan: 5,
    successMsg: 'Homework posted.',
    fields: [
        { inputId: 'hw-class', key: 'class' },
        { inputId: 'hw-subject', key: 'subject' },
        { inputId: 'hw-title', key: 'title' },
        { inputId: 'hw-description', key: 'description' },
        { inputId: 'hw-due', key: 'due_date' }
    ],
    render: row => `<tr>
        <td>${row.class}</td><td>${row.subject || ''}</td><td>${row.title}</td><td>${row.due_date || ''}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

wireResource({
    resource: 'student-accounts',
    tbodyId: 'tbl-student-accounts',
    formId: 'form-student-accounts',
    colspan: 4,
    successMsg: 'Student login created.',
    fields: [
        { inputId: 'sa-name', key: 'student_name' },
        { inputId: 'sa-class', key: 'class' },
        { inputId: 'sa-username', key: 'username' },
        { inputId: 'sa-password', key: 'password' },
        { inputId: 'sa-email', key: 'email' }
    ],
    render: row => `<tr>
        <td>${row.student_name}</td><td>${row.class || ''}</td><td>${row.username}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

// ---------- Payments ledger (view only) ----------
function loadPayments() {
    apiRequest('/api/payments').then(rows => {
        const tbody = document.getElementById('tbl-payments');
        if (!rows.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No payments yet.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => `<tr>
            <td>${(r.created_at || '').slice(0, 16).replace('T', ' ')}</td>
            <td>${r.purpose === 'donation' ? 'Donation' : 'School Fee'}</td>
            <td>${r.payer_name || ''}${r.payer_email ? ' (' + r.payer_email + ')' : ''}</td>
            <td>${r.student_name || '—'}</td>
            <td>NPR ${r.amount}</td>
            <td>${r.method}</td>
            <td>${r.status}</td>
        </tr>`).join('');
    }).catch(() => {});
}
loadPayments();

// ---------- My Account: change password ----------
document.getElementById('acct-username').textContent = sessionStorage.getItem('adminUsername') || '';

document.getElementById('form-change-password').addEventListener('submit', function (e) {
    e.preventDefault();
    const currentPassword = document.getElementById('cp-current').value;
    const newPassword = document.getElementById('cp-new').value;
    const confirmPassword = document.getElementById('cp-confirm').value;

    if (newPassword !== confirmPassword) {
        showToast("New passwords don't match.", true);
        return;
    }

    apiRequest('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
    }).then(() => {
        showToast('Password updated. Please log in again.');
        this.reset();
        setTimeout(() => {
            sessionStorage.clear();
            window.location.href = 'admin-login.html';
        }, 1500);
    }).catch(err => showToast(err.message, true));
});

// ---------- Show "Admin Users" management only to owner accounts ----------
if (sessionStorage.getItem('adminRole') === 'owner') {
    document.getElementById('nav-admins-item').style.display = '';
}

// ---------- Sidebar navigation ----------
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        const sectionId = this.getAttribute('data-section');
        document.getElementById(sectionId).classList.add('active');
    });
});

function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    apiRequest('/api/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.clear();
    window.location.replace('admin-login.html');
}

// ---------- Dashboard stats ----------
function loadDashboard() {
    apiRequest('/api/dashboard-stats').then(data => {
        document.getElementById('d-students').textContent = data.students;
        document.getElementById('d-teachers').textContent = data.teachers;
        document.getElementById('d-classes').textContent = data.classes;
        document.getElementById('d-fees').textContent = 'NPR ' + data.pendingFees;
    }).catch(() => {});
}

// ---------- Generic table + form wiring ----------
// config maps: resource name -> { tbody id, form id, fields: [{input id, key}], render(row) -> <tr> html }
function wireResource(cfg) {
    const tbody = document.getElementById(cfg.tbodyId);
    const form = document.getElementById(cfg.formId);

    function refresh() {
        apiRequest('/api/' + cfg.resource).then(rows => {
            if (!rows.length) {
                tbody.innerHTML = `<tr class="empty-row"><td colspan="${cfg.colspan}">No records yet.</td></tr>`;
                return;
            }
            tbody.innerHTML = rows.map(cfg.render).join('');
            tbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!confirm('Delete this record?')) return;
                    apiRequest('/api/' + cfg.resource + '/' + btn.dataset.id, { method: 'DELETE' })
                        .then(() => { showToast('Record deleted.'); refresh(); loadDashboard(); })
                        .catch(err => showToast(err.message, true));
                });
            });
        }).catch(() => {});
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const body = {};
        cfg.fields.forEach(f => {
            const el = document.getElementById(f.inputId);
            body[f.key] = f.numeric ? Number(el.value || 0) : el.value;
        });
        apiRequest('/api/' + cfg.resource, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(() => {
            showToast(cfg.successMsg || 'Added successfully.');
            form.reset();
            refresh();
            loadDashboard();
        }).catch(err => showToast(err.message, true));
    });

    refresh();
}

// ---------- Section configs ----------
wireResource({
    resource: 'students',
    tbodyId: 'tbl-students',
    formId: 'form-students',
    colspan: 5,
    successMsg: 'Student added.',
    fields: [
        { inputId: 's-roll', key: 'roll_no' },
        { inputId: 's-name', key: 'name' },
        { inputId: 's-class', key: 'class' },
        { inputId: 's-email', key: 'email' }
    ],
    render: row => `<tr>
        <td>${row.roll_no || ''}</td><td>${row.name}</td><td>${row.class || ''}</td><td>${row.email || ''}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

wireResource({
    resource: 'teachers',
    tbodyId: 'tbl-teachers',
    formId: 'form-teachers',
    colspan: 4,
    successMsg: 'Teacher added.',
    fields: [
        { inputId: 't-name', key: 'name' },
        { inputId: 't-subject', key: 'subject' },
        { inputId: 't-email', key: 'email' }
    ],
    render: row => `<tr>
        <td>${row.name}</td><td>${row.subject || ''}</td><td>${row.email || ''}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

wireResource({
    resource: 'classes',
    tbodyId: 'tbl-classes',
    formId: 'form-classes',
    colspan: 4,
    successMsg: 'Class added.',
    fields: [
        { inputId: 'cl-name', key: 'name' },
        { inputId: 'cl-teacher', key: 'teacher' },
        { inputId: 'cl-count', key: 'students_count', numeric: true }
    ],
    render: row => `<tr>
        <td>${row.name}</td><td>${row.teacher || ''}</td><td>${row.students_count || 0}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

wireResource({
    resource: 'attendance',
    tbodyId: 'tbl-attendance',
    formId: 'form-attendance',
    colspan: 4,
    successMsg: 'Attendance recorded.',
    fields: [
        { inputId: 'a-class', key: 'class' },
        { inputId: 'a-date', key: 'date' },
        { inputId: 'a-status', key: 'status' }
    ],
    render: row => `<tr>
        <td>${row.class}</td><td>${row.date}</td><td>${row.status}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

wireResource({
    resource: 'fees',
    tbodyId: 'tbl-fees',
    formId: 'form-fees',
    colspan: 4,
    successMsg: 'Fee record added.',
    fields: [
        { inputId: 'f-name', key: 'student_name' },
        { inputId: 'f-amount', key: 'amount', numeric: true },
        { inputId: 'f-due', key: 'due_date' },
        { inputId: 'f-status', key: 'status' }
    ],
    render: row => `<tr>
        <td>${row.student_name}</td><td>NPR ${row.amount}</td><td>${row.status}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

wireResource({
    resource: 'results',
    tbodyId: 'tbl-results',
    formId: 'form-results',
    colspan: 4,
    successMsg: 'Result added.',
    fields: [
        { inputId: 'r-name', key: 'student_name' },
        { inputId: 'r-subject', key: 'subject' },
        { inputId: 'r-marks', key: 'marks', numeric: true }
    ],
    render: row => `<tr>
        <td>${row.student_name}</td><td>${row.subject}</td><td>${row.marks}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});

if (sessionStorage.getItem('adminRole') === 'owner') {
    wireResource({
        resource: 'admins',
        tbodyId: 'tbl-admins',
        formId: 'form-admins',
        colspan: 4,
        successMsg: 'Login created.',
        fields: [
            { inputId: 'au-fullname', key: 'full_name' },
            { inputId: 'au-username', key: 'username' },
            { inputId: 'au-password', key: 'password' },
            { inputId: 'au-role', key: 'role' }
        ],
        render: row => `<tr>
            <td>${row.full_name || ''}</td><td>${row.username}</td><td>${row.role}</td>
            <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
        </tr>`
    });
}

loadDashboard();
