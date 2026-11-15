"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet built on Radix Dialog.
 * On mobile it slides up from the bottom with a drag handle; on desktop it
 * becomes a centred panel so the same component can be reused.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

interface SheetContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
    title: string;
    description?: string;
    footer?: React.ReactNode;
}

export function SheetContent({ title, description, footer, className, children, ...props }: SheetContentProps) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
            <DialogPrimitive.Content
                className={cn(
                    "fixed z-[95] flex flex-col bg-background text-foreground outline-none",
                    // mobile: bottom sheet
                    "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t-2 border-foreground",
                    "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom duration-300",
                    // desktop: centred card
                    "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:max-h-[80vh] md:rounded-lg md:border-2",
                    "md:data-[state=open]:slide-in-from-bottom-4 md:data-[state=closed]:slide-out-to-bottom-4",
                    className
                )}
                {...props}
            >
                <div className="flex justify-center pt-2.5 md:hidden" aria-hidden="true">
                    <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
                </div>
                <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-3 border-b border-border">
                    <div>
                        <DialogPrimitive.Title className="font-heading text-xl font-extrabold [font-stretch:82%]">
                            {title}
                        </DialogPrimitive.Title>
                        {description ? (
                            <DialogPrimitive.Description className="text-sm text-muted-foreground mt-0.5">
                                {description}
                            </DialogPrimitive.Description>
                        ) : (
                            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
                        )}
                    </div>
                    <DialogPrimitive.Close
                        className="tap -mr-1 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </DialogPrimitive.Close>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
                {footer && (
                    <div className="border-t border-border px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        {footer}
                    </div>
                )}
                {!footer && <div className="pb-safe" />}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
}
