const todolist = [
    "make dinner",
    "wash dishes",
    "go shopping"
];

renderTodoList();

function renderTodoList () {
    let todoListHTML = '';
    for(let i = 0; i <todolist.length; i++){
        const todo = todolist[i];
        const html = `<p>${todo}</p>`;
        todoListHTML += html;
    }
    console.log(todoListHTML);

    document.querySelector('.js-todo-list')
        .innerHTML = todoListHTML;
}



function addTodo() {
    const todo = document.querySelector('.js-todo-input');
    const name = todo.value;
    
    todolist.push(name);
    console.log(todolist);

    todo.value = '';

    renderTodoList();

}