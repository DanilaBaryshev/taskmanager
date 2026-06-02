'use strict';

// устанавливаем секрет JWT до загрузки приложения
process.env.JWT_SECRET = 'test-secret';

// мокаем базу данных — не нужно реальное подключение
jest.mock('../src/db/index.js', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));

// мокаем bcrypt чтобы тесты работали быстро
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/index');
const { query } = require('../src/db/index.js');
const bcrypt = require('bcryptjs');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  test('успешная регистрация возвращает токен', async () => {
    // пользователя с таким email нет
    query.mockResolvedValueOnce({ rows: [] });
    // сохраняем нового пользователя
    query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com' }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  test('дублирующийся email возвращает 400', async () => {
    // пользователь с таким email уже есть
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/уже существует/);
  });

  test('отсутствующие поля возвращают 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/auth/login', () => {
  test('успешный вход возвращает токен', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'test@example.com', password_hash: 'hashed_password' }],
    });
    // пароль совпадает
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('неверный пароль возвращает 401', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'test@example.com', password_hash: 'hashed_password' }],
    });
    // пароль не совпадает
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Неверный/);
  });

  test('пользователь не найден возвращает 401', async () => {
    // пользователя нет в базе
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notfound@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Неверный/);
  });
});
