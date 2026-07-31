import { Router } from 'express';
import { authController } from './controllers/auth.controller.js';
import { authRateLimiter } from './middlewares/auth-rate-limit.middleware.js';
import { authenticate } from '../../shared/middlewares/authenticate.middleware.js';
import { validateRequest as validate } from '../../shared/middlewares/validate-request.middleware.js';
import { registerSchema, loginSchema } from './validators/auth.validators.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
