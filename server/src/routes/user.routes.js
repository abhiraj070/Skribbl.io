import { Router } from 'express';
import { getRoomUsers, getRoomWord, login, logout, register } from '../controllers/user.controller.js';
import { VerifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', VerifyJWT, logout);
router.get('/room-users', VerifyJWT, getRoomUsers);
router.get('/room-word', VerifyJWT, getRoomWord);

export default router;
