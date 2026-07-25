wireResource({
    resource: 'homework',
    tbodyId: 'tbl-homework',
    formId: 'form-homework',
    colspan: 5,
    successMsg: 'Homework posted.',
    fields: [
        { inputId: 'hw-class', key: 'class' },
        { inputId: 'hw-subject', key: 'subject' },
        { inputId: 'hw-title', key: 'title' },
        { inputId: 'hw-description', key: 'description' },
        { inputId: 'hw-due', key: 'due_date' }
    ],
    render: row => `<tr>
        <td>${row.class}</td><td>${row.subject || ''}</td><td>${row.title}</td><td>${row.due_date || ''}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
