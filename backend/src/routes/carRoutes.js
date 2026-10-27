import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadImages } from '../middleware/upload.js';
import { createCar, deleteMyCar, getCar, getOwnedCar, listCars, listMyCars, updateMyCar } from '../controllers/carController.js';
import { createEnquiry } from '../controllers/enquiryController.js';

const router = Router();

router.get('/', asyncHandler(listCars));
router.get('/mine', requireAuth, asyncHandler(listMyCars));
router.post('/', requireAuth, uploadImages.array('images', 8), asyncHandler(createCar));
router.get('/:id/mine', requireAuth, asyncHandler(getOwnedCar));
router.patch('/:id', requireAuth, uploadImages.array('images', 8), asyncHandler(updateMyCar));
router.delete('/:id', requireAuth, asyncHandler(deleteMyCar));
router.post('/:id/enquiries', requireAuth, asyncHandler(createEnquiry));
router.get('/:id', asyncHandler(getCar));

export default router;
