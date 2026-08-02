import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const currencyPattern = /^[A-Z]{3}$/;

export const agreementValidator = {
    createAgreement: z.object({
        body: z
            .object({
                clientWorkspaceId: z
                    .string()
                    .regex(objectIdPattern, 'Invalid client workspace ID format'),
                freelancerWorkspaceId: z
                    .string()
                    .regex(objectIdPattern, 'Invalid freelancer workspace ID format'),
                title: z.string().min(1).max(160).trim(),
                scope: z.string().min(1).max(10000).trim(),
                currency: z
                    .string()
                    .regex(currencyPattern, 'Currency must be a 3-letter uppercase code'),
                contractAmountMinor: z.number().int().positive().safe(),
                startDate: z.coerce.date(),
                endDate: z.coerce.date(),
            })
            .refine((data) => data.endDate >= data.startDate, {
                message: 'endDate must not be earlier than startDate',
                path: ['endDate'],
            }),
    }),

    updateAgreement: z.object({
        params: z.object({
            agreementId: z.string().regex(objectIdPattern, 'Invalid agreement ID format'),
        }),
        body: z.object({
            title: z.string().min(1).max(160).trim().optional(),
            scope: z.string().min(1).max(10000).trim().optional(),
            currency: z
                .string()
                .regex(currencyPattern, 'Currency must be a 3-letter uppercase code')
                .optional(),
            contractAmountMinor: z.number().int().positive().safe().optional(),
            startDate: z.coerce.date().optional(),
            endDate: z.coerce.date().optional(),
        }),
    }),

    getAgreement: z.object({
        params: z.object({
            agreementId: z.string().regex(objectIdPattern, 'Invalid agreement ID format'),
        }),
    }),

    listAgreements: z.object({
        params: z.object({
            workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
        }),
        query: z.object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(10),
        }),
    }),

    agreementAction: z.object({
        params: z.object({
            agreementId: z.string().regex(objectIdPattern, 'Invalid agreement ID format'),
        }),
    }),
};
