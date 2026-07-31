import { z } from 'zod';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const workspaceValidator = {
    createWorkspace: z.object({
        body: z.object({
            name: z.string().min(1).max(100).trim(),
        }),
    }),

    getWorkspaces: z.object({
        query: z.object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(10),
        }),
    }),

    getWorkspaceById: z.object({
        params: z.object({
            workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
        }),
    }),

    updateWorkspace: z.object({
        params: z.object({
            workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
        }),
        body: z.object({
            name: z.string().min(1).max(100).trim(),
        }),
    }),

    addMember: z.object({
        params: z.object({
            workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
        }),
        body: z.object({
            email: z.string().email(),
        }),
    }),

    getMembers: z.object({
        params: z.object({
            workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
        }),
        query: z.object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(10),
        }),
    }),

    removeMember: z.object({
        params: z.object({
            workspaceId: z.string().regex(objectIdPattern, 'Invalid workspace ID format'),
            membershipId: z.string().regex(objectIdPattern, 'Invalid membership ID format'),
        }),
    }),
};
