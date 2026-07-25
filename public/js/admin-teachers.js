wireResource({
    resource: 'teachers',
    tbodyId: 'tbl-teachers',
    formId: 'form-teachers',
    colspan: 4,
    successMsg: 'Teacher added.',
    fields: [
        { inputId: 't-name', key: 'name' },
        { inputId: 't-subject', key: 'subject' },
        { inputId: 't-email', key: 'email' }
    ],
    render: row => `<tr>
        <td>${row.name}</td><td>${row.subject || ''}</td><td>${row.email || ''}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
