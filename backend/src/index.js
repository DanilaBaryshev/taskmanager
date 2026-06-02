// загружаем переменные окружения из .env файла
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSocket } = require('./socket');

const app = express();
// создаём HTTP сервер чтобы передать его в Socket.IO
const httpServer = http.createServer(app);

// разрешаем кросс-доменные запросы от фронтенда
app.use(cors());

// парсим входящий JSON
app.use(express.json());

// маршруты авторизации
app.use('/api/auth', require('./routes/auth'));

// маршруты проектов и участников
app.use('/api/projects', require('./routes/projects'));

// маршруты задач (вложены в /api/projects/:projectId/tasks)
app.use('/api/projects', require('./routes/tasks'));

// простая проверка что сервер живой
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// подключаем Socket.IO к HTTP серверу
initSocket(httpServer);

// запускаем HTTP сервер только если файл запущен напрямую
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

// экспортируем app для тестов
module.exports = app;
