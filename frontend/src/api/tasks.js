import client from './client'

// получить все задачи проекта, сгруппированные по колонкам
export function getTasks(projectId) {
  return client.get(`/api/projects/${projectId}/tasks`).then((res) => res.data)
}

// создать новую задачу в колонке todo
export function createTask(projectId, title, description) {
  return client
    .post(`/api/projects/${projectId}/tasks`, { title, description })
    .then((res) => res.data)
}

// обновить title и description задачи
export function updateTask(projectId, taskId, title, description) {
  return client
    .put(`/api/projects/${projectId}/tasks/${taskId}`, { title, description })
    .then((res) => res.data)
}

// переместить задачу в другую колонку
export function moveTask(projectId, taskId, column) {
  return client
    .put(`/api/projects/${projectId}/tasks/${taskId}/move`, { column })
    .then((res) => res.data)
}

// удалить задачу
export function deleteTask(projectId, taskId) {
  return client
    .delete(`/api/projects/${projectId}/tasks/${taskId}`)
    .then((res) => res.data)
}

// отменить последнее изменение задачи
export function undoTask(projectId, taskId) {
  return client
    .post(`/api/projects/${projectId}/tasks/${taskId}/undo`)
    .then((res) => res.data)
}
