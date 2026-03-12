"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui/button";

export function InstallPrompt() {
  const [isReadyForInstall, setIsReadyForInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const hasDismissed = localStorage.getItem("pwa-install-dismissed");
    if (hasDismissed) {
      setIsDismissed(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsReadyForInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // If the app is already installed, don't show the prompt
    window.addEventListener("appinstalled", () => {
      setIsReadyForInstall(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsReadyForInstall(false);
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsReadyForInstall(false);
    setIsDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!isReadyForInstall || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[400px] z-50 bg-card border shadow-lg rounded-xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Download className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Install SL Post Directory</h3>
            <p className="text-xs text-muted-foreground">
              Add to your home screen for quick access and offline use.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 w-full mt-1">
        <Button
          variant="secondary"
          className="flex-1 h-9 text-xs"
          onClick={handleDismiss}
        >
          Not now
        </Button>
        <Button
          className="flex-1 h-9 text-xs"
          onClick={handleInstallClick}
        >
          Install App
        </Button>
      </div>
    </div>
  );
}
