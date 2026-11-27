"use client";

import * as React from "react";
import { Download, FileUp, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showNativeToast } from "@/components/shell/NativeToast";
import ConfirmDialog from "./ConfirmDialog";
import AdToggle from "@/app/[locale]/dashboard/AdToggle";
import MailRoutingBetaToggle from "@/app/[locale]/dashboard/MailRoutingBetaToggle";

export default function SystemToolsClient() {
    const [migrating, setMigrating] = React.useState(false);
    const [confirmMigrate, setConfirmMigrate] = React.useState(false);

    const handleMigrateMarkdown = async () => {
        setMigrating(true);
        try {
            const res = await fetch("/api/admin/blog/migrate", { method: "POST" });
            const data = (await res.json().catch(() => ({}))) as {
                migratedCount?: number;
                error?: string;
            };
            if (res.ok) {
                showNativeToast(`Migrated ${data.migratedCount ?? 0} markdown file(s)`);
                setConfirmMigrate(false);
            } else {
                showNativeToast(data.error || "Migration failed.");
            }
        } catch {
            showNativeToast("Network error during migration.");
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="space-y-5 max-w-3xl">
            <header>
                <p className="label-mono">Super Admin System</p>
                <h1 className="display text-3xl sm:text-4xl mt-1">System, Ads &amp; Backups</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Control sitewide ad display, download full JSON backups, and sync markdown archives.
                </p>
            </header>

            <AdToggle />

            <MailRoutingBetaToggle />

            <section className="rounded-md border-2 border-foreground bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-foreground bg-secondary/40 text-foreground">
                        <Database className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="font-heading text-base font-extrabold">Database JSON Snapshot</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Download all post offices and dynamic custom fields as a portable JSON backup.
                        </p>
                    </div>
                </div>
                <Button asChild className="h-11 font-bold shrink-0 gap-2">
                    <a href="/api/admin/backup" download>
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span>Download Backup</span>
                    </a>
                </Button>
            </section>

            <section className="rounded-md border-2 border-foreground bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-foreground">
                        <FileUp className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="font-heading text-base font-extrabold">Import Local Markdown Posts</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            One-time import of legacy markdown files from{" "}
                            <code className="font-mono">src/content/blog</code> into the database.
                        </p>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    disabled={migrating}
                    onClick={() => setConfirmMigrate(true)}
                    className="h-11 border-2 border-foreground font-bold shrink-0 gap-2"
                >
                    {migrating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <FileUp className="w-4 h-4" aria-hidden="true" />}
                    <span>Run Import</span>
                </Button>
            </section>

            <ConfirmDialog
                open={confirmMigrate}
                onOpenChange={setConfirmMigrate}
                title="Import Local Markdown Posts"
                description="Scan src/content/blog and insert any missing markdown guides into the BlogPost table?"
                confirmLabel="Import Missing Posts"
                loading={migrating}
                onConfirm={handleMigrateMarkdown}
            />
        </div>
    );
}
