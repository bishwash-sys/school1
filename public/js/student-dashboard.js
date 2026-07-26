// Dashboard overview — just shows quick summary counts and links to the real pages

document.getElementById('summary-pay-link').href =
    `pay.html?student=${encodeURIComponent(sessionStorage.getItem('studentName') || '')}`;

studentApiRequest('/api/student/homework')
    .then(rows => { document.getElementById('summary-homework-count').textContent = rows.length; })
    .catch(() => {});

studentApiRequest('/api/student/chat-groups')
    .then(rows => { document.getElementById('summary-groups-count').textContent = rows.length; })
    .catch(() => {});

fetch('/api/notices/public')
    .then(r => r.json())
    .then(rows => { document.getElementById('summary-notices-count').textContent = rows.length; })
    .catch(() => {});
