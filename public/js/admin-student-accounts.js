wireResource({
    resource: 'student-accounts',
    tbodyId: 'tbl-student-accounts',
    formId: 'form-student-accounts',
    colspan: 5,
    successMsg: 'Student login created.',
    fields: [
        { inputId: 'sa-name', key: 'student_name' },
        { inputId: 'sa-class', key: 'class' },
        { inputId: 'sa-username', key: 'username' },
        { inputId: 'sa-password', key: 'password' },
        { inputId: 'sa-email', key: 'email' }
    ],
    render: row => `<tr>
        <td>${row.student_name}</td><td>${row.class || ''}</td><td>${row.username}</td><td>${row.uid || ''}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
