import { Router } from 'express';
import { authController } from './controllers/auth.controller.js';
import { authRateLimiter } from './middlewares/auth-rate-limit.middleware.js';
import { authenticate } from '../../shared/middlewares/authenticate.middleware.js';
import { validateRequest as validate } from '../../shared/middlewares/validate-request.middleware.js';
import { registerSchema, loginSchema } from './validators/auth.validators.js';

import { authorizeRoles } from '../../shared/middlewares/authorize-roles.middleware.js';
import env from '../../shared/config/env.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

if (env.NODE_ENV === 'test') {
    router.get('/test-admin', authenticate, authorizeRoles('ADMIN'), (req, res) =>
        res.status(200).json({ ok: true }),
    );

    router.get('/test-client', authenticate, authorizeRoles('CLIENT'), (req, res) =>
        res.status(200).json({ ok: true }),
    );

    router.get('/test-freelancer', authenticate, authorizeRoles('FREELANCER'), (req, res) =>
        res.status(200).json({ ok: true }),
    );
}

export default router;
