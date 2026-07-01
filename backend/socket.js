const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'companygrow_secret_key';

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST']
    }
  });

  // Authenticate the socket handshake with the same JWT issued at login,
  // so a client can only ever join its own notification room.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.userId);
  });

  return io;
};

const notifyUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(userId.toString()).emit(event, payload);
};

module.exports = { initSocket, notifyUser };
