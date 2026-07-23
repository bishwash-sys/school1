// Student dashboard — Shree Navajagriti Chandi School
// Note: uses a completely separate "studentToken" from the admin's "adminToken",
// and only ever talks to /api/student/* routes, which never grant admin access.

const token = sessionStorage.getItem('studentToken');
if (!token) {
    alert('Please log in first.');
    window.location.href = 'student-login.html';
}

const studentName = sessionStorage.getItem('studentName') || 'Student';
const studentClass = sessionStorage.getItem('studentClass') || '';
document.getElementById('student-name-display').textContent = studentName;
document.getElementById('student-class-display').textContent = studentClass || '—';

// Pre-fill the payment page with this student's details
document.getElementById('pay-fees-link').href =
    `pay.html?student=${encodeURIComponent(studentName)}`;

function studentLogout() {
    fetch('/api/student-logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
    sessionStorage.clear();
    window.location.href = 'student-login.html';
}

fetch('/api/student/homework', {
    headers: { 'Authorization': 'Bearer ' + token }
})
.then(async (r) => {
    if (r.status === 401) {
        sessionStorage.clear();
        alert('Your session expired. Please log in again.');
        window.location.href = 'student-login.html';
        throw new Error('Unauthorized');
    }
    return r.json();
})
.then((rows) => {
    const list = document.getElementById('homework-list');
    if (!rows.length) {
        list.innerHTML = '<div class="empty-state">No homework posted yet for your class.</div>';
        return;
    }
    list.innerHTML = rows.map(hw => `
        <div class="hw-card">
            <div class="hw-top">
                <h3>${hw.title}</h3>
                ${hw.due_date ? `<span class="hw-due">Due: ${hw.due_date}</span>` : ''}
            </div>
            ${hw.subject ? `<span class="hw-tag">${hw.subject}</span>` : ''}
            ${hw.description ? `<p class="hw-desc">${hw.description}</p>` : ''}
        </div>
    `).join('');
})
.catch(() => {});
