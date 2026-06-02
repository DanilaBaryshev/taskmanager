// загружаем переменные окружения из .env файла
require('dotenv').config();

const express = require('express');

const app = express();

// парсим входящий JSON
app.use(express.json());

// простая проверка что сервер живой
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// запускаем сервер только если файл запущен напрямую
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

// экспортируем app для тестов
module.exports = app;
