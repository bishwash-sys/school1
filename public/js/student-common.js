// Shared student portal shell — used by every student-*.html subpage.

const STUDENT_NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', href: 'student-dashboard.html' },
    { id: 'homework', label: 'Homework', href: 'student-homework.html' },
    { id: 'notices', label: 'Notices', href: 'student-notices.html' },
    { id: 'groups', label: 'Study Groups', href: 'student-groups.html' }
];

const token = sessionStorage.getItem('studentToken');
if (!token) {
    alert('Please log in first.');
    window.location.href = 'student-login.html';
}

function studentAuthHeaders(extra) {
    return Object.assign({ 'Authorization': 'Bearer ' + token }, extra || {});
}

async function studentApiRequest(url, options) {
    const res = await fetch(url, Object.assign({}, options, { headers: studentAuthHeaders(options && options.headers) }));
    if (res.status === 401) {
        sessionStorage.clear();
        alert('Your session expired. Please log in again.');
        window.location.href = 'student-login.html';
        throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function studentLogout() {
    fetch('/api/student-logout', { method: 'POST', headers: studentAuthHeaders() }).catch(() => {});
    sessionStorage.clear();
    window.location.href = 'student-login.html';
}

function renderStudentShell(activePageId) {
    const studentName = sessionStorage.getItem('studentName') || 'Student';
    const studentClass = sessionStorage.getItem('studentClass') || '';

    const navHtml = STUDENT_NAV_ITEMS.map(item =>
        `<a href="${item.href}" class="student-nav-link${item.id === activePageId ? ' active' : ''}">${item.label}</a>`
    ).join('');

    document.getElementById('student-nav-mount').innerHTML = `
        <div class="student-brand">
            <strong>${studentName}</strong>
            <span class="student-class-tag">Class: ${studentClass || '—'}</span>
        </div>
        <nav class="student-nav">${navHtml}</nav>
        <div class="student-actions">
            <a href="pay.html?student=${encodeURIComponent(studentName)}" class="btn" style="padding:.5rem 1.1rem; font-size:.85rem;">Pay Fees</a>
            <button class="logout-link" onclick="studentLogout()">Logout</button>
        </div>
    `;
}
