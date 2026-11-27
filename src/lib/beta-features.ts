/**
 * Mail Routing Hub (Beta) feature access helpers.
 *
 * Rules:
 * - Public (unauthenticated) visitors NEVER have access to Mail Routing Beta.
 * - Authenticated users have Mail Routing Beta DISABLED by default until
 *   explicitly enabled in Profile -> Beta Features or per-user by an Admin.
 * - Admins can disable the beta globally (`betaAvailable = false`) or lock it
 *   to admin-assigned testers only (`selfOptInAllowed = false`).
 */

export interface MailRoutingAccessInput {
    isAuthenticated: boolean;
    betaAvailable: boolean;
    userEnabled: boolean;
}

export interface MailRoutingTogglePermissionInput {
    role: string;
    betaAvailable: boolean;
    selfOptInAllowed: boolean;
    nextEnabled: boolean;
}

export function computeMailRoutingAccess({
    isAuthenticated,
    betaAvailable,
    userEnabled,
}: MailRoutingAccessInput): boolean {
    return Boolean(isAuthenticated && betaAvailable && userEnabled);
}

/**
 * Validates whether a logged-in user is allowed to self-toggle Mail Routing Beta
 * from their own profile settings. Turning it OFF is always permitted.
 */
export function canUserSelfToggleMailRouting({
    role,
    betaAvailable,
    selfOptInAllowed,
    nextEnabled,
}: MailRoutingTogglePermissionInput): { ok: true } | { ok: false; reason: string } {
    if (!nextEnabled) {
        return { ok: true };
    }
    if (!betaAvailable) {
        return {
            ok: false,
            reason: "Mail Routing Beta is currently paused by an administrator.",
        };
    }
    const isAdminPlus = role === "ADMIN" || role === "SUPER_ADMIN";
    if (!selfOptInAllowed && !isAdminPlus) {
        return {
            ok: false,
            reason: "Mail Routing Beta is currently invite-only. Contact an administrator to enable access for your account.",
        };
    }
    return { ok: true };
}
