function loadChatGroups() {
    apiRequest('/api/chat-groups').then(rows => {
        const tbody = document.getElementById('tbl-chats');
        if (!rows.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No chat groups yet.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(g => `<tr>
            <td>${g.name}</td><td>${g.created_by}</td><td>${g.member_count}</td><td>${g.message_count}</td>
            <td><button class="btn-submit view-chat-btn" data-id="${g.id}" data-name="${g.name}" style="padding:.4rem .9rem; font-size:.8rem;">View</button></td>
        </tr>`).join('');
        tbody.querySelectorAll('.view-chat-btn').forEach(btn => {
            btn.addEventListener('click', () => viewChatMessages(btn.dataset.id, btn.dataset.name));
        });
    }).catch(() => {});
}

function viewChatMessages(groupId, groupName) {
    apiRequest(`/api/chat-groups/${groupId}/messages`).then(rows => {
        document.getElementById('chat-messages-view').style.display = 'block';
        document.getElementById('chat-messages-title').textContent = `Messages in "${groupName}"`;
        const list = document.getElementById('chat-messages-list');
        if (!rows.length) {
            list.innerHTML = '<p style="color:#8a9084; font-size:.9rem;">No messages yet.</p>';
            return;
        }
        list.innerHTML = rows.map(m => `
            <div style="margin-bottom:.6rem; font-size:.88rem;">
                <strong>${m.sender_name}</strong>
                <span style="color:#8a9084; font-size:.78rem;"> — ${(m.created_at || '').slice(0,16).replace('T',' ')}</span>
                <div>${m.message}</div>
            </div>
        `).join('');
    }).catch(() => {});
}
loadChatGroups();
