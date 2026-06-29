import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

/**
 * Lazy Firebase JS SDK initializer.
 *
 * Phase 2 wires the config; Phase 3 starts using the Realtime Database for
 * live driver locations. If env vars are missing the helpers return `null`
 * so the rest of the app still loads (cleanly degraded experience).
 *
 * Required `frontend/.env` keys (matches Firebase console "web app" output):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_DATABASE_URL  ← must point to the **Realtime Database**, not Firestore
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_VAPID_KEY      ← Optional: Public VAPID key from Cloud Messaging tab
 */

const env = import.meta.env;

function buildFirebaseConfig() {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return { config, missing };
}

let appInstance = null;
let dbInstance = null;
let messagingInstance = null;
let warned = false;

function warnOnce(message) {
  if (warned) return;
  warned = true;
  console.warn(`[firebase] ${message}`);
}

/**
 * Returns the singleton Firebase app, or null when the config is incomplete.
 * Safe to call from any module-load context.
 */
export function getFirebaseApp() {
  if (appInstance) return appInstance;

  const { config, missing } = buildFirebaseConfig();
  if (missing.length) {
    warnOnce(
      `Firebase config incomplete (missing: ${missing.join(', ')}). ` +
        `Live driver location features will be disabled.`,
    );
    return null;
  }

  appInstance = getApps()[0] || initializeApp(config);
  return appInstance;
}

/**
 * Returns the singleton Realtime Database instance, or null when Firebase
 * is not configured. Subscribe to refs like:
 *
 *   import { ref, onValue } from 'firebase/database';
 *   const db = getRealtimeDb();
 *   if (db) onValue(ref(db, `drivers/${id}/location`), ...);
 */
export function getRealtimeDb() {
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  dbInstance = getDatabase(app);
  return dbInstance;
}

/**
 * Returns the singleton FCM Messaging instance, or null.
 */
export function getFcmMessaging() {
  if (messagingInstance) return messagingInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('[firebase] FCM not supported in this browser:', err.message);
    return null;
  }
}

/** True when Firebase is fully wired. Use for feature flagging UI. */
export function isFirebaseConfigured() {
  return getFirebaseApp() !== null;
}

/**
 * Requests FCM notification permissions and returns the FCM Device Registration Token.
 * Registers the background service worker with search parameters.
 */
export async function requestFcmToken() {
  const app = getFirebaseApp();
  if (!app) return null;

  const { config } = buildFirebaseConfig();
  const qs = new URLSearchParams({
    apiKey: config.apiKey || '',
    authDomain: config.authDomain || '',
    databaseURL: config.databaseURL || '',
    projectId: config.projectId || '',
    storageBucket: config.storageBucket || '',
    messagingSenderId: config.messagingSenderId || '',
    appId: config.appId || '',
  }).toString();

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${qs}`,
        { scope: '/' }
      );
      
      const messaging = getFcmMessaging();
      if (!messaging) return null;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[firebase] Notification permission not granted');
        return null;
      }

      const tokenOptions = { serviceWorkerRegistration: registration };
      if (env.VITE_FIREBASE_VAPID_KEY) {
        tokenOptions.vapidKey = env.VITE_FIREBASE_VAPID_KEY;
      }

      const token = await getToken(messaging, tokenOptions);
      return token;
    }
  } catch (err) {
    console.error('[firebase] Error retrieving FCM Token:', err);
  }
  return null;
}

/**
 * Expose onMessage listener for foreground messages.
 */
export function onFcmMessage(callback) {
  const messaging = getFcmMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
