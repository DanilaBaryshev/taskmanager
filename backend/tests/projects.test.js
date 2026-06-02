'use strict';

process.env.JWT_SECRET = 'test-secret';

// переменная для переключения поведения requireRole между тестами
// называется с mock чтобы jest поднял её вместе с jest.mock
let mockShouldBlockAccess = false;

// мокаем rbac — middleware читает переменную в момент запроса (замыкание)
jest.mock('../src/middleware/rbac', () => ({
  requireRole: () => (req, res, next) => {
    if (mockShouldBlockAccess) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    next();
  },
}));

// мокаем auth — всегда подставляем пользователя id=1
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

// мокаем базу данных
jest.mock('../src/db/index.js', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));

const request = require('supertest');
const app = require('../src/index');
const { query, pool } = require('../src/db/index.js');

beforeEach(() => {
  jest.clearAllMocks();
  // сбрасываем блокировку перед каждым тестом
  mockShouldBlockAccess = false;
});

describe('GET /api/projects', () => {
  test('возвращает список проектов пользователя', async () => {
    const projects = [
      { id: 1, name: 'Проект 1', description: null, owner_id: 1 },
    ];
    query.mockResolvedValueOnce({ rows: projects });

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(projects);
  });
});

describe('POST /api/projects', () => {
  test('создаёт проект и добавляет создателя как owner в members', async () => {
    const project = { id: 1, name: 'Новый проект', description: null, owner_id: 1 };

    // мок транзакционного клиента
    const mockClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })          // BEGIN
        .mockResolvedValueOnce({ rows: [project] })   // INSERT INTO projects
        .mockResolvedValueOnce({ rows: [] })           // INSERT INTO project_members
        .mockResolvedValueOnce({ rows: [] }),          // COMMIT
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Новый проект' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Новый проект');
    // проверяем что транзакция открылась и закрылась
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    // клиент должен быть освобождён
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('отсутствующее название возвращает 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('DELETE /api/projects/:id', () => {
  test('owner может удалить проект', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // DELETE успешно

    const res = await request(app).delete('/api/projects/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('не-owner получает 403', async () => {
    // переключаем мок чтобы он вернул 403
    mockShouldBlockAccess = true;

    const res = await request(app).delete('/api/projects/1');

    expect(res.status).toBe(403);
  });
});
