import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        fullName: z.string().min(1, 'Full name is required').trim(),
        email: z.string().email('Invalid email address').trim().toLowerCase(),
        password: z
            .string()
            .min(12, 'Password must be at least 12 characters long')
            .max(128, 'Password must be less than 128 characters long'),
        role: z.enum(['CLIENT', 'FREELANCER'], {
            errorMap: () => ({ message: 'Role must be either CLIENT or FREELANCER' }),
        }),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address').trim().toLowerCase(),
        password: z.string().min(1, 'Password is required'),
    }),
});
