import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().url().startsWith('mongodb'),
    MONGODB_REPLICA_SET: z.string().min(1).default('rs0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    API_BODY_LIMIT: z.string().min(1).default('256kb'),
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
