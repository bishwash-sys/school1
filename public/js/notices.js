// Public Notice Board — fetches all notices and filters by category client-side

let allNotices = [];
let activeCategory = 'All';

fetch('/api/notices/public')
    .then(r => r.json())
    .then(notices => {
        allNotices = notices;
        render();
    })
    .catch(() => {
        document.getElementById('all-notices').innerHTML = '<div class="notice-empty">Could not load notices right now.</div>';
    });

function render() {
    const filtered = activeCategory === 'All' ? allNotices : allNotices.filter(n => n.category === activeCategory);
    renderNoticeList(document.getElementById('all-notices'), filtered, 'No notices in this category yet.');
}

document.querySelectorAll('.notice-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.notice-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.category;
        render();
    });
});
