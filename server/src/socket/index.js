const jwt = require('jsonwebtoken');
const config = require('../config');
const Users = require('../db/queries/users');
const Channels = require('../db/queries/channels');
const Messages = require('../db/queries/messages');
const db = require('../db');
const { mapUser } = require('../db/mappers');

const onlineUsers = new Map();

function initializeSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await Users.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.username} (socket: ${socket.id})`);

    const wasOnline = onlineUsers.has(socket.userId);
    console.log(`wasOnline: ${wasOnline}, onlineUsers count: ${onlineUsers.size}`);
    onlineUsers.set(socket.userId, socket.id);

    await Users.updateById(socket.userId, { status: 'online' });
    io.emit('user-status', { userId: socket.userId, status: 'online' });

    const userChannels = await db('channel_members')
      .where('user_id', socket.userId)
      .select('channel_id');
    userChannels.forEach((ch) => {
      socket.join(`channel:${ch.channel_id}`);
    });

    if (!wasOnline) {
      const userLastSeen = socket.user.last_seen;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isNewUser = !userLastSeen || userLastSeen < fiveMinutesAgo;
      console.log(`last_seen: ${userLastSeen}, isNewUser: ${isNewUser}`);

      console.log(`Emitting new-user for ${socket.user.username}`);
      io.emit('new-user', {
        user: mapUser(socket.user)
      });
    }

    socket.on('join-channel', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('leave-channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('typing', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        channelId
      });
    });

    socket.on('stop-typing', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('user-stop-typing', {
        userId: socket.userId,
        channelId
      });
    });

    socket.on('mark-read', async ({ channelId, messageId }) => {
      await Messages.addReadBy(messageId, socket.userId);
      const message = await Messages.findById(messageId);
      if (message) {
        io.to(`channel:${channelId}`).emit('message-read', {
          messageId,
          channelId,
          userId: socket.userId,
          senderId: message.sender_id
        });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.username}`);

      onlineUsers.delete(socket.userId);

      const lastSeen = new Date();
      await Users.updateById(socket.userId, {
        status: 'offline',
        last_seen: lastSeen
      });

      io.emit('user-status', {
        userId: socket.userId,
        status: 'offline',
        lastSeen
      });
    });
  });
}

module.exports = { initializeSocket };
