import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const milestoneValidator = {
    createMilestone: z.object({
        params: z.object({
            agreementId: z.string().regex(objectIdPattern, 'Invalid agreement ID format'),
        }),
        body: z.object({
            title: z.string().min(1).max(160).trim(),
            description: z.string().max(5000).trim().optional(),
            amountMinor: z.number().int().positive().safe(),
            sequence: z.number().int().positive(),
            dueDate: z.coerce.date(),
        }),
    }),

    updateMilestone: z.object({
        params: z.object({
            milestoneId: z.string().regex(objectIdPattern, 'Invalid milestone ID format'),
        }),
        body: z
            .object({
                title: z.string().min(1).max(160).trim().optional(),
                description: z.string().max(5000).trim().optional(),
                amountMinor: z.number().int().positive().safe().optional(),
                sequence: z.number().int().positive().optional(),
                dueDate: z.coerce.date().optional(),
            })
            .refine((data) => Object.keys(data).length > 0, {
                message: 'Update body cannot be empty',
            }),
    }),

    getMilestone: z.object({
        params: z.object({
            milestoneId: z.string().regex(objectIdPattern, 'Invalid milestone ID format'),
        }),
    }),

    listMilestones: z.object({
        params: z.object({
            agreementId: z.string().regex(objectIdPattern, 'Invalid agreement ID format'),
        }),
        query: z.object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(10),
        }),
    }),

    deleteMilestone: z.object({
        params: z.object({
            milestoneId: z.string().regex(objectIdPattern, 'Invalid milestone ID format'),
        }),
    }),
};
