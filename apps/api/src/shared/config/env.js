import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        PORT: z.coerce.number().int().positive().default(4000),
        MONGODB_URI: z.string().url().startsWith('mongodb'),
        MONGODB_REPLICA_SET: z.string().min(1).default('rs0'),
        LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
        CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
        TRUST_PROXY: z.coerce.number().int().min(0).default(0),
        API_BODY_LIMIT: z.string().min(1).default('256kb'),
        JWT_ACCESS_SECRET: z.string().min(32),
        JWT_REFRESH_SECRET: z.string().min(32),
        JWT_ACCESS_EXPIRES_IN: z
            .string()
            .regex(/^[1-9]\d*[smhd]$/, 'Must be a positive integer followed by s, m, h, or d')
            .default('15m'),
        JWT_REFRESH_EXPIRES_IN: z
            .string()
            .regex(/^[1-9]\d*[smhd]$/, 'Must be a positive integer followed by s, m, h, or d')
            .default('7d'),
        JWT_ISSUER: z.string().min(1).default('vouchwire'),
        JWT_AUDIENCE: z.string().min(1).default('vouchwire-client'),
        REFRESH_COOKIE_NAME: z.string().min(1).default('vw_refresh'),
    })
    .superRefine((data, ctx) => {
        if (data.NODE_ENV === 'production') {
            const devPlaceholders = [
                'dev_access_secret_do_not_use_in_prod',
                'dev_refresh_secret_do_not_use_in_prod',
                'test_access_secret_do_not_use_in_prod',
                'test_refresh_secret_do_not_use_in_prod',
                'your_32_character_minimum_access_secret_here',
                'your_32_character_minimum_refresh_secret_here',
            ];
            if (devPlaceholders.includes(data.JWT_ACCESS_SECRET)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Cannot use development JWT access secret in production',
                    path: ['JWT_ACCESS_SECRET'],
                });
            }
            if (devPlaceholders.includes(data.JWT_REFRESH_SECRET)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Cannot use development JWT refresh secret in production',
                    path: ['JWT_REFRESH_SECRET'],
                });
            }
        }
    });

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
    const formatted = parseResult.error.flatten().fieldErrors;
    const message = Object.entries(formatted)
        .map(([key, errors]) => `  ${key}: ${errors.join(', ')}`)
        .join('\n');

    process.stderr.write(`\n❌ Invalid environment variables:\n${message}\n\n`);
    process.exit(1);
}

const env = Object.freeze(parseResult.data);

export default env;
