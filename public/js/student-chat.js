// Student group chat — Shree Navajagriti Chandi School
// Polls for new messages every few seconds (no websocket infra needed).

const token = sessionStorage.getItem('studentToken');
const myUsername = sessionStorage.getItem('studentUsername'); // set below if missing
if (!token) {
    alert('Please log in first.');
    window.location.href = 'student-login.html';
}

const params = new URLSearchParams(window.location.search);
const groupId = params.get('group');
if (!groupId) {
    alert('No group selected.');
    window.location.href = 'student-groups.html';
}

const messagesBox = document.getElementById('messages');
let knownIds = new Set();

function renderMessages(rows) {
    rows.forEach(m => {
        if (knownIds.has(m.id)) return;
        knownIds.add(m.id);
        const mine = m.sender_username === sessionStorage.getItem('studentUsername');
        const div = document.createElement('div');
        div.className = 'msg ' + (mine ? 'mine' : 'theirs');
        div.innerHTML = `<span class="sender">${m.sender_name}</span>${escapeHtml(m.message)}`;
        messagesBox.appendChild(div);
    });
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function loadMessages() {
    fetch(`/api/student/chat-groups/${groupId}/messages`, {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(async (r) => {
        if (r.status === 401) {
            sessionStorage.clear();
            window.location.href = 'student-login.html';
            throw new Error('Unauthorized');
        }
        if (r.status === 403) {
            alert('You are not a member of this group.');
            window.location.href = 'student-groups.html';
            throw new Error('Forbidden');
        }
        return r.json();
    })
    .then(rows => renderMessages(rows))
    .catch(() => {});
}

document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    fetch(`/api/student/chat-groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
    })
    .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Could not send message.');
        return data;
    })
    .then(() => loadMessages())
    .catch(err => alert(err.message));
}

loadMessages();
setInterval(loadMessages, 3000);
