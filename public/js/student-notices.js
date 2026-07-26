// Student notice board — same public notices feed, shown inside the student portal

fetch('/api/notices/public')
    .then(r => r.json())
    .then(notices => renderNoticeList(document.getElementById('student-notices-list'), notices, 'No notices posted yet.'))
    .catch(() => {});
