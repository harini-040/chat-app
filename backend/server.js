const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { 
  cors: { 
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  } 
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/chatapp')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// User Model
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', UserSchema);

// Message Model
const MessageSchema = new mongoose.Schema({
  room: String,
  username: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const verified = jwt.verify(token, 'secretkey');
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ========== API ROUTES ==========

// Register
app.post('/api/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({
      username: req.body.username,
      password: hashedPassword
    });
    await user.save();
    res.json({ message: 'User created successfully!' });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists!' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (!user) return res.status(400).json({ error: 'User not found!' });
  
  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.status(400).json({ error: 'Wrong password!' });
  
  const token = jwt.sign({ username: user.username }, 'secretkey');
  res.json({ token, username: user.username });
});

// Get chat history for any room
app.get('/api/messages/:room', auth, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room }).limit(50).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SOCKET.IO ==========

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('No token'));
  }
  try {
    const decoded = jwt.verify(token, 'secretkey');
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.username}`);
  
  socket.on('join-room', (room) => {
    // Leave previous room if exists
    if (socket.room) {
      socket.leave(socket.room);
      io.to(socket.room).emit('message', {
        username: 'System',
        text: `${socket.username} left ${socket.room}`,
        timestamp: new Date()
      });
    }
    
    socket.room = room;
    socket.join(room);
    console.log(`${socket.username} joined room: ${room}`);
    
    // Send welcome message
    io.to(room).emit('message', {
      username: 'System',
      text: `${socket.username} joined the room`,
      timestamp: new Date()
    });
  });
  
  socket.on('send-message', async (data) => {
    if (!socket.room) return;
    
    const message = new Message({
      room: socket.room,
      username: socket.username,
      text: data.text,
      timestamp: new Date()
    });
    await message.save();
    
    io.to(socket.room).emit('message', {
      username: socket.username,
      text: data.text,
      timestamp: new Date()
    });
  });
  
  socket.on('disconnect', () => {
    if (socket.room) {
      io.to(socket.room).emit('message', {
        username: 'System',
        text: `${socket.username} left the room`,
        timestamp: new Date()
      });
      console.log(`${socket.username} disconnected from ${socket.room}`);
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});