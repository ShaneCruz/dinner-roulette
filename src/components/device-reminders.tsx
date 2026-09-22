"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type State = "checking" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The service worker that receives reminders (registered here if the app hasn't yet). */
async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("The app is still starting. Reload and try again.")), 10_000)),
  ]);
}

async function post(body: unknown) {
  const response = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "That didn't work.");
}

/**
 * Turns phone reminders on or off for this device and whoever is using it.
 * iPhones only allow this from the Home Screen app, so it explains that.
 */
export function DeviceReminders({ vapidKey, name }: { vapidKey: string | null; name: string }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      let next: State;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        next = ios && !standalone ? "ios-install" : "unsupported";
      } else if (Notification.permission === "denied") {
        next = "blocked";
      } else {
        const existing = await navigator.serviceWorker.getRegistration("/");
        next = existing && (await existing.pushManager.getSubscription()) ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    if (!vapidKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const worker = await registration();
      const subscription =
        (await worker.pushManager.getSubscription()) ??
        (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }));
      await post({ action: "subscribe", subscription: subscription.toJSON() });
      setState("on");
      await post({ action: "test" });
      setMessage("Sent a test reminder. It should pop up in a few seconds.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const worker = await navigator.serviceWorker.getRegistration("/");
      const subscription = await worker?.pushManager.getSubscription();
      if (subscription) {
        await post({ action: "unsubscribe", endpoint: subscription.endpoint }).catch(() => {});
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setMessage("Couldn't turn them off. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!vapidKey) return <p className="text-sm text-muted">Reminders aren&apos;t set up on the server yet.</p>;

  return (
    <div className="space-y-2">
      {state === "checking" ? <p className="text-sm text-muted">Checking this device…</p> : null}
      {state === "unsupported" ? <p className="text-sm text-muted">This browser can&apos;t show reminders. Try Chrome, or the Home Screen app on iPhone.</p> : null}
      {state === "ios-install" ? (
        <p className="rounded-2xl bg-mustard-soft p-3 text-sm">
          📱 On iPhone, reminders only work from the Home Screen app: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, open
          Dinner Roulette from there, and come back to this page.
        </p>
      ) : null}
      {state === "blocked" ? (
        <p className="text-sm text-muted">Notifications are blocked for this site. Turn them on in your phone&apos;s settings, then reload.</p>
      ) : null}
      {state === "off" ? (
        <Button type="button" onClick={turnOn} disabled={busy}>
          {busy ? "Turning on…" : `🔔 Send ${name}'s reminders to this phone`}
        </Button>
      ) : null}
      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-basil">🔔 Reminders are on for {name} on this phone.</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              try {
                await post({ action: "test" });
                setMessage("Sent! It should pop up in a few seconds.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "That didn't work.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Send a test
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={turnOff}>
            Turn off
          </Button>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}
