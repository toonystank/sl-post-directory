import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

export interface VerifiedSessionUser {
    id: string;
    email: string;
    name?: string | null;
    role: string;
}

/**
 * Retrieves the current server session and verifies that a valid, non-revoked
 * user ID, email, and role are present, returning a uniform 401/403 response otherwise.
 */
export async function requireRole(
    allowedRoles: readonly string[]
): Promise<
    | { ok: true; user: VerifiedSessionUser }
    | { ok: false; response: NextResponse }
> {
    const session = await getServerSession(authOptions);
    const user = session?.user as
        | { id?: unknown; email?: unknown; name?: string | null; role?: unknown }
        | undefined;

    if (
        !session ||
        !user ||
        typeof user.id !== "string" ||
        !user.id ||
        typeof user.email !== "string" ||
        !user.email ||
        typeof user.role !== "string" ||
        !user.role
    ) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            ),
        };
    }

    if (!allowedRoles.includes(user.role)) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Forbidden" },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            ),
        };
    }

    return {
        ok: true,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
    };
}
