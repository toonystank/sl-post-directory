"use client";

import { useSession } from "next-auth/react";
import { computeMailRoutingAccess } from "@/lib/beta-features";

interface SessionBetaUser {
    id?: string;
    role?: string;
    mailRoutingBetaEnabled?: boolean;
    mailRoutingBetaAvailable?: boolean;
    mailRoutingSelfOptIn?: boolean;
}

export interface MailRoutingBetaState {
    enabled: boolean;
    betaAvailable: boolean;
    selfOptInAllowed: boolean;
    userEnabled: boolean;
    isAuthenticated: boolean;
    loading: boolean;
}

/**
 * Hydration-safe hook resolving whether the current user has Mail Routing (Beta) enabled.
 * Always returns `enabled = false` while loading or for unauthenticated public visitors.
 */
export function useMailRoutingBeta(): MailRoutingBetaState {
    const { data: session, status } = useSession();
    const user = session?.user as SessionBetaUser | undefined;
    const isAuthenticated = status === "authenticated" && Boolean(user?.id);
    const betaAvailable = user?.mailRoutingBetaAvailable !== false;
    const selfOptInAllowed = user?.mailRoutingSelfOptIn !== false;
    const userEnabled = Boolean(user?.mailRoutingBetaEnabled);

    return {
        enabled: computeMailRoutingAccess({
            isAuthenticated,
            betaAvailable,
            userEnabled,
        }),
        betaAvailable,
        selfOptInAllowed,
        userEnabled,
        isAuthenticated,
        loading: status === "loading",
    };
}
