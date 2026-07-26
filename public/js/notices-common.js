// Shared notice board rendering helper — used anywhere notices are displayed publicly.

function formatNoticeDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return isoString;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderNoticeCard(n) {
    const catClass = 'cat-' + (n.category || 'General').toLowerCase();
    const pinnedClass = n.pinned ? ' pinned' : '';
    return `
        <div class="notice-card ${catClass}${pinnedClass}">
            <div class="notice-top">
                <h3>${escapeNoticeHtml(n.title)}</h3>
                <span class="notice-badge ${n.category || 'General'}">${n.category || 'General'}</span>
            </div>
            <div class="notice-body">${escapeNoticeHtml(n.content)}</div>
            <div class="notice-date">${formatNoticeDate(n.created_at)}</div>
        </div>
    `;
}

function escapeNoticeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function renderNoticeList(containerEl, notices, emptyMessage) {
    if (!notices.length) {
        containerEl.innerHTML = `<div class="notice-empty">${emptyMessage || 'No notices posted yet.'}</div>`;
        return;
    }
    containerEl.innerHTML = notices.map(renderNoticeCard).join('');
}
