const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const router = express.Router();

// создаем JWT токен для пользователя, срок 7 дней
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register — регистрация нового пользователя
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // проверяем что email и пароль переданы и не пустые
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  // простая проверка формата email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Некорректный формат email' });
  }

  // пароль должен быть хотя бы 6 символов
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
  }

  try {
    // проверяем что пользователь с таким email еще не существует
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // хешируем пароль перед сохранением
    const passwordHash = await bcrypt.hash(password, 10);

    // вставляем нового пользователя в базу
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user);

    return res.status(201).json({ token });
  } catch (err) {
    console.error('Ошибка регистрации:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/auth/login — вход по email и паролю
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // проверяем что оба поля переданы
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  try {
    // ищем пользователя по email
    const result = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];

    // сравниваем введенный пароль с хешем из базы
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = signToken(user);

    return res.json({ token });
  } catch (err) {
    console.error('Ошибка входа:', err.message);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
