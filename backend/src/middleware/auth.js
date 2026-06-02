const jwt = require('jsonwebtoken');

// проверяем JWT из заголовка Authorization
function auth(req, res, next) {
  const header = req.headers['authorization'];

  // токен должен быть в формате "Bearer <token>"
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  const token = header.slice(7);

  try {
    // декодируем токен и прикрепляем данные пользователя к запросу
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Токен невалиден или истек' });
  }
}

module.exports = auth;
