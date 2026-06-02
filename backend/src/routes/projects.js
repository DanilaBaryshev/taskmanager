const express = require('express');
const { pool, query } = require('../db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// GET /api/projects — список проектов где пользователь участник или владелец
router.get('/', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT p.id, p.name, p.description, p.owner_id, p.created_at
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       WHERE p.owner_id = $1 OR pm.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения проектов:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/projects — создать новый проект
router.post('/', auth, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Название проекта обязательно' });
  }

  // используем транзакцию чтобы проект и запись участника создались вместе
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // вставляем проект и получаем его данные
    const projectResult = await client.query(
      'INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, req.user.id]
    );
    const project = projectResult.rows[0];

    // автоматически добавляем создателя как owner в таблицу участников
    await client.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, req.user.id, 'owner']
    );

    await client.query('COMMIT');
    return res.status(201).json(project);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ошибка создания проекта:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    client.release();
  }
});

// GET /api/projects/:projectId — детали проекта и список участников
router.get('/:projectId', auth, requireRole('owner', 'editor', 'viewer'), async (req, res) => {
  try {
    const projectResult = await query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const project = projectResult.rows[0];

    // получаем участников с их email и ролью
    const membersResult = await query(
      `SELECT u.id, u.email, pm.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1`,
      [req.params.projectId]
    );

    project.members = membersResult.rows;
    return res.json(project);
  } catch (err) {
    console.error('Ошибка получения проекта:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/projects/:projectId — удалить проект, только владелец
router.delete('/:projectId', auth, requireRole('owner'), async (req, res) => {
  try {
    await query('DELETE FROM projects WHERE id = $1', [req.params.projectId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления проекта:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/projects/:projectId/members — добавить участника, только владелец
router.post('/:projectId/members', auth, requireRole('owner'), async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: 'Email и роль обязательны' });
  }

  // владельцем через этот маршрут стать нельзя
  if (!['editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Роль должна быть editor или viewer' });
  }

  try {
    // ищем пользователя по email
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userId = userResult.rows[0].id;

    // добавляем участника или обновляем роль если он уже добавлен
    await query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
      [req.params.projectId, userId, role]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Ошибка добавления участника:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/projects/:projectId/members/:userId — удалить участника, только владелец
router.delete('/:projectId/members/:userId', auth, requireRole('owner'), async (req, res) => {
  // нельзя удалить самого себя из проекта через этот маршрут
  if (parseInt(req.params.userId) === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить себя из проекта' });
  }

  try {
    await query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.projectId, req.params.userId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления участника:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
