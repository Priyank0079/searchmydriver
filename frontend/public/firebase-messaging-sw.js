// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in query params.
// This allows us to load configurations dynamically from the frontend.
const urlParams = new URLSearchParams(self.location.search);
const apiKey = urlParams.get('apiKey');
const authDomain = urlParams.get('authDomain');
const databaseURL = urlParams.get('databaseURL');
const projectId = urlParams.get('projectId');
const storageBucket = urlParams.get('storageBucket');
const messagingSenderId = urlParams.get('messagingSenderId');
const appId = urlParams.get('appId');

if (messagingSenderId && apiKey && projectId) {
  firebase.initializeApp({
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket,
    messagingSenderId,
    appId
  });

  if (firebase.messaging.isSupported()) {
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      const notificationTitle = payload.notification?.title || 'SearchMyDriver';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/favicon.svg',
        data: payload.data || {}
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } else {
    console.warn('[firebase-messaging-sw.js] Messaging is not supported in this environment');
  }
} else {
  console.warn('[firebase-messaging-sw.js] Incomplete config params passed to SW');
}
