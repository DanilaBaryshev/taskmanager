const express = require('express');
const { query } = require('../db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { emitToProject } = require('../socket');

const router = express.Router();

// GET /api/projects/:projectId/tasks — все задачи проекта, сгруппированные по колонкам
router.get('/:projectId/tasks', auth, requireRole('owner', 'editor', 'viewer'), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM tasks WHERE project_id = $1 ORDER BY position ASC',
      [req.params.projectId]
    );

    // группируем задачи по колонкам
    const grouped = { todo: [], in_progress: [], done: [] };
    for (const task of result.rows) {
      grouped[task.column].push(task);
    }

    return res.json(grouped);
  } catch (err) {
    console.error('Ошибка получения задач:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/projects/:projectId/tasks — создать задачу в колонке todo
router.post('/:projectId/tasks', auth, requireRole('owner', 'editor'), async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Заголовок задачи обязателен' });
  }

  try {
    // вычисляем следующую позицию в колонке todo
    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
       FROM tasks WHERE project_id = $1 AND "column" = 'todo'`,
      [req.params.projectId]
    );
    const position = posResult.rows[0].next_pos;

    // вставляем задачу
    const result = await query(
      `INSERT INTO tasks (project_id, "column", title, description, position, created_by)
       VALUES ($1, 'todo', $2, $3, $4, $5) RETURNING *`,
      [req.params.projectId, title, description || null, position, req.user.id]
    );
    const task = result.rows[0];

    // логируем создание в историю, payload пустой так как предыдущего состояния нет
    await query(
      'INSERT INTO task_history (task_id, project_id, user_id, action, payload) VALUES ($1, $2, $3, $4, $5)',
      [task.id, req.params.projectId, req.user.id, 'create', null]
    );

    // уведомляем всех участников проекта о новой задаче
    emitToProject(req.params.projectId, 'task:created', task);

    return res.status(201).json(task);
  } catch (err) {
    console.error('Ошибка создания задачи:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/projects/:projectId/tasks/:taskId — редактировать title и description задачи
router.put('/:projectId/tasks/:taskId', auth, requireRole('owner', 'editor'), async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Заголовок задачи обязателен' });
  }

  try {
    // получаем текущее состояние задачи перед изменением
    const current = await query(
      'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
      [req.params.taskId, req.params.projectId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const previousState = current.rows[0];

    // обновляем задачу
    const result = await query(
      'UPDATE tasks SET title = $1, description = $2, updated_at = NOW() WHERE id = $3 AND project_id = $4 RETURNING *',
      [title, description || null, req.params.taskId, req.params.projectId]
    );

    // сохраняем предыдущее состояние в историю для возможности undo
    await query(
      'INSERT INTO task_history (task_id, project_id, user_id, action, payload) VALUES ($1, $2, $3, $4, $5)',
      [req.params.taskId, req.params.projectId, req.user.id, 'update', JSON.stringify(previousState)]
    );

    // уведомляем всех участников проекта об изменении задачи
    emitToProject(req.params.projectId, 'task:updated', result.rows[0]);

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка редактирования задачи:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/projects/:projectId/tasks/:taskId — удалить задачу
router.delete('/:projectId/tasks/:taskId', auth, requireRole('owner', 'editor'), async (req, res) => {
  try {
    // получаем текущее состояние задачи перед удалением
    const current = await query(
      'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
      [req.params.taskId, req.params.projectId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    // логируем удаление до самого удаления (запись cascade удалится вместе с задачей)
    await query(
      'INSERT INTO task_history (task_id, project_id, user_id, action, payload) VALUES ($1, $2, $3, $4, $5)',
      [req.params.taskId, req.params.projectId, req.user.id, 'delete', JSON.stringify(current.rows[0])]
    );

    // удаляем задачу, история cascade удалится автоматически
    await query(
      'DELETE FROM tasks WHERE id = $1 AND project_id = $2',
      [req.params.taskId, req.params.projectId]
    );

    // уведомляем всех участников проекта об удалении задачи
    emitToProject(req.params.projectId, 'task:deleted', { taskId: req.params.taskId });

    return res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления задачи:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/projects/:projectId/tasks/:taskId/move — переместить задачу в другую колонку
router.put('/:projectId/tasks/:taskId/move', auth, requireRole('owner', 'editor'), async (req, res) => {
  const { column } = req.body;

  if (!['todo', 'in_progress', 'done'].includes(column)) {
    return res.status(400).json({ error: 'Колонка должна быть todo, in_progress или done' });
  }

  try {
    // получаем текущее состояние задачи
    const current = await query(
      'SELECT * FROM tasks WHERE id = $1 AND project_id = $2',
      [req.params.taskId, req.params.projectId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const previousState = current.rows[0];

    // вычисляем позицию в конце целевой колонки
    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
       FROM tasks WHERE project_id = $1 AND "column" = $2`,
      [req.params.projectId, column]
    );
    const position = posResult.rows[0].next_pos;

    // обновляем колонку и позицию
    const result = await query(
      `UPDATE tasks SET "column" = $1, position = $2, updated_at = NOW()
       WHERE id = $3 AND project_id = $4 RETURNING *`,
      [column, position, req.params.taskId, req.params.projectId]
    );

    // сохраняем предыдущую колонку и позицию в историю
    await query(
      'INSERT INTO task_history (task_id, project_id, user_id, action, payload) VALUES ($1, $2, $3, $4, $5)',
      [
        req.params.taskId,
        req.params.projectId,
        req.user.id,
        'move',
        JSON.stringify({ column: previousState.column, position: previousState.position })
      ]
    );

    // уведомляем всех участников проекта о перемещении задачи
    emitToProject(req.params.projectId, 'task:moved', { taskId: req.params.taskId, column });

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка перемещения задачи:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/projects/:projectId/tasks/:taskId/undo — отменить последнее изменение задачи
router.post('/:projectId/tasks/:taskId/undo', auth, requireRole('owner', 'editor'), async (req, res) => {
  try {
    // получаем последнюю запись истории для этой задачи
    const historyResult = await query(
      `SELECT * FROM task_history
       WHERE task_id = $1 AND project_id = $2
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [req.params.taskId, req.params.projectId]
    );

    if (historyResult.rows.length === 0) {
      return res.status(404).json({ error: 'История изменений не найдена' });
    }

    const history = historyResult.rows[0];

    // удаляем эту запись истории чтобы следующий undo взял предыдущую
    await query('DELETE FROM task_history WHERE id = $1', [history.id]);

    if (history.action === 'create') {
      // отмена создания — удаляем саму задачу
      await query('DELETE FROM tasks WHERE id = $1', [req.params.taskId]);
      return res.json({ success: true, action: 'deleted' });
    }

    if (history.action === 'update') {
      // отмена редактирования — восстанавливаем предыдущий title и description
      const prev = history.payload;
      const result = await query(
        'UPDATE tasks SET title = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [prev.title, prev.description, req.params.taskId]
      );
      return res.json(result.rows[0]);
    }

    if (history.action === 'move') {
      // отмена перемещения — возвращаем в предыдущую колонку и позицию
      const prev = history.payload;
      const result = await query(
        `UPDATE tasks SET "column" = $1, position = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [prev.column, prev.position, req.params.taskId]
      );
      return res.json(result.rows[0]);
    }

    // action='delete' сюда не доходит — задача уже удалена и история cascade удалена
    return res.status(400).json({ error: 'Нельзя отменить это действие' });
  } catch (err) {
    console.error('Ошибка отмены действия:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
