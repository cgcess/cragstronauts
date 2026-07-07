// Browser-side Web Push: subscribe a device and hand the subscription to the
// API, or tear it down. The heavy lifting (encryption, VAPID, delivery) is the
// server's; here we only manage the browser PushSubscription and POST/DELETE it.
import { api } from "../api";
import type { NotificationScope } from "@cragstronauts/contract";

export type { NotificationScope };

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

/**
 * Decode a base64url VAPID public key into the Uint8Array
 * `pushManager.subscribe` wants as `applicationServerKey`. Pure — unit-tested.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Back the view with a concrete ArrayBuffer so it satisfies BufferSource
  // (applicationServerKey) under the newer TS lib's typed-array generics.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** True when this browser can subscribe and we have a public key to use. */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window &&
    VAPID_PUBLIC_KEY.length > 0
  );
}

/** Current Notification permission, or "denied" where the API is absent. */
export function pushPermission(): NotificationPermission {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

/**
 * Whether this device is actively subscribed: permission granted *and* a live
 * browser PushSubscription. Used to seed the profile toggle's on/off state.
 */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || pushPermission() !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) !== null;
}

/**
 * Ask permission (must run inside a user gesture — iOS especially), subscribe
 * this device with the VAPID public key, and register it for the signed-in
 * account. Returns true when a subscription was saved. Reuses an existing
 * browser subscription if one is already present.
 */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await api.pushSubscribe({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return true;
}

/** Unsubscribe this device and drop it server-side. Best-effort. */
export async function disablePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api.pushUnsubscribe(endpoint);
}

/**
 * The account's notification scope. Account-wide (not per device), so it's read
 * from the server rather than the browser. Defaults to "always" server-side.
 */
export async function getNotificationScope(): Promise<NotificationScope> {
  const { scope } = await api.getNotificationSettings();
  return scope;
}

/** Persist the account's notification scope. */
export async function setNotificationScope(scope: NotificationScope): Promise<void> {
  await api.setNotificationSettings(scope);
}
