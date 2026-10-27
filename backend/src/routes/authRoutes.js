import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { login, logout, me, register, updateProfile } from '../controllers/authController.js';

const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });

router.post('/register', authLimit, asyncHandler(register));
router.post('/login', authLimit, asyncHandler(login));
router.post('/logout', logout);
router.get('/me', requireAuth, asyncHandler(me));
router.patch('/profile', requireAuth, asyncHandler(updateProfile));

export default router;
