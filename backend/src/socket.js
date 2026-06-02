const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// храним экземпляр io чтобы использовать в других модулях
let io;

// инициализируем Socket.IO и навешиваем обработчики подключений
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      // разрешаем подключения от любого источника (для разработки)
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // клиент должен отправить join с токеном чтобы попасть в комнату проекта
    socket.on('join', ({ projectId, token }) => {
      if (!projectId || !token) {
        socket.emit('error', { message: 'projectId и token обязательны' });
        return;
      }

      try {
        // проверяем токен перед тем как пустить в комнату
        jwt.verify(token, process.env.JWT_SECRET);
        const room = `project:${projectId}`;
        socket.join(room);
      } catch (err) {
        socket.emit('error', { message: 'Токен невалиден или истек' });
      }
    });
  });

  return io;
}

// рассылаем событие всем участникам комнаты проекта
function emitToProject(projectId, event, data) {
  if (!io) return;
  io.to(`project:${projectId}`).emit(event, data);
}

module.exports = { initSocket, emitToProject };
