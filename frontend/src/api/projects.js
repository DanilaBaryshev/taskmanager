import client from './client'

// получить список проектов текущего пользователя
export function getProjects() {
  return client.get('/api/projects').then((res) => res.data)
}

// создать новый проект
export function createProject(name, description) {
  return client.post('/api/projects', { name, description }).then((res) => res.data)
}

// получить детали проекта и список участников
export function getProject(id) {
  return client.get(`/api/projects/${id}`).then((res) => res.data)
}

// удалить проект (только owner)
export function deleteProject(id) {
  return client.delete(`/api/projects/${id}`).then((res) => res.data)
}

// добавить участника по email с указанной ролью
export function addMember(projectId, email, role) {
  return client
    .post(`/api/projects/${projectId}/members`, { email, role })
    .then((res) => res.data)
}

// удалить участника из проекта по его userId
export function removeMember(projectId, userId) {
  return client
    .delete(`/api/projects/${projectId}/members/${userId}`)
    .then((res) => res.data)
}
