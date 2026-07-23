document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorBox = document.getElementById('errorMsg');
    errorBox.classList.remove('show');

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Login failed');
        return data;
    })
    .then((data) => {
        // Store the session token issued by the server (not the password!)
        sessionStorage.setItem('adminToken', data.token);
        sessionStorage.setItem('adminUsername', data.username);
        sessionStorage.setItem('adminRole', data.role || 'staff');
        window.location.href = 'admin-dashboard.html';
    })
    .catch((err) => {
        errorBox.textContent = err.message || 'Invalid username or password.';
        errorBox.classList.add('show');
    });
});
