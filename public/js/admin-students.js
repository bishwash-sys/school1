wireResource({
    resource: 'students',
    tbodyId: 'tbl-students',
    formId: 'form-students',
    colspan: 5,
    successMsg: 'Student added.',
    fields: [
        { inputId: 's-roll', key: 'roll_no' },
        { inputId: 's-name', key: 'name' },
        { inputId: 's-class', key: 'class' },
        { inputId: 's-email', key: 'email' }
    ],
    render: row => `<tr>
        <td>${row.roll_no || ''}</td><td>${row.name}</td><td>${row.class || ''}</td><td>${row.email || ''}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
