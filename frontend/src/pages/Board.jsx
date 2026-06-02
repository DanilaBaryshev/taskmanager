import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, deleteProject } from '../api/projects'
import { getTasks, createTask } from '../api/tasks'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'
import TaskCard from '../components/TaskCard'

// метки колонок для отображения
const COLUMN_LABELS = {
  todo: 'В планах',
  in_progress: 'В процессе',
  done: 'Готово',
}

function Board() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState({ todo: [], in_progress: [], done: [] })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [error, setError] = useState('')

  // подключаемся к сокету и получаем ref на экземпляр
  const socketRef = useSocket(projectId)

  // загружаем данные проекта и задачи при монтировании
  useEffect(() => {
    loadData()
  }, [projectId])

  // подписываемся на события сокета
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    // новая задача создана - проверяем дубликат, чтобы не добавить дважды
    function onTaskCreated(task) {
      setTasks((prev) => {
        const alreadyExists = Object.values(prev).some((col) =>
          col.some((t) => t.id === task.id)
        )
        if (alreadyExists) return prev
        return {
          ...prev,
          [task.column]: [...prev[task.column], task],
        }
      })
    }

    // задача обновлена
    function onTaskUpdated(task) {
      setTasks((prev) => {
        const updated = { ...prev }
        for (const col of Object.keys(updated)) {
          updated[col] = updated[col].map((t) => (t.id === task.id ? task : t))
        }
        return updated
      })
    }

    // задача перемещена в другую колонку
    function onTaskMoved({ taskId, column }) {
      setTasks((prev) => {
        let movedTask = null
        const cleaned = { todo: [], in_progress: [], done: [] }
        for (const col of Object.keys(prev)) {
          for (const t of prev[col]) {
            if (t.id === parseInt(taskId)) {
              movedTask = { ...t, column }
            } else {
              cleaned[col].push(t)
            }
          }
        }
        if (movedTask) {
          cleaned[column].push(movedTask)
        }
        return cleaned
      })
    }

    // задача удалена
    function onTaskDeleted({ taskId }) {
      setTasks((prev) => {
        const updated = { ...prev }
        for (const col of Object.keys(updated)) {
          updated[col] = updated[col].filter((t) => t.id !== parseInt(taskId))
        }
        return updated
      })
    }

    socket.on('task:created', onTaskCreated)
    socket.on('task:updated', onTaskUpdated)
    socket.on('task:moved', onTaskMoved)
    socket.on('task:deleted', onTaskDeleted)

    return () => {
      socket.off('task:created', onTaskCreated)
      socket.off('task:updated', onTaskUpdated)
      socket.off('task:moved', onTaskMoved)
      socket.off('task:deleted', onTaskDeleted)
    }
  }, [socketRef.current])

  async function loadData() {
    try {
      const [projectData, tasksData] = await Promise.all([
        getProject(projectId),
        getTasks(projectId),
      ])
      setProject(projectData)
      setTasks(tasksData)
    } catch (err) {
      setError('Не удалось загрузить данные проекта')
    }
  }

  async function handleAddTask(e) {
    e.preventDefault()
    setError('')
    try {
      const task = await createTask(projectId, newTitle, newDescription)
      setTasks((prev) => {
        // задача могла уже попасть в стейт через сокет раньше http-ответа
        const alreadyExists = Object.values(prev).some((col) =>
          col.some((t) => t.id === task.id)
        )
        if (alreadyExists) return prev
        return { ...prev, todo: [...prev.todo, task] }
      })
      setNewTitle('')
      setNewDescription('')
      setShowAddForm(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания задачи')
    }
  }

  // обновить задачу в локальном состоянии (после edit или undo)
  function handleTaskUpdate(updatedTask) {
    setTasks((prev) => {
      const cleaned = { todo: [], in_progress: [], done: [] }
      for (const col of Object.keys(prev)) {
        for (const t of prev[col]) {
          if (t.id === updatedTask.id) {
            // кладём в правильную колонку по полю column из обновлённой задачи
            cleaned[updatedTask.column].push(updatedTask)
          } else {
            cleaned[col].push(t)
          }
        }
      }
      return cleaned
    })
  }

  // удалить задачу из локального состояния
  function handleTaskDelete(taskId) {
    setTasks((prev) => {
      const updated = { ...prev }
      for (const col of Object.keys(updated)) {
        updated[col] = updated[col].filter((t) => t.id !== taskId)
      }
      return updated
    })
  }

  // удалить проект целиком — только owner
  async function handleDeleteProject() {
    if (!window.confirm('Удалить проект? Это действие нельзя отменить.')) return
    try {
      await deleteProject(projectId)
      navigate('/projects')
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления проекта')
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/projects')}>&larr; Назад</button>
        <h1 style={{ margin: 0 }}>{project ? project.name : 'Загрузка...'}</h1>
        {project && user && project.owner_id === user.id && (
          <button onClick={handleDeleteProject} style={{ marginLeft: 'auto', color: 'red' }}>
            Удалить проект
          </button>
        )}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* три колонки канбан-доски */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {['todo', 'in_progress', 'done'].map((col) => (
          <div
            key={col}
            style={{
              flex: 1,
              background: '#f4f5f7',
              borderRadius: 4,
              padding: 12,
              minWidth: 240,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>{COLUMN_LABELS[col]}</h2>

            {/* кнопка и форма добавления задачи только в колонке todo */}
            {col === 'todo' && (
              <div style={{ marginBottom: 8 }}>
                {showAddForm ? (
                  <form onSubmit={handleAddTask}>
                    <input
                      type="text"
                      placeholder="Название задачи"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      style={{ width: '100%', marginBottom: 4 }}
                    />
                    <input
                      type="text"
                      placeholder="Описание (необязательно)"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      style={{ width: '100%', marginBottom: 4 }}
                    />
                    <button type="submit" style={{ marginRight: 4 }}>
                      Добавить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewTitle('')
                        setNewDescription('')
                        setError('')
                      }}
                    >
                      Отмена
                    </button>
                  </form>
                ) : (
                  <button onClick={() => setShowAddForm(true)} style={{ width: '100%' }}>
                    + Добавить задачу
                  </button>
                )}
              </div>
            )}

            {/* карточки задач данной колонки */}
            {tasks[col].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                projectId={projectId}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Board
