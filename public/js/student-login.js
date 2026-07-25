document.getElementById('studentLoginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorBox = document.getElementById('errorMsg');
    errorBox.classList.remove('show');

    fetch('/api/student-login', {
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
        sessionStorage.setItem('studentToken', data.token);
        sessionStorage.setItem('studentUsername', data.username);
        sessionStorage.setItem('studentName', data.studentName);
        sessionStorage.setItem('studentClass', data.class || '');
        window.location.href = 'student-dashboard.html';
    })
    .catch((err) => {
        errorBox.textContent = err.message || 'Invalid username or password.';
        errorBox.classList.add('show');
    });
});
