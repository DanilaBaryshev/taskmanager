# Task Manager

## Описание

Веб-приложение для управления задачами в стиле Kanban с JWT-авторизацией, ролевой моделью доступа (RBAC) и обновлениями доски в реальном времени через WebSocket. Поддерживает совместную работу нескольких пользователей над одним проектом, историю изменений задач с возможностью отмены (паттерн Command).

## Стек технологий

- Frontend: React + Vite
- Backend: Node.js, Express
- База данных: PostgreSQL 16
- Авторизация: JWT
- Реальное время: Socket.IO
- Контейнеризация: Docker, Docker Compose

## Запуск проекта

### Требования

- Docker и Docker Compose
- Пользователь добавлен в группу `docker` (один раз, затем перелогиниться или выполнить `newgrp docker`):
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Первый запуск

```bash
git clone https://github.com/DanilaBaryshev/taskmanager
cd taskmanager
cp .env.example .env
docker-compose up --build
```

### Повторный запуск

```bash
cd taskmanager
docker-compose down && docker-compose up --build
```

Открыть в браузере: http://localhost

Backend API доступен на http://localhost:4000

## Переменные окружения

Файл `.env.example` содержит все необходимые переменные:

| Переменная     | Описание                             | Значение по умолчанию                         |
|----------------|--------------------------------------|-----------------------------------------------|
| `PORT`         | Порт, на котором запускается backend | `4000`                                        |
| `DATABASE_URL` | Строка подключения к PostgreSQL      | `postgres://user:password@db:5432/taskmanager`|
| `JWT_SECRET`   | Секрет для подписи JWT-токенов       | `changeme`                                    |


## Запуск тестов

### Backend

```bash
npm test
```

Или с покрытием:

```bash
npm run test:coverage
```

Запуск через Docker:

```bash
docker-compose run --rm backend npm run test:coverage
```

### Frontend

```bash
npm test
```

Запуск через Docker:

```bash
docker-compose run --rm frontend npm test
```

## Роли RBAC

| Роль     | Описание                                                                                        |
|----------|-------------------------------------------------------------------------------------------------|
| `owner`  | Полный доступ: управление проектом, участниками, задачами, удаление проекта                    |
| `editor` | Создание, редактирование, перемещение и удаление задач. Нельзя управлять участниками и удалять проект |
| `viewer` | Только просмотр. Никаких изменений вносить нельзя                                              |

При создании проекта пользователь автоматически становится его `owner`.
