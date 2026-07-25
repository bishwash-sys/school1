// Shared admin shell — used by every admin-*.html subpage.
// Handles: auth guard, sidebar/header rendering, and small API helpers.

const ADMIN_NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', href: 'admin-dashboard.html' },
    { id: 'students', label: 'Students', href: 'admin-students.html' },
    { id: 'teachers', label: 'Teachers', href: 'admin-teachers.html' },
    { id: 'classes', label: 'Classes', href: 'admin-classes.html' },
    { id: 'attendance', label: 'Attendance', href: 'admin-attendance.html' },
    { id: 'fees', label: 'Fees', href: 'admin-fees.html' },
    { id: 'results', label: 'Results', href: 'admin-results.html' },
    { id: 'homework', label: 'Homework', href: 'admin-homework.html' },
    { id: 'student-accounts', label: 'Student Accounts', href: 'admin-student-accounts.html' },
    { id: 'chats', label: 'Student Chats', href: 'admin-chats.html' },
    { id: 'payments', label: 'Payments', href: 'admin-payments.html' },
    { id: 'account', label: 'My Account', href: 'admin-account.html' }
];

const token = sessionStorage.getItem('adminToken');
if (!token) {
    alert('Access denied. Please log in first.');
    window.location.href = 'admin-login.html';
}

function authHeaders(extra) {
    return Object.assign({ 'Authorization': 'Bearer ' + token }, extra || {});
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

function showToast(msg, isError) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    apiRequest('/api/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.clear();
    window.location.replace('admin-login.html');
}

// Builds the sidebar + header for the current page.
// activePageId must match one of the ids in ADMIN_NAV_ITEMS, or 'admin-users'.
function renderAdminShell(activePageId, pageTitle) {
    const role = sessionStorage.getItem('adminRole') || 'staff';

    const navHtml = ADMIN_NAV_ITEMS.map(item =>
        `<li><a href="${item.href}" class="nav-link${item.id === activePageId ? ' active' : ''}">${item.label}</a></li>`
    ).join('') + (role === 'owner'
        ? `<li><a href="admin-users.html" class="nav-link${activePageId === 'admin-users' ? ' active' : ''}">Admin Users</a></li>`
        : '');

    document.getElementById('sidebar-mount').innerHTML = `
        <h2>🏫 Shree Navajagriti<br>Chandi School</h2>
        <ul class="nav-menu">${navHtml}</ul>
    `;

    document.getElementById('header-mount').innerHTML = `
        <h1>${pageTitle}</h1>
        <div class="header-actions">
            <a href="index.html" class="home-link">Back to Home</a>
            <button onclick="logout()" class="logout-btn">Logout</button>
        </div>
    `;
}

// Generic table + form wiring, shared by every CRUD-style subpage.
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
                        .then(() => { showToast('Record deleted.'); refresh(); if (cfg.afterChange) cfg.afterChange(); })
                        .catch(err => showToast(err.message, true));
                });
            });
        }).catch(() => {});
    }

    if (form) {
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
                if (cfg.afterChange) cfg.afterChange();
            }).catch(err => showToast(err.message, true));
        });
    }

    refresh();
    return { refresh };
}
