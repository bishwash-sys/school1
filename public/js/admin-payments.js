function loadPayments() {
    apiRequest('/api/payments').then(rows => {
        const tbody = document.getElementById('tbl-payments');
        if (!rows.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No payments yet.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => `<tr>
            <td>${(r.created_at || '').slice(0, 16).replace('T', ' ')}</td>
            <td>${r.purpose === 'donation' ? 'Donation' : 'School Fee'}</td>
            <td>${r.payer_name || ''}${r.payer_email ? ' (' + r.payer_email + ')' : ''}</td>
            <td>${r.student_name || '—'}</td>
            <td>NPR ${r.amount}</td>
            <td>${r.method}</td>
            <td>${r.status}</td>
        </tr>`).join('');
    }).catch(() => {});
}
loadPayments();
