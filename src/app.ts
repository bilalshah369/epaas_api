import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRouter        from './routes/auth.routes';
import applicationRouter from './routes/application.routes';
import uploadRouter      from './routes/upload.routes';
import nodalARouter      from './routes/nodalA.routes';
import technicalRouter   from './routes/technical.routes';
import appealRouter      from './routes/appeal.routes';
import extensionRouter   from './routes/extension.routes';
import publicRouter      from './routes/public.routes';
import { errorHandler } from './middleware/errorHandler.middleware';
// Future routes uncommented as each step is built:
// import workflowRouter     from './routes/workflow.routes';
// import decisionRouter     from './routes/decision.routes';
// import appealRouter       from './routes/appeal.routes';
// import reviewRouter       from './routes/review.routes';
// import extensionRouter    from './routes/extension.routes';
// import reportsRouter      from './routes/reports.routes';
// import notificationRouter from './routes/notification.routes';
// import adminRouter        from './routes/admin.routes';

const app = express();

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
app.use('/api/uploads',      uploadRouter);
app.use('/api/nodal-a',      nodalARouter);
app.use('/api/technical',   technicalRouter);
app.use('/api/appeals',     appealRouter);
app.use('/api/extensions',  extensionRouter);
// app.use('/api/workflow',     workflowRouter);
// app.use('/api/appeals',      appealRouter);
// app.use('/api/reviews',      reviewRouter);
// app.use('/api/extensions',   extensionRouter);
// app.use('/api/reports',      reportsRouter);
// app.use('/api/notifications',notificationRouter);
// app.use('/api/admin',        adminRouter);

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Centralized error handler (must be last) ───────────────────────────────
app.use(errorHandler);

export default app;
