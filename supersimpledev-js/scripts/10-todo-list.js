const todolist = [{
    name: 'make dinner',
    dueDate: '2022-12-22'
}, {
    name: 'wash dishes',
    dueDate: '2022-12-22'
}
];

renderTodoList();

function renderTodoList () {
    let todoListHTML = '';
    
    for(let i = 0; i <todolist.length; i++){
        const todoObject = todolist[i];
        // const name = todoObject.name;
        // const dueDate = todoObject.dueDate;
        const {name, dueDate} = todoObject;
        const html = `
        <div>${name}</div>
        <div>${dueDate}</div>
        <button onclick ="
            todolist.splice(${i}, 1);
            renderTodoList();
        " class="delete-todo-button">Delete</button>
        `;
        todoListHTML += html;
    }
    

    document.querySelector('.js-todo-list')
        .innerHTML = todoListHTML;
}



function addTodo() {
    const todo = document.querySelector('.js-todo-input');
    const name = todo.value;

    const dateInputElement = document.querySelector('.js-due-date-input');
    const dueDate = dateInputElement.value;

    todolist.push({
        name,
        dueDate
    });

    todo.value = '';

    renderTodoList();
}