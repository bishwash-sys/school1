wireResource({
    resource: 'admins',
    tbodyId: 'tbl-admins',
    formId: 'form-admins',
    colspan: 4,
    successMsg: 'Login created.',
    fields: [
        { inputId: 'au-fullname', key: 'full_name' },
        { inputId: 'au-username', key: 'username' },
        { inputId: 'au-password', key: 'password' },
        { inputId: 'au-role', key: 'role' }
    ],
    render: row => `<tr>
        <td>${row.full_name || ''}</td><td>${row.username}</td><td>${row.role}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
