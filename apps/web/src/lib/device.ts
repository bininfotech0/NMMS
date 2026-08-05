const DEVICE_ID_KEY = "nmms.deviceId";

// Stable per-browser identifier for field-registration audit (spec's
// "Device ID" field) — not a fingerprint, just a random id persisted locally.
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export interface GeolocationResult {
  latitude: number;
  longitude: number;
}

// Resolves to null rather than rejecting — GPS capture is best-effort, never
// a hard requirement to register a member (denied permission, no hardware,
// or a timeout should not block the field executive).
export function captureGeolocation(): Promise<GeolocationResult | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}
