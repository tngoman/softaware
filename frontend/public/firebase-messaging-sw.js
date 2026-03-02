/* eslint-disable no-restricted-globals */

// Firebase Messaging Service Worker
// This runs in the background to handle push notifications when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCvMx3rJgu5QgRU3LezBQ6lU-aoK25KsOM',
  authDomain: 'soft-aware.firebaseapp.com',
  projectId: 'soft-aware',
  storageBucket: 'soft-aware.firebasestorage.app',
  messagingSenderId: '765240677597',
  appId: '1:765240677597:web:fbccb98c6de81af16fb734',
  measurementId: 'G-0L7CEN7RN9',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[Firebase SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'SoftAware';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: payload.data || {},
    tag: payload.data?.type || 'default',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const urlToOpen = data.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (data.link) {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Open new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
