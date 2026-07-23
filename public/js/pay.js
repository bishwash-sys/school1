// Payment page logic — Shree Navajagriti Chandi School

let selectedPurpose = 'fee';
let selectedMethod = 'esewa';

// If arriving from the student dashboard, pre-fill their name and lock the purpose to "fee"
const urlParams = new URLSearchParams(window.location.search);
const prefillStudent = urlParams.get('student');
if (prefillStudent) {
    document.getElementById('p-student').value = prefillStudent;
}

document.querySelectorAll('.purpose-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.purpose-toggle button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedPurpose = btn.dataset.purpose;
        document.getElementById('student-field').style.display = selectedPurpose === 'fee' ? 'block' : 'none';
    });
});

document.querySelectorAll('.method-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMethod = card.dataset.method;
    });
});

function showError(msg) {
    const box = document.getElementById('errorMsg');
    box.textContent = msg;
    box.classList.add('show');
}

document.getElementById('payForm').addEventListener('submit', function (e) {
    e.preventDefault();
    document.getElementById('errorMsg').classList.remove('show');

    const payload = {
        purpose: selectedPurpose,
        student_name: document.getElementById('p-student').value,
        payer_name: document.getElementById('p-name').value,
        payer_email: document.getElementById('p-email').value,
        amount: document.getElementById('p-amount').value
    };

    fetch(`/api/payments/${selectedMethod}/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Could not start payment.');
        return data;
    })
    .then((data) => {
        if (selectedMethod === 'esewa') {
            // eSewa requires an actual POST form submission, not a redirect link
            const form = document.getElementById('esewaForm');
            form.action = data.gatewayUrl;
            form.innerHTML = '';
            Object.entries(data.fields).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            });
            form.submit();
        } else {
            // Khalti and Stripe just return a URL to redirect to
            window.location.href = data.paymentUrl;
        }
    })
    .catch(err => showError(err.message));
});
