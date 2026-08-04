const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const db = require('./db');
const { seedGeneralChannel } = require('./db/seed');
const { initializeSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/files', require('./routes/files'));
app.use('/api/updates', require('./routes/updates'));

app.use(express.static(path.join(__dirname, '../../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

db.raw('SELECT 1')
  .then(async () => {
    console.log('Connected to PostgreSQL');
    await seedGeneralChannel();
    initializeSocket(io);

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error('PostgreSQL connection error:', err);
    process.exit(1);
  });

module.exports = { app, server, io };
