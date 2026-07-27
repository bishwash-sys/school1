// ---------- My UID ----------
studentApiRequest('/api/student/my-uid')
    .then(data => { document.getElementById('my-uid-display').textContent = data.uid; })
    .catch(() => {});

// ---------- Search for a friend by UID ----------
const searchInput = document.getElementById('uid-search-input');
const searchStatus = document.getElementById('search-status');
const searchResultBox = document.getElementById('search-result');

document.getElementById('uid-search-btn').addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

function doSearch() {
    const uid = searchInput.value.trim();
    searchResultBox.innerHTML = '';
    searchStatus.textContent = '';
    if (!uid) {
        searchStatus.textContent = 'Enter a UID first.';
        return;
    }

    studentApiRequest('/api/student/search?uid=' + encodeURIComponent(uid))
        .then(data => {
            searchResultBox.innerHTML = `
                <div class="search-result-card">
                    <div style="display:flex; align-items:center; gap:.7rem;">
                        <div class="friend-avatar">${initials(data.name)}</div>
                        <div>
                            <div class="friend-name">${data.name}</div>
                            ${data.class ? `<div class="friend-class">${data.class}</div>` : ''}
                        </div>
                    </div>
                    ${data.alreadyFriends
                        ? '<span style="color:#8a9084; font-size:.85rem;">Already friends</span>'
                        : `<button class="btn" id="add-friend-btn" style="padding:.4rem 1rem; font-size:.85rem;">Add Friend</button>`}
                </div>
            `;
            const addBtn = document.getElementById('add-friend-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => addFriend(uid, data.name));
            }
        })
        .catch(err => { searchStatus.textContent = err.message; });
}

function addFriend(uid, name) {
    studentApiRequest('/api/student/contacts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
    })
    .then(() => {
        searchStatus.textContent = `Added ${name} as a friend!`;
        searchResultBox.innerHTML = '';
        searchInput.value = '';
        loadFriends();
    })
    .catch(err => { searchStatus.textContent = err.message; });
}

// ---------- Friends list ----------
function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function loadFriends() {
    studentApiRequest('/api/student/contacts')
        .then(friends => {
            const box = document.getElementById('friends-list');
            const checklist = document.getElementById('contacts-checklist');

            if (!friends.length) {
                box.innerHTML = '<p style="color:#8a9084; font-size:.9rem;">No friends yet — search their UID above to add one.</p>';
                checklist.innerHTML = '<p style="color:#8a9084; font-size:.88rem;">No friends yet.</p>';
                return;
            }

            box.innerHTML = friends.map(f => `
                <div class="friend-row">
                    <div class="friend-avatar">${initials(f.student_name)}</div>
                    <div class="friend-info">
                        <div class="friend-name">${f.student_name}</div>
                        ${f.class ? `<div class="friend-class">${f.class}</div>` : ''}
                    </div>
                    <button class="remove-friend-btn" data-username="${f.username}">Remove</button>
                </div>
            `).join('');
            box.querySelectorAll('.remove-friend-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!confirm('Remove this friend?')) return;
                    studentApiRequest('/api/student/contacts/' + encodeURIComponent(btn.dataset.username), { method: 'DELETE' })
                        .then(() => loadFriends())
                        .catch(err => alert(err.message));
                });
            });

            checklist.innerHTML = `<div class="friend-select-list">${friends.map(c => `
                <label class="friend-select-row">
                    <div class="friend-avatar">${initials(c.student_name)}</div>
                    <div class="friend-info">
                        <div class="friend-name">${c.student_name}</div>
                        ${c.class ? `<div class="friend-class">${c.class}</div>` : ''}
                    </div>
                    <input type="checkbox" value="${c.username}" class="contact-check">
                </label>
            `).join('')}</div>`;

            checklist.querySelectorAll('.friend-select-row').forEach(row => {
                const checkbox = row.querySelector('input');
                checkbox.addEventListener('change', () => row.classList.toggle('checked', checkbox.checked));
            });
        }).catch(() => {});
}
loadFriends();

// ---------- Create a group chat ----------
document.getElementById('create-group-btn').addEventListener('click', () => {
    const name = document.getElementById('group-name-input').value.trim();
    const members = Array.from(document.querySelectorAll('.contact-check:checked')).map(el => el.value);
    if (!name) return alert('Please enter a group name.');
    if (!members.length) return alert('Select at least one friend.');

    studentApiRequest('/api/student/chat-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, member_usernames: members })
    })
    .then(() => {
        document.getElementById('group-name-input').value = '';
        document.querySelectorAll('.contact-check:checked').forEach(el => el.checked = false);
        loadGroups();
    })
    .catch(err => alert(err.message));
});

function loadGroups() {
    studentApiRequest('/api/student/chat-groups')
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
