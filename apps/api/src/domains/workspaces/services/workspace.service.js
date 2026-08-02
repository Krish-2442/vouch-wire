import mongoose from 'mongoose';
import slugify from 'slugify';
import crypto from 'crypto';
import { workspaceRepository } from '../repositories/workspace.repository.js';
import { workspaceMembershipRepository } from '../repositories/workspace-membership.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const generateSlug = async (name) => {
    let slug = slugify(name, { lower: true, strict: true });

    const existingWorkspace = await workspaceRepository.findBySlug(slug);
    if (existingWorkspace) {
        const randomString = crypto.randomBytes(3).toString('hex');
        slug = `${slug}-${randomString}`;
    }

    return slug;
};

export const workspaceService = {
    createWorkspace: async ({ name, workspaceType, createdBy }) => {
        const session = await mongoose.startSession();
        let workspace;
        let membership;

        try {
            await session.withTransaction(async () => {
                const slug = await generateSlug(name);

                workspace = await workspaceRepository.create(
                    {
                        name,
                        slug,
                        workspaceType,
                        createdBy,
                    },
                    session,
                );

                membership = await workspaceMembershipRepository.create(
                    {
                        workspaceId: workspace._id,
                        userId: createdBy,
                        membershipRole: 'OWNER',
                        createdBy,
                    },
                    session,
                );
            });
        } finally {
            await session.endSession();
        }

        return {
            workspace,
            membership,
        };
    },

    getWorkspacesForUser: async ({ userId, page = 1, limit = 10 }) => {
        const skip = (page - 1) * limit;
        return workspaceMembershipRepository.findActiveByUserIdWithWorkspaces(userId, {
            skip,
            limit,
        });
    },

    getWorkspaceById: async ({ workspaceId }) => {
        const workspace = await workspaceRepository.findById(workspaceId);
        if (!workspace || !workspace.isActive) {
            throw new AppError(ErrorCodes.WORKSPACE_NOT_FOUND, 404, 'Workspace not found');
        }
        return workspace;
    },

    updateWorkspaceName: async ({ workspaceId, name }) => {
        const workspace = await workspaceRepository.findById(workspaceId);
        if (!workspace || !workspace.isActive) {
            throw new AppError(ErrorCodes.WORKSPACE_NOT_FOUND, 404, 'Workspace not found');
        }

        const updatedWorkspace = await workspaceRepository.updateById(workspaceId, { name });

        return updatedWorkspace;
    },
};
