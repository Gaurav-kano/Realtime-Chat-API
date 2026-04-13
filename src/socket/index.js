const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const messageService = require('../services/messageService');

const onlineUsers = new Map(); // userId → Set of socketIds

const initSocket = async (httpServer) => {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);

  const io = new Server(httpServer, {
    cors: { origin: '*' },
    adapter: createAdapter(pubClient, subClient) // enables horizontal scaling
  });

  // socket auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // track online presence
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    io.emit('user:online', { userId });

    // join room
    socket.on('room:join', async ({ roomId }) => {
      socket.join(roomId);
      socket.to(roomId).emit('room:user_joined', { userId, roomId });
    });

    // send message
    socket.on('message:send', async ({ roomId, content, type, fileUrl }) => {
      try {
        const message = await messageService.sendMessage({
          roomId, senderId: userId, content, type, fileUrl
        });
        io.to(roomId).emit('message:new', message);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // typing indicator
    socket.on('typing:start', ({ roomId }) => {
      socket.to(roomId).emit('typing:start', { userId, roomId });
    });

    socket.on('typing:stop', ({ roomId }) => {
      socket.to(roomId).emit('typing:stop', { userId, roomId });
    });

    // read receipt
    socket.on('message:read', async ({ messageId }) => {
      const Message = require('../models/Message');
      await Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: userId } });
      socket.broadcast.emit('message:read', { messageId, userId });
    });

    // disconnect
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      sockets?.delete(socket.id);

      if (!sockets?.size) {
        onlineUsers.delete(userId);
        io.emit('user:offline', { userId });
      }
    });
  });

  return io;
};

module.exports = { initSocket };