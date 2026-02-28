import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/context/AuthContext";
import Navbar from "@/components/Navbar";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "SL Post Directory",
    description: "A comprehensive, modern directory for Sri Lanka Post Offices.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} min-h-screen flex flex-col antialiased bg-background`} suppressHydrationWarning>
                <AuthProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="dark"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <Navbar />
                        <main className="flex-1">
                            {children}
                        </main>
                        <footer className="border-t border-border/40 bg-card">
                            <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
                                <p>© {new Date().getFullYear()} SL Post Directory. Modern Edition.</p>
                            </div>
                        </footer>
                    </ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
