'use strict';

process.env.JWT_SECRET = 'test-secret';

let mockShouldBlockAccess = false;

// мокаем rbac — middleware читает переменную в момент запроса
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

// мокаем socket — не нужны реальные соединения в тестах
jest.mock('../src/socket', () => ({
  initSocket: jest.fn(),
  emitToProject: jest.fn(),
}));

const request = require('supertest');
const app = require('../src/index');
const { query } = require('../src/db/index.js');
const { emitToProject } = require('../src/socket');

beforeEach(() => {
  jest.clearAllMocks();
  mockShouldBlockAccess = false;
});

describe('GET /api/projects/:projectId/tasks', () => {
  test('возвращает задачи сгруппированные по колонкам', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, project_id: 1, column: 'todo', title: 'Задача 1', position: 0 },
        { id: 2, project_id: 1, column: 'done', title: 'Задача 2', position: 0 },
      ],
    });

    const res = await request(app).get('/api/projects/1/tasks');

    expect(res.status).toBe(200);
    // проверяем что все три колонки присутствуют
    expect(res.body).toHaveProperty('todo');
    expect(res.body).toHaveProperty('in_progress');
    expect(res.body).toHaveProperty('done');
    expect(res.body.todo).toHaveLength(1);
    expect(res.body.done).toHaveLength(1);
    expect(res.body.in_progress).toHaveLength(0);
  });
});

describe('POST /api/projects/:projectId/tasks', () => {
  test('создаёт задачу в колонке todo', async () => {
    const task = {
      id: 1,
      project_id: 1,
      column: 'todo',
      title: 'Новая задача',
      description: null,
      position: 0,
    };

    // вычисление следующей позиции
    query.mockResolvedValueOnce({ rows: [{ next_pos: 0 }] });
    // вставка задачи
    query.mockResolvedValueOnce({ rows: [task] });
    // запись в историю
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/projects/1/tasks')
      .send({ title: 'Новая задача' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Новая задача');
    expect(res.body.column).toBe('todo');
    // событие отправлено всем участникам проекта
    expect(emitToProject).toHaveBeenCalledWith('1', 'task:created', expect.any(Object));
  });

  test('отсутствующий заголовок возвращает 400', async () => {
    const res = await request(app)
      .post('/api/projects/1/tasks')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/projects/:projectId/tasks/:taskId/move', () => {
  test('перемещает задачу в указанную колонку', async () => {
    const currentTask = { id: 1, project_id: 1, column: 'todo', title: 'Task', position: 0 };
    const movedTask = { ...currentTask, column: 'in_progress', position: 0 };

    // получаем текущее состояние задачи
    query.mockResolvedValueOnce({ rows: [currentTask] });
    // следующая позиция в целевой колонке
    query.mockResolvedValueOnce({ rows: [{ next_pos: 0 }] });
    // обновляем задачу
    query.mockResolvedValueOnce({ rows: [movedTask] });
    // сохраняем в историю
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/projects/1/tasks/1/move')
      .send({ column: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.column).toBe('in_progress');
    expect(emitToProject).toHaveBeenCalledWith('1', 'task:moved', expect.any(Object));
  });

  test('невалидная колонка возвращает 400', async () => {
    const res = await request(app)
      .put('/api/projects/1/tasks/1/move')
      .send({ column: 'invalid' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/projects/:projectId/tasks/:taskId/undo', () => {
  test('отменяет перемещение задачи', async () => {
    const historyEntry = {
      id: 10,
      task_id: 1,
      project_id: 1,
      action: 'move',
      // payload приходит из JSONB как объект
      payload: { column: 'todo', position: 0 },
    };
    const restoredTask = { id: 1, column: 'todo', position: 0 };

    // получаем последнюю запись истории
    query.mockResolvedValueOnce({ rows: [historyEntry] });
    // удаляем запись истории
    query.mockResolvedValueOnce({ rows: [] });
    // восстанавливаем предыдущее состояние задачи
    query.mockResolvedValueOnce({ rows: [restoredTask] });

    const res = await request(app).post('/api/projects/1/tasks/1/undo');

    expect(res.status).toBe(200);
    expect(res.body.column).toBe('todo');
  });

  test('undo создания удаляет задачу', async () => {
    const historyEntry = {
      id: 11,
      task_id: 2,
      project_id: 1,
      action: 'create',
      payload: null,
    };

    query.mockResolvedValueOnce({ rows: [historyEntry] }); // история
    query.mockResolvedValueOnce({ rows: [] });              // удаляем запись
    query.mockResolvedValueOnce({ rows: [] });              // удаляем задачу

    const res = await request(app).post('/api/projects/1/tasks/2/undo');

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('deleted');
  });

  test('нет истории возвращает 404', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // история пустая

    const res = await request(app).post('/api/projects/1/tasks/99/undo');

    expect(res.status).toBe(404);
  });
});
