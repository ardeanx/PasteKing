import type { WorkspaceRole } from '@pasteking/types';

/**
 * Workspace Permission Model (Phase 6)
 *
 * owner:  Full workspace control
 * admin:  Manage members (except owner-only actions), manage all workspace pastes
 * member: View workspace, CRUD own workspace pastes, read all workspace pastes
 *
 * Owner-only actions:
 *   - delete workspace
 *   - change a member's role to/from ADMIN
 *   - remove an ADMIN
 *   - transfer ownership (deferred)
 *
 * Workspace paste rules:
 *   - All members can create workspace pastes
 *   - All members can view workspace pastes
 *   - Author, admin, and owner can update/delete workspace pastes
 *   - Encrypted pastes cannot be workspace-owned
 */

type Action =
  | 'workspace.update'
  | 'workspace.delete'
  | 'member.list'
  | 'member.remove'
  | 'member.updateRole'
  | 'invite.create'
  | 'invite.revoke'
  | 'invite.list'
  | 'paste.create'
  | 'paste.view'
  | 'paste.update'
  | 'paste.delete'
  | 'auditLog.view';

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

/**
 * Check whether a workspace member with the given role can perform an action.
 * For actions on other members (remove, updateRole), pass the target member's role.
 * For paste mutations (update, delete), pass whether the actor is the paste author.
 */
export function canPerform(
  actorRole: WorkspaceRole,
  action: Action,
  opts?: { targetRole?: WorkspaceRole; isPasteAuthor?: boolean },
): boolean {
  const rank = ROLE_RANK[actorRole];

  switch (action) {
    // Workspace settings
    case 'workspace.update':
      return rank >= ROLE_RANK.ADMIN;
    case 'workspace.delete':
      return actorRole === 'OWNER';

    // Members
    case 'member.list':
      return rank >= ROLE_RANK.MEMBER;
    case 'member.remove': {
      if (rank < ROLE_RANK.ADMIN) return false;
      // Admin can only remove MEMBER, owner can remove anyone except self (handled in service)
      if (actorRole === 'OWNER') return true;
      return opts?.targetRole === 'MEMBER';
    }
    case 'member.updateRole':
      return actorRole === 'OWNER';

    // Invites
    case 'invite.create':
    case 'invite.revoke':
    case 'invite.list':
      return rank >= ROLE_RANK.ADMIN;

    // Pastes
    case 'paste.create':
    case 'paste.view':
      return rank >= ROLE_RANK.MEMBER;
    case 'paste.update':
    case 'paste.delete':
      if (rank >= ROLE_RANK.ADMIN) return true;
      return !!opts?.isPasteAuthor;

    // Audit logs
    case 'auditLog.view':
      return rank >= ROLE_RANK.ADMIN;

    default:
      return false;
  }
}
