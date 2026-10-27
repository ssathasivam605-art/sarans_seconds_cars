import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { addFavourite, listFavourites, removeFavourite } from '../controllers/carController.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(listFavourites));
router.put('/:carId', asyncHandler(addFavourite));
router.delete('/:carId', asyncHandler(removeFavourite));
export default router;
