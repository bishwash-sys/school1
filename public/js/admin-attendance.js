wireResource({
    resource: 'attendance',
    tbodyId: 'tbl-attendance',
    formId: 'form-attendance',
    colspan: 4,
    successMsg: 'Attendance recorded.',
    fields: [
        { inputId: 'a-class', key: 'class' },
        { inputId: 'a-date', key: 'date' },
        { inputId: 'a-status', key: 'status' }
    ],
    render: row => `<tr>
        <td>${row.class}</td><td>${row.date}</td><td>${row.status}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
