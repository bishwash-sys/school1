wireResource({
    resource: 'results',
    tbodyId: 'tbl-results',
    formId: 'form-results',
    colspan: 4,
    successMsg: 'Result added.',
    fields: [
        { inputId: 'r-name', key: 'student_name' },
        { inputId: 'r-subject', key: 'subject' },
        { inputId: 'r-marks', key: 'marks', numeric: true }
    ],
    render: row => `<tr>
        <td>${row.student_name}</td><td>${row.subject}</td><td>${row.marks}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
