// Admin Notice Board — post new notices, view + delete existing ones

function renderAdminNoticeCard(n) {
    const catClass = 'cat-' + (n.category || 'General').toLowerCase();
    const pinnedClass = n.pinned ? ' pinned' : '';
    return `
        <div class="notice-card ${catClass}${pinnedClass}" style="padding-bottom:3rem;">
            <div class="notice-top">
                <h3>${escapeNoticeHtml(n.title)}</h3>
                <span class="notice-badge ${n.category || 'General'}">${n.category || 'General'}</span>
            </div>
            <div class="notice-body">${escapeNoticeHtml(n.content)}</div>
            <div class="notice-date">${formatNoticeDate(n.created_at)} ${n.posted_by ? '· by ' + n.posted_by : ''}</div>
            <button class="btn-delete" data-id="${n.id}">Delete</button>
        </div>
    `;
}

function loadNotices() {
    apiRequest('/api/notices').then(rows => {
        const box = document.getElementById('admin-notices-list');
        if (!rows.length) {
            box.innerHTML = '<div class="notice-empty">No notices posted yet.</div>';
            return;
        }
        box.innerHTML = rows.map(renderAdminNoticeCard).join('');
        box.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Delete this notice?')) return;
                apiRequest('/api/notices/' + btn.dataset.id, { method: 'DELETE' })
                    .then(() => { showToast('Notice deleted.'); loadNotices(); })
                    .catch(err => showToast(err.message, true));
            });
        });
    }).catch(() => {});
}
loadNotices();

document.getElementById('form-notices').addEventListener('submit', function (e) {
    e.preventDefault();
    const body = {
        title: document.getElementById('n-title').value,
        content: document.getElementById('n-content').value,
        category: document.getElementById('n-category').value,
        pinned: document.getElementById('n-pinned').checked
    };
    apiRequest('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(() => {
        showToast('Notice posted.');
        this.reset();
        loadNotices();
    }).catch(err => showToast(err.message, true));
});
