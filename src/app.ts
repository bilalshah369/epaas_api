import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { UPLOAD_DIR } from './middleware/upload.middleware';

import authRouter        from './routes/auth.routes';
import applicationRouter from './routes/application.routes';
import uploadRouter      from './routes/upload.routes';
import nodalARouter      from './routes/nodalA.routes';
import technicalRouter   from './routes/technical.routes';
import ecRouter          from './routes/ec.routes';
import nodalBRouter      from './routes/nodal-b.routes';
import ceoRouter         from './routes/ceo.routes';
import chairpersonRouter from './routes/chairperson.routes';
import appealRouter      from './routes/appeal.routes';
import extensionRouter   from './routes/extension.routes';
import publicRouter      from './routes/public.routes';
import adminRouter       from './routes/admin.routes';
import { errorHandler } from './middleware/errorHandler.middleware';

const app = express();

// Trust reverse proxy (Docker Swarm ingress / nginx) so express-rate-limit
// can read the real client IP from X-Forwarded-For
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  })
);

// ── Global rate limiting (TDD §10 — 200 req/min) ──────────────────────────
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'E-PAAS API', ts: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRouter);
app.use('/api/public',       publicRouter);
app.use('/api/applications', applicationRouter);
// Serve uploaded files via express.static (reliable on all platforms)
app.use('/api/uploads', express.static(UPLOAD_DIR, { fallthrough: true }));
app.use('/api/uploads',      uploadRouter);
// Fallback: also serve UUID-named files at /api/:filename (handles URLs where /uploads/ is missing)
app.use('/api', express.static(UPLOAD_DIR, { fallthrough: true }));
app.use('/api/nodal-a',      nodalARouter);
app.use('/api/technical',   technicalRouter);
app.use('/api/ec',          ecRouter);
app.use('/api/nodal-b',     nodalBRouter);
app.use('/api/ceo',         ceoRouter);
app.use('/api/chairperson', chairpersonRouter);
app.use('/api/appeals',     appealRouter);
app.use('/api/extensions',  extensionRouter);
app.use('/api/admin',       adminRouter);

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Centralized error handler (must be last) ───────────────────────────────
app.use(errorHandler);

export default app;
