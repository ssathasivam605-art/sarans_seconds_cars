import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { listMyEnquiries } from '../controllers/enquiryController.js';

const router = Router();
router.get('/', requireAuth, asyncHandler(listMyEnquiries));
export default router;
