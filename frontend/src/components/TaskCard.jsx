import { useState } from 'react'
import { updateTask, moveTask, deleteTask, undoTask } from '../api/tasks'

// порядок колонок для кнопок влево/вправо
const COLUMNS = ['todo', 'in_progress', 'done']

function TaskCard({ task, projectId, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [error, setError] = useState('')

  const currentIndex = COLUMNS.indexOf(task.column)
  const canMoveLeft = currentIndex > 0
  const canMoveRight = currentIndex < COLUMNS.length - 1

  async function handleMoveLeft() {
    try {
      const updated = await moveTask(projectId, task.id, COLUMNS[currentIndex - 1])
      onUpdate(updated)
    } catch (err) {
      setError('Ошибка перемещения')
    }
  }

  async function handleMoveRight() {
    try {
      const updated = await moveTask(projectId, task.id, COLUMNS[currentIndex + 1])
      onUpdate(updated)
    } catch (err) {
      setError('Ошибка перемещения')
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    try {
      const updated = await updateTask(projectId, task.id, title, description)
      onUpdate(updated)
      setEditing(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения')
    }
  }

  async function handleDelete() {
    try {
      await deleteTask(projectId, task.id)
      onDelete(task.id)
    } catch (err) {
      setError('Ошибка удаления')
    }
  }

  // отменить последнее действие над задачей
  async function handleUndo() {
    try {
      const updated = await undoTask(projectId, task.id)
      onUpdate(updated)
    } catch (err) {
      setError('Нечего отменять')
    }
  }

  return (
    <div
      style={{
        padding: 12,
        marginBottom: 8,
        border: '1px solid #ddd',
        borderRadius: 4,
        background: '#fff',
      }}
    >
      {editing ? (
        // встроенная форма редактирования
        <form onSubmit={handleSave}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 4 }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ width: '100%', marginBottom: 4 }}
          />
          {error && <p style={{ color: 'red', margin: '4px 0' }}>{error}</p>}
          <button type="submit" style={{ marginRight: 4 }}>
            Сохранить
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setTitle(task.title)
              setDescription(task.description || '')
              setError('')
            }}
          >
            Отмена
          </button>
        </form>
      ) : (
        // обычный вид карточки
        <>
          <strong>{task.title}</strong>
          {task.description && (
            <p style={{ margin: '4px 0', color: '#555', fontSize: 14 }}>{task.description}</p>
          )}
          {error && <p style={{ color: 'red', margin: '4px 0', fontSize: 12 }}>{error}</p>}
          <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={handleMoveLeft} disabled={!canMoveLeft}>
              &larr;
            </button>
            <button onClick={handleMoveRight} disabled={!canMoveRight}>
              &rarr;
            </button>
            <button onClick={() => setEditing(true)}>Изменить</button>
            <button onClick={handleDelete}>Удалить</button>
            <button onClick={handleUndo}>Отменить</button>
          </div>
        </>
      )}
    </div>
  )
}

export default TaskCard
