"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { StampMark } from "./brand/StampLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "Add to home screen" card — stamp styling, sits above the mobile tab bar. */
export function InstallPrompt() {
  const t = useTranslations("Install");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!localStorage.getItem("pwa-install-dismissed")) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      }
    };
    const onInstalled = () => setDeferredPrompt(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!deferredPrompt || isDismissed) return null;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed left-3 right-3 bottom-tabbar mb-3 z-[70] md:left-auto md:right-6 md:mb-6 md:w-[380px] rounded-lg border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_0_hsl(var(--foreground))] animate-in slide-in-from-bottom-5 fade-in duration-300"
    >
      <div className="flex items-start gap-3">
        <StampMark size={40} />
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-base font-extrabold leading-tight [font-stretch:85%]">{t("title")}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("body")}</p>
        </div>
        <button onClick={dismiss} className="tap -mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("notNow")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={dismiss}>{t("notNow")}</Button>
        <Button className="flex-1" onClick={install}>{t("install")}</Button>
      </div>
    </div>
  );
}
