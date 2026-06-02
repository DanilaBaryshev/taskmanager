const { query } = require('../db');

// фабрика middleware — принимает список допустимых ролей
function requireRole(...roles) {
  return async function (req, res, next) {
    const userId = req.user.id;
    const projectId = req.params.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId не указан' });
    }

    try {
      // проверяем, является ли пользователь владельцем проекта
      const projectResult = await query(
        'SELECT owner_id FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ error: 'Проект не найден' });
      }

      const project = projectResult.rows[0];

      // владелец проекта всегда имеет доступ
      if (project.owner_id === userId) {
        req.projectRole = 'owner';
        return next();
      }

      // проверяем членство в проекте через таблицу project_members
      const memberResult = await query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({ error: 'Нет доступа к этому проекту' });
      }

      const role = memberResult.rows[0].role;

      // проверяем что роль входит в список допустимых
      if (!roles.includes(role)) {
        return res.status(403).json({ error: 'Недостаточно прав' });
      }

      // прикрепляем роль к запросу для дальнейших проверок
      req.projectRole = role;
      next();
    } catch (err) {
      console.error('Ошибка проверки прав:', err.message);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  };
}

module.exports = { requireRole };
