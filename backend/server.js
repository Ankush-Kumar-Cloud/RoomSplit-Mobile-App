require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const helmet     = require('helmet');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const connectDB  = require('./config/db');
const { authRouter, groupRouter, expenseRouter } = require('./routes/index');

const app = express();
const http       = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
  });
});

connectDB();

// ── Security headers ────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────
app.use(cors({ origin: '*' })); // Allow all origins for mobile

// ── Compression — gzip all JSON responses ───────────────
// Reduces response payload by 60-80%, speeds up slow connections
app.use(compression());

// ── Body parsing ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── HTTP request logging ────────────────────────────────
app.use(morgan('dev'));

// ── Global rate limiter ─────────────────────────────────
// Protects every endpoint from general abuse
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' },
}));

// ── Strict rate limiter on auth routes ──────────────────
// Prevents brute-force password attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
});
app.use('/api/auth/login',  authLimiter);
app.use('/api/auth/signup', authLimiter);

// ── Routes ───────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/auth',             authRouter);
app.use('/api/groups',           groupRouter);
app.use('/api/groups/:groupId',  expenseRouter);

// ── 404 handler ──────────────────────────────────────────
app.use((_, res) => res.status(404).json({ message: 'Not found' }));

// ── Global error handler ─────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 API running on port ${PORT}`));

