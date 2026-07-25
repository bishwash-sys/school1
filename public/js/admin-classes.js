wireResource({
    resource: 'classes',
    tbodyId: 'tbl-classes',
    formId: 'form-classes',
    colspan: 4,
    successMsg: 'Class added.',
    fields: [
        { inputId: 'cl-name', key: 'name' },
        { inputId: 'cl-teacher', key: 'teacher' },
        { inputId: 'cl-count', key: 'students_count', numeric: true }
    ],
    render: row => `<tr>
        <td>${row.name}</td><td>${row.teacher || ''}</td><td>${row.students_count || 0}</td>
        <td><button class="btn-delete" data-id="${row.id}">Delete</button></td>
    </tr>`
});
