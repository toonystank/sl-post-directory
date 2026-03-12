import { prisma } from "@/lib/prisma";
import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { verifySync } from "otplib";

// Constant-time backup code comparison to prevent timing attacks
function findBackupCode(codes: string[], candidate: string): string | undefined {
    let matchedCode: string | undefined;
    for (const code of codes) {
        if (code.length === candidate.length) {
            const a = Buffer.from(code, "utf8");
            const b = Buffer.from(candidate, "utf8");
            if (crypto.timingSafeEqual(a, b)) {
                matchedCode = code;
            }
        }
    }
    return matchedCode;
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
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) {
                    throw new Error("Invalid email or password");
                }

                if (user.role === "CONTRIBUTOR" && !user.emailVerified) {
                    throw new Error("Please verify your email address to log in. Check your inbox.");
                }

                const isValid = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                );

                if (!isValid) {
                    throw new Error("Invalid email or password");
                }

                if (user.twoFactorEnabled) {
                    const token = credentials.token?.trim();
                    if (!token || token === 'undefined') {
                        throw new Error("2FA_REQUIRED");
                    }

                    // Check if the token is a backup code (timing-safe)
                    const matchedBackupCode = user.backupCodes ? findBackupCode(user.backupCodes, token) : undefined;

                    if (matchedBackupCode) {
                        // Consume the backup code
                        await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                backupCodes: {
                                    set: user.backupCodes!.filter(c => c !== matchedBackupCode)
                                }
                            }
                        });
                    } else {
                        // Validate token format before calling verifySync
                        if (!/^\d{6}$/.test(token)) {
                            throw new Error("Invalid 2FA code. Please enter a 6-digit code.");
                        }
                        // Verify as a TOTP token
                        const isValidTokenObj = verifySync({
                            token,
                            secret: user.twoFactorSecret!
                        });

                        if (!isValidTokenObj.valid) {
                            throw new Error("Invalid 2FA code");
                        }
                    }
                }

                return {
                    id: user.id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role,
                };
            },
        }),
    ],
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
                (session.user as any).id = token.id;
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
