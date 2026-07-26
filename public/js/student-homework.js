studentApiRequest('/api/student/homework')
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
