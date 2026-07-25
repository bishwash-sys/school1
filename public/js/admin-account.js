document.getElementById('acct-username').textContent = sessionStorage.getItem('adminUsername') || '';

document.getElementById('form-change-password').addEventListener('submit', function (e) {
    e.preventDefault();
    const currentPassword = document.getElementById('cp-current').value;
    const newPassword = document.getElementById('cp-new').value;
    const confirmPassword = document.getElementById('cp-confirm').value;

    if (newPassword !== confirmPassword) {
        showToast("New passwords don't match.", true);
        return;
    }

    apiRequest('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
    }).then(() => {
        showToast('Password updated. Please log in again.');
        this.reset();
        setTimeout(() => {
            sessionStorage.clear();
            window.location.href = 'admin-login.html';
        }, 1500);
    }).catch(err => showToast(err.message, true));
});
