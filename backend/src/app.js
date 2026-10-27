import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import carRoutes from './routes/carRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import favouriteRoutes from './routes/favouriteRoutes.js';
import asyncHandler from './middleware/asyncHandler.js';
import { createContactMessage } from './controllers/contactController.js';

const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const uploadDir = path.resolve(root, process.env.UPLOAD_DIR || 'backend/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:']
    }
  }
}));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir, { maxAge: '1d', fallthrough: false }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/favourites', favouriteRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.post('/api/contact', asyncHandler(createContactMessage));
app.use('/api/admin', adminRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

app.use((error, _req, res, _next) => {
  if (error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be smaller than 5 MB.' : 'Upload up to 8 images.';
    return res.status(400).json({ error: message });
  }
  const status = error.status || (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status < 500 ? error.message : 'Something went wrong. Please try again.' });
});

const distDir = path.resolve(root, 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

export default app;
