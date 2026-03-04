const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const registerSocketHandlers = require('./sockets');
const { startTaskMonitoring } = require('./services/monitoringService');
const { ensureDemoData } = require('./services/bootstrapService');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('io', io);
registerSocketHandlers(io);

app.use('/api/patient', require('./routes/patient'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/events', require('./routes/events'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/known-people', require('./routes/knownPeople'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const startServer = async () => {
  try {
    await connectDB();
    const patient = await ensureDemoData();
    startTaskMonitoring(io);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Demo patient id: ${patient._id}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();