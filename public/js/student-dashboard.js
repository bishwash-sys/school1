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

// ---------- My QR code ----------
fetch('/api/student/my-qr', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(r => r.json())
    .then(data => { document.getElementById('my-qr-img').src = data.qrDataUrl; })
    .catch(() => {});

// ---------- QR scanning (camera) ----------
let scanStream = null;
let scanning = false;

const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const scannerWrap = document.getElementById('scanner-wrap');
const scanStatus = document.getElementById('scan-status');
const video = document.getElementById('scanner-video');

startScanBtn.addEventListener('click', async () => {
    try {
        scanStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } }
        });
        video.srcObject = scanStream;
        video.play();
        scannerWrap.style.display = 'block';
        scanStatus.textContent = 'Point your camera at your classmate\'s QR code...';
        scanning = true;
        requestAnimationFrame(tickScan);
    } catch (err) {
        scanStatus.textContent = 'Could not access camera: ' + err.message;
    }
});

stopScanBtn.addEventListener('click', stopScanning);

function stopScanning() {
    scanning = false;
    if (scanStream) {
        scanStream.getTracks().forEach(t => t.stop());
        scanStream = null;
    }
    scannerWrap.style.display = 'none';
}

const scanCanvas = document.createElement('canvas');
const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
const SCAN_MAX_DIM = 480; // downscaling the frame makes jsQR dramatically faster on phones

function tickScan() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const vw = video.videoWidth, vh = video.videoHeight;
        const scale = Math.min(1, SCAN_MAX_DIM / Math.max(vw, vh));
        scanCanvas.width = Math.round(vw * scale);
        scanCanvas.height = Math.round(vh * scale);
        scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
        const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
            stopScanning();
            addContactByCode(code.data);
            return;
        }
    }
    requestAnimationFrame(tickScan);
}

function addContactByCode(contactCode) {
    scanStatus.textContent = 'Adding contact...';
    fetch('/api/student/contacts/add', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_code: contactCode })
    })
    .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Could not add contact.');
        return data;
    })
    .then((data) => {
        scanStatus.textContent = `Added ${data.addedContact.name} as a contact!`;
        loadContacts();
    })
    .catch(err => { scanStatus.textContent = err.message; });
}

// ---------- Contacts + group creation ----------
function loadContacts() {
    fetch('/api/student/contacts', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(contacts => {
            const box = document.getElementById('contacts-checklist');
            if (!contacts.length) {
                box.innerHTML = '<p style="color:#8a9084; font-size:.88rem;">No contacts yet — scan a classmate\'s QR code first.</p>';
                return;
            }
            box.innerHTML = contacts.map(c => `
                <label style="display:flex; align-items:center; gap:.5rem; margin-bottom:.4rem; font-size:.9rem;">
                    <input type="checkbox" value="${c.username}" class="contact-check">
                    ${c.student_name} ${c.class ? '(' + c.class + ')' : ''}
                </label>
            `).join('');
        }).catch(() => {});
}
loadContacts();

document.getElementById('create-group-btn').addEventListener('click', () => {
    const name = document.getElementById('group-name-input').value.trim();
    const members = Array.from(document.querySelectorAll('.contact-check:checked')).map(el => el.value);
    if (!name) return alert('Please enter a group name.');
    if (!members.length) return alert('Select at least one classmate.');

    fetch('/api/student/chat-groups', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, member_usernames: members })
    })
    .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Could not create group.');
        return data;
    })
    .then(() => {
        document.getElementById('group-name-input').value = '';
        document.querySelectorAll('.contact-check:checked').forEach(el => el.checked = false);
        loadGroups();
    })
    .catch(err => alert(err.message));
});

function loadGroups() {
    fetch('/api/student/chat-groups', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(groups => {
            const box = document.getElementById('groups-list');
            if (!groups.length) {
                box.innerHTML = '<div class="empty-state">No groups yet.</div>';
                return;
            }
            box.innerHTML = groups.map(g => `
                <div class="hw-card" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>${g.name}</span>
                    <a href="student-chat.html?group=${g.id}" class="btn" style="padding:.5rem 1.2rem; font-size:.85rem;">Open Chat</a>
                </div>
            `).join('');
        }).catch(() => {});
}
loadGroups();
