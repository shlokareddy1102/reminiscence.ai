const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const registerSocketHandlers = require('./sockets');
const { startTaskMonitoring } = require('./services/monitoringService');
const { ensureDemoData } = require('./services/bootstrapService');
const { startFaceIndexSync } = require('./services/faceIndexService');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080';
const allowedOrigins = CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

const isPrivateDevOrigin = (origin) => {
  try {
    const url = new URL(origin);
    const host = url.hostname;

    if (host === 'localhost' || host === '127.0.0.1') return true;

    // Accept private LAN IP ranges for local dev (WSL, Docker, mobile testing).
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

    return false;
  } catch (_err) {
    return false;
  }
};

const corsOrigin = (origin, callback) => {
  // Allow non-browser requests and same-origin tools without an Origin header.
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (isPrivateDevOrigin(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
  }
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.set('io', io);
registerSocketHandlers(io);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/events', require('./routes/events'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/known-people', require('./routes/knownPeople'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/location', require('./routes/location'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/cognitive', require('./routes/cognitive'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const startServer = async () => {
  try {
    await connectDB();
    const patient = await ensureDemoData();
    startTaskMonitoring(io);
    startFaceIndexSync();

    server.listen(Number(PORT), () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Patient id: ${patient._id}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();