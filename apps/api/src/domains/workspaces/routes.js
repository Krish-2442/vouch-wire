import { Router } from 'express';
import { workspaceController } from './controllers/workspace.controller.js';
import { workspaceValidator } from './validators/workspace.validator.js';
import { validateRequest } from '../../shared/middlewares/validate-request.middleware.js';
import { authenticate } from '../../shared/middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../shared/middlewares/authorize-roles.middleware.js';
import { workspaceAccess } from './middlewares/workspace-access.middleware.js';

const router = Router();

router.use(authenticate);

// Create workspace (Only CLIENT or FREELANCER)
router.post(
    '/',
    authorizeRoles('CLIENT', 'FREELANCER'),
    validateRequest(workspaceValidator.createWorkspace),
    workspaceController.createWorkspace,
);

// List workspaces
router.get(
    '/',
    validateRequest(workspaceValidator.getWorkspaces),
    workspaceController.getWorkspaces,
);

// Read workspace
router.get(
    '/:workspaceId',
    validateRequest(workspaceValidator.getWorkspaceById),
    workspaceAccess(),
    workspaceController.getWorkspaceById,
);

// Update workspace
router.patch(
    '/:workspaceId',
    validateRequest(workspaceValidator.updateWorkspace),
    workspaceAccess(['OWNER']),
    workspaceController.updateWorkspace,
);

// List members
router.get(
    '/:workspaceId/members',
    validateRequest(workspaceValidator.getMembers),
    workspaceAccess(),
    workspaceController.getMembers,
);

// Add member
router.post(
    '/:workspaceId/members',
    validateRequest(workspaceValidator.addMember),
    workspaceAccess(['OWNER']),
    workspaceController.addMember,
);

// Remove member
router.delete(
    '/:workspaceId/members/:membershipId',
    validateRequest(workspaceValidator.removeMember),
    workspaceAccess(['OWNER']),
    workspaceController.removeMember,
);

export default router;
