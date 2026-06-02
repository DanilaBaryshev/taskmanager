const { Pool } = require('pg');

// создаем пул подключений к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// логируем ошибки пула, но не роняем приложение
pool.on('error', (err) => {
  console.error('Ошибка подключения к базе данных:', err.message);
});

// удобная обертка для выполнения запросов
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = { pool, query };
