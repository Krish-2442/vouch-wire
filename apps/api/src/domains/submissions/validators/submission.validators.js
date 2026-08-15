import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const submissionValidator = {
    submitWork: z
        .object({
            params: z
                .object({
                    milestoneId: z.string().regex(objectIdPattern, 'Invalid milestone ID format'),
                })
                .strict(),
            query: z.object({}).strict().optional(),
            body: z
                .object({
                    summary: z.string().min(1).max(5000),
                    evidenceUrl: z.string().url().max(2048).optional(),
                })
                .strict(),
        })
        .strict(),

    getSubmission: z
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
