// Public homepage behaviour — Shree Navajagriti Chandi School

fetch('/api/settings/admission-status')
    .then(r => r.json())
    .then(data => { document.getElementById('stat-admissions').textContent = data.status; })
    .catch(() => {});

// Load live stats from the database via the API
fetch('/api/public-stats')
    .then(r => r.json())
    .then(data => {
        document.getElementById('stat-students').textContent = data.students;
        document.getElementById('stat-teachers').textContent = data.teachers;
        document.getElementById('stat-classes').textContent = data.classes;
    })
    .catch(() => {
        // If the server can't be reached, just leave the placeholders
    });

// Smooth scrolling for in-page nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Contact form -> saved to the database via the API
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('c-name').value,
            email: document.getElementById('c-email').value,
            subject: document.getElementById('c-subject').value,
            message: document.getElementById('c-message').value
        };
        fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(r => {
            if (!r.ok) throw new Error('Failed');
            return r.json();
        })
        .then(() => {
            alert('Thank you! Your message has been received.');
            contactForm.reset();
        })
        .catch(() => alert('Sorry, something went wrong. Please try again.'));
    });
}
