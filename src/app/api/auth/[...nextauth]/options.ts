import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import NextAuth, { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { verifySync } from "otplib";
import { checkRateLimitByKey, rateLimiters } from "@/lib/rate-limiter";
import {
    computePasswordVersion,
    consumeBackupCodeAtomically,
    decryptTotpSecret,
    encryptTotpSecret,
    isEncryptedTotpSecret,
    matchRecoveryCode,
} from "@/lib/two-factor-crypto";

// Constant dummy bcrypt hash so unknown-email login attempts perform the same CPU work
const DUMMY_BCRYPT_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

interface AuthenticatedUser {
    id: string;
    name: string;
    email: string;
    role: string;
    pwv: string;
    mailRoutingBetaEnabled: boolean;
}

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                token: { label: "2FA Token", type: "text" },
            },
            async authorize(credentials): Promise<AuthenticatedUser | null> {
                if (!credentials?.email || !credentials?.password) return null;

                const normalizedEmail = credentials.email.trim().toLowerCase();
                if (!normalizedEmail) return null;

                const acctLimit = await checkRateLimitByKey(normalizedEmail, rateLimiters.loginAccount);
                if (acctLimit.isRateLimited) {
                    throw new Error("Too many login attempts. Try again in 15 minutes.");
                }

                const user = await prisma.user.findFirst({
                    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
                });

                // Always execute bcrypt.compare before branching to eliminate timing & enumeration oracles
                const isValid = await bcrypt.compare(
                    credentials.password,
                    user?.passwordHash ?? DUMMY_BCRYPT_HASH
                );

                if (!user || !isValid) {
                    throw new Error("Invalid email or password");
                }

                // Check email verification ONLY after verifying password
                if (user.role === "CONTRIBUTOR" && !user.emailVerified) {
                    throw new Error("Please verify your email address to log in. Check your inbox.");
                }

                if (user.twoFactorEnabled) {
                    const token = credentials.token?.trim();
                    if (!token || token === "undefined") {
                        throw new Error("2FA_REQUIRED");
                    }

                    const twoFactorLimit = await checkRateLimitByKey(user.id, rateLimiters.twoFactorAccount);
                    if (twoFactorLimit.isRateLimited) {
                        throw new Error("Too many 2FA attempts. Try again in 15 minutes.");
                    }

                    const matchedEntry = user.backupCodes
                        ? matchRecoveryCode(user.backupCodes, token)
                        : undefined;

                    if (matchedEntry) {
                        const consumed = await consumeBackupCodeAtomically(user.id, matchedEntry);
                        if (!consumed) {
                            throw new Error("Invalid 2FA code");
                        }
                    } else {
                        if (!/^\d{6}$/.test(token)) {
                            throw new Error("Invalid 2FA code. Please enter a 6-digit code.");
                        }
                        if (!user.twoFactorSecret) {
                            throw new Error("Invalid 2FA code");
                        }

                        const plainSecret = decryptTotpSecret(user.twoFactorSecret);
                        const isValidTokenObj = verifySync({
                            token,
                            secret: plainSecret,
                        });

                        if (!isValidTokenObj.valid) {
                            throw new Error("Invalid 2FA code");
                        }

                        // Best-effort upgrade of legacy plaintext TOTP secret to AES-256-GCM at rest
                        if (!isEncryptedTotpSecret(user.twoFactorSecret)) {
                            void prisma.user
                                .update({
                                    where: { id: user.id },
                                    data: { twoFactorSecret: encryptTotpSecret(plainSecret) },
                                })
                                .catch(() => {});
                        }
                    }
                }

                return {
                    id: user.id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    pwv: computePasswordVersion(user.passwordHash),
                    mailRoutingBetaEnabled: Boolean(user.mailRoutingBetaEnabled),
                };
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60, // 7 days
    },
    pages: { signIn: "/login" },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                const authUser = user as AuthenticatedUser;
                token.role = authUser.role;
                token.id = authUser.id;
                token.pwv = authUser.pwv;
                token.mailRoutingBetaEnabled = Boolean(authUser.mailRoutingBetaEnabled);
                if (hasDatabaseUrl) {
                    try {
                        const settings = await prisma.siteSettings.findUnique({
                            where: { id: "default" },
                            select: {
                                mailRoutingBetaAvailable: true,
                                mailRoutingSelfOptIn: true,
                            },
                        });
                        token.mailRoutingBetaAvailable = settings?.mailRoutingBetaAvailable ?? true;
                        token.mailRoutingSelfOptIn = settings?.mailRoutingSelfOptIn ?? true;
                    } catch {
                        token.mailRoutingBetaAvailable = true;
                        token.mailRoutingSelfOptIn = true;
                    }
                } else {
                    token.mailRoutingBetaAvailable = false;
                    token.mailRoutingSelfOptIn = false;
                }
                token.revoked = false;
                return token;
            }

            if (token.revoked) {
                return { revoked: true };
            }

            const userId = typeof token.id === "string" ? token.id : undefined;

            if (hasDatabaseUrl && userId) {
                try {
                    const [dbUser, settings] = await Promise.all([
                        prisma.user.findUnique({
                            where: { id: userId },
                            select: {
                                role: true,
                                name: true,
                                email: true,
                                passwordHash: true,
                                emailVerified: true,
                                mailRoutingBetaEnabled: true,
                            },
                        }),
                        prisma.siteSettings.findUnique({
                            where: { id: "default" },
                            select: {
                                mailRoutingBetaAvailable: true,
                                mailRoutingSelfOptIn: true,
                            },
                        }),
                    ]);

                    const isUnverifiedContributor =
                        dbUser?.role === "CONTRIBUTOR" && !dbUser.emailVerified;
                    const passwordRotated =
                        Boolean(dbUser) &&
                        typeof token.pwv === "string" &&
                        computePasswordVersion(dbUser!.passwordHash) !== token.pwv;

                    if (!dbUser || isUnverifiedContributor || passwordRotated) {
                        delete token.role;
                        delete token.id;
                        delete token.email;
                        delete token.name;
                        delete token.pwv;
                        delete token.mailRoutingBetaEnabled;
                        delete token.mailRoutingBetaAvailable;
                        delete token.mailRoutingSelfOptIn;
                        token.revoked = true;
                    } else {
                        token.role = dbUser.role;
                        token.name = dbUser.name;
                        token.email = dbUser.email;
                        token.mailRoutingBetaEnabled = Boolean(dbUser.mailRoutingBetaEnabled);
                        token.mailRoutingBetaAvailable = settings?.mailRoutingBetaAvailable ?? true;
                        token.mailRoutingSelfOptIn = settings?.mailRoutingSelfOptIn ?? true;
                        if (typeof token.pwv !== "string") {
                            token.pwv = computePasswordVersion(dbUser.passwordHash);
                        }
                    }
                } catch {
                    // Fail closed for privileged sessions on DB error so revoked admins cannot retain access
                    if (
                        token.role === "SUPER_ADMIN" ||
                        token.role === "ADMIN" ||
                        token.role === "MODERATOR"
                    ) {
                        delete token.role;
                        delete token.id;
                        delete token.email;
                        delete token.name;
                        delete token.pwv;
                        delete token.mailRoutingBetaEnabled;
                        delete token.mailRoutingBetaAvailable;
                        delete token.mailRoutingSelfOptIn;
                        token.revoked = true;
                    }
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (token.revoked || !token.id || !token.role) {
                session.user = undefined;
                return session;
            }
            if (session.user) {
                const sessionUser = session.user as {
                    role?: unknown;
                    id?: unknown;
                    mailRoutingBetaEnabled?: unknown;
                    mailRoutingBetaAvailable?: unknown;
                    mailRoutingSelfOptIn?: unknown;
                };
                sessionUser.role = token.role;
                sessionUser.id = token.id;
                sessionUser.mailRoutingBetaEnabled = Boolean(token.mailRoutingBetaEnabled);
                sessionUser.mailRoutingBetaAvailable = token.mailRoutingBetaAvailable !== false;
                sessionUser.mailRoutingSelfOptIn = token.mailRoutingSelfOptIn !== false;
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
