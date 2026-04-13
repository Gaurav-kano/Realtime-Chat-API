const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { initSocket } = require('./socket');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');

const app = express();
const httpServer = http.createServer(app);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await initSocket(httpServer);
  httpServer.listen(3000, () => console.log('Server running on port 3000'));
};

start();