/** Sounds, vibration and notifications for cooking timers (browser only). */

// One shared audio context, created on the first "Start timer" tap.
let audioContext: AudioContext | null = null;

export function unlockAudio() {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
    // A silent blip fully unlocks audio on iOS.
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.05);
  } catch {
    // No audio on this device.
  }
}

export function beep() {
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    if (ctx.state === "suspended") void ctx.resume();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch {
    // Audio isn't available; the pulsing timer still shows it's done.
  }
}

export function askForNotifications() {
  try {
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  } catch {
    // Not supported (e.g. iPhone Safari outside the home-screen app).
  }
}

/** A system notification, for when the recipe isn't on screen. */
export function notify(step: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    const body = step.length > 90 ? `${step.slice(0, 87)}…` : step;
    const options = { body, tag: "dinner-timer", requireInteraction: true } as NotificationOptions;
    navigator.serviceWorker?.getRegistration().then((registration) => {
      if (registration) void registration.showNotification("⏰ Timer's done!", options);
      else new Notification("⏰ Timer's done!", options);
    });
  } catch {
    // Notifications aren't available; the beeping still happens.
  }
}
