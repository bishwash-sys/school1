wireResource({
    resource: 'fees',
    tbodyId: 'tbl-fees',
    formId: 'form-fees',
    colspan: 4,
    successMsg: 'Fee record added.',
    fields: [
        { inputId: 'f-name', key: 'student_name' },
        { inputId: 'f-amount', key: 'amount', numeric: true },
        { inputId: 'f-due', key: 'due_date' },
        { inputId: 'f-status', key: 'status' }
    ],
    render: row => `<tr>
        <td>${row.student_name}</td><td>NPR ${row.amount}</td><td>${row.status}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
