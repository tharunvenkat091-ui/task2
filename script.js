const $ = (selector) => document.querySelector(selector);
const form = $("#task-form");
const input = $("#task-input");
const priorityInput = $("#priority");
const dateInput = $("#due-date");
const list = $("#task-list");
const empty = $("#empty");
const search = $("#search");
const sort = $("#sort");
const STORAGE_KEY = "dayflow-tasks-v1";

let tasks = loadTasks();
let activeFilter = "all";
let toastTimer;

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch { showToast("Browser storage is unavailable."); }
}
function today() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function prettyDate(value) {
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}
function setupGreeting() {
  const now = new Date();
  $("#date-label").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  $("#greeting").innerHTML = `${greeting}, let's make today count<span>.</span>`;
}
function getVisibleTasks() {
  const query = search.value.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    const matchesText = task.text.toLowerCase().includes(query);
    const matchesView = activeFilter === "all" ||
      (activeFilter === "today" && task.dueDate === today() && !task.completed) ||
      (activeFilter === "completed" && task.completed);
    return matchesText && matchesView;
  });
  const priorityOrder = { high: 0, normal: 1, low: 2 };
  filtered.sort((a, b) => {
    if (sort.value === "priority") return priorityOrder[a.priority] - priorityOrder[b.priority] || b.createdAt - a.createdAt;
    if (sort.value === "date") return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    return b.createdAt - a.createdAt;
  });
  return filtered;
}
function makeTask(task) {
  const row = document.createElement("article");
  row.className = `task${task.completed ? " done" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "check";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Complete ${task.text}`);
  checkbox.addEventListener("change", () => toggleTask(task.id));

  const body = document.createElement("div");
  body.className = "task-body";
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.text;
  const meta = document.createElement("div");
  meta.className = "meta";
  const priority = document.createElement("span");
  priority.className = `badge ${task.priority}`;
  priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`;
  meta.appendChild(priority);

  if (task.dueDate) {
    const due = document.createElement("span");
    const isOverdue = task.dueDate < today() && !task.completed;
    due.className = `badge ${isOverdue ? "overdue" : "due"}`;
    due.textContent = `${isOverdue ? "Overdue · " : "Due · "}${prettyDate(task.dueDate)}`;
    meta.appendChild(due);
  }
  body.append(title, meta);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete";
  remove.textContent = "×";
  remove.title = "Delete task";
  remove.setAttribute("aria-label", `Delete ${task.text}`);
  remove.addEventListener("click", () => deleteTask(task.id));
  row.append(checkbox, body, remove);
  return row;
}
function render() {
  list.replaceChildren();
  const visible = getVisibleTasks();
  visible.forEach((task) => list.appendChild(makeTask(task)));
  empty.hidden = visible.length !== 0;

  const emptyTitle = empty.querySelector("h3");
  const emptyCopy = empty.querySelector("p");
  if (search.value.trim()) {
    emptyTitle.textContent = "No matching tasks";
    emptyCopy.textContent = "Try a different search phrase.";
  } else if (activeFilter === "today") {
    emptyTitle.textContent = "Your day is clear";
    emptyCopy.textContent = "No unfinished tasks are due today.";
  } else if (activeFilter === "completed") {
    emptyTitle.textContent = "No completed tasks yet";
    emptyCopy.textContent = "Finished tasks will appear here.";
  } else {
    emptyTitle.textContent = "Nothing on your list yet";
    emptyCopy.textContent = "Add your first task above and build some momentum.";
  }

  const completed = tasks.filter((task) => task.completed).length;
  const remaining = tasks.length - completed;
  $("#all-count").textContent = tasks.length;
  $("#today-count").textContent = tasks.filter((task) => task.dueDate === today() && !task.completed).length;
  $("#completed-count").textContent = completed;
  $("#visible-count").textContent = visible.length;
  $("#list-title").firstChild.textContent = activeFilter === "today" ? "Today " : activeFilter === "completed" ? "Completed " : "All tasks ";
  $("#summary").textContent = `${remaining} task${remaining === 1 ? "" : "s"} left · ${completed} completed`;
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  $("#percent").textContent = `${percent}%`;
  $("#ring").style.setProperty("--progress", `${percent}%`);
  $("#progress-copy").textContent = tasks.length === 0 ? "A fresh start awaits." : completed === tasks.length ? "Everything is complete!" : `${completed} of ${tasks.length} tasks finished.`;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  tasks.push({
    id: window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    text, priority: priorityInput.value, dueDate: dateInput.value,
    completed: false, createdAt: Date.now()
  });
  saveTasks();
  form.reset();
  input.focus();
  render();
  showToast("Task added to your list.");
});
function toggleTask(id) {
  tasks = tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
  saveTasks(); render();
}
function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks(); render(); showToast("Task deleted.");
}
document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});
search.addEventListener("input", render);
sort.addEventListener("change", render);
$("#clear-completed").addEventListener("click", () => {
  const before = tasks.length;
  tasks = tasks.filter((task) => !task.completed);
  saveTasks(); render();
  showToast(before === tasks.length ? "No completed tasks to clear." : "Completed tasks cleared.");
});
setupGreeting();
render();
