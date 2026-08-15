import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const financeValidator = {
    getWallet: z
        .object({
            params: z
                .object({
                    workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
                })
                .strict(),
            query: z
                .object({
                    currency: z
                        .string()
                        .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter uppercase code'),
                })
                .strict(),
            body: z.object({}).strict().optional(),
        })
        .strict(),

    topUp: z
        .object({
            params: z
                .object({
                    workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
                })
                .strict(),
            query: z.object({}).strict().optional(),
            body: z
                .object({
                    currency: z
                        .string()
                        .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter uppercase code'),
                    amountMinor: z.number().int().positive().safe(),
                })
                .strict(),
        })
        .strict(),

    fundMilestone: z
        .object({
            params: z
                .object({
                    milestoneId: z.string().regex(objectIdPattern, 'Invalid milestone ID format'),
                })
                .strict(),
            query: z.object({}).strict().optional(),
            body: z.object({}).strict().optional(),
        })
        .strict(),

    approveAndRelease: z
        .object({
            params: z
                .object({
                    milestoneId: z.string().regex(objectIdPattern, 'Invalid milestone ID format'),
                })
                .strict(),
            query: z.object({}).strict().optional(),
            body: z.object({}).strict().optional(),
        })
        .strict(),
};
