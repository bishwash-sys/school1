// Dashboard overview page — stats + admissions status toggle

function loadDashboard() {
    apiRequest('/api/dashboard-stats').then(data => {
        document.getElementById('d-students').textContent = data.students;
        document.getElementById('d-teachers').textContent = data.teachers;
        document.getElementById('d-classes').textContent = data.classes;
        document.getElementById('d-fees').textContent = 'NPR ' + data.pendingFees;
    }).catch(() => {});
}
loadDashboard();

fetch('/api/settings/admission-status')
    .then(r => r.json())
    .then(data => { document.getElementById('admission-status-select').value = data.status; })
    .catch(() => {});

document.getElementById('save-admission-status').addEventListener('click', () => {
    const status = document.getElementById('admission-status-select').value;
    apiRequest('/api/settings/admission-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    }).then(() => showToast('Admissions status updated.'))
      .catch(err => showToast(err.message, true));
});
