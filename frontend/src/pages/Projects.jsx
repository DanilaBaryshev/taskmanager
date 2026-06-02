import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject } from '../api/projects'
import { useAuth } from '../context/AuthContext'

function Projects() {
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const { logout } = useAuth()
  const navigate = useNavigate()

  // загружаем список проектов при монтировании
  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (err) {
      setError('Не удалось загрузить проекты')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      const project = await createProject(name, description)
      setProjects((prev) => [project, ...prev])
      setName('')
      setDescription('')
      setShowForm(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания проекта')
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Мои проекты</h1>
        <div>
          <button onClick={() => setShowForm((v) => !v)} style={{ marginRight: 8 }}>
            {showForm ? 'Отмена' : '+ Новый проект'}
          </button>
          <button onClick={logout}>Выйти</button>
        </div>
      </div>

      {/* встроенная форма создания проекта */}
      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24, padding: 16, border: '1px solid #ccc' }}>
          <h3 style={{ marginTop: 0 }}>Новый проект</h3>
          <div>
            <label>Название</label>
            <br />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', marginBottom: 8 }}
            />
          </div>
          <div>
            <label>Описание</label>
            <br />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
            />
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit">Создать</button>
        </form>
      )}

      {error && !showForm && <p style={{ color: 'red' }}>{error}</p>}

      {/* список карточек проектов */}
      {projects.length === 0 ? (
        <p>Нет проектов. Создайте первый!</p>
      ) : (
        <div>
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              style={{
                padding: 16,
                marginBottom: 12,
                border: '1px solid #ddd',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <h3 style={{ margin: '0 0 4px' }}>{project.name}</h3>
              {project.description && (
                <p style={{ margin: 0, color: '#666' }}>{project.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Projects
