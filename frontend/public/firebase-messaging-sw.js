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

// Build deep link URL based on notification type
function buildDeepLink(data) {
  const conversationId = data.conversationId || data.conversation_id;
  const type = data.type || '';

  // Chat messages & mentions → open conversation
  if (type === 'chat_message' || type === 'chat_mention') {
    return conversationId ? `/chat?c=${conversationId}` : '/chat';
  }

  // Incoming / missed calls → open conversation
  if (type === 'incoming_call' || type === 'missed_call') {
    return conversationId ? `/chat?c=${conversationId}` : '/chat';
  }

  // Scheduled call events → open conversation
  if (type.startsWith('scheduled_call')) {
    return conversationId ? `/chat?c=${conversationId}` : '/chat';
  }

  // Task notifications → tasks page
  if (type === 'task_assigned' || type.startsWith('task_')) {
    return '/tasks';
  }

  // Case notifications → case detail or cases list
  if (type.startsWith('case_')) {
    return data.action_url || data.link || '/cases';
  }

  // Explicit link or action_url in data
  if (data.link) return data.link;
  if (data.action_url) return data.action_url;

  // Default to notifications page
  return '/notifications';
}

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[Firebase SW] Background message received:', payload);

  const data = payload.data || {};
  const notificationTitle = payload.notification?.title || 'SoftAware';
  const type = data.type || '';

  // Determine notification category
  const isChatMessage = type === 'chat_message' || type === 'chat_mention';
  const isCall = type === 'incoming_call' || type === 'missed_call';
  const isScheduledCall = type.startsWith('scheduled_call');
  const conversationId = data.conversationId || data.conversation_id;

  // Build the deep link for this notification
  const deepLink = buildDeepLink(data);

  // Determine grouping tag
  let tag = type || 'default';
  if (isChatMessage) tag = `chat-${conversationId}`;
  else if (isCall) tag = `call-${conversationId}`;
  else if (isScheduledCall) tag = `sched-${conversationId}`;
  else if (type.startsWith('case_')) tag = `case-${data.caseId || 'general'}`;
  else if (type.startsWith('task_')) tag = `task-${data.task_id || 'general'}`;

  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: data.imageUrl || '/logo192.png',
    badge: '/logo192.png',
    data: {
      ...data,
      link: deepLink,
    },
    tag,
    renotify: isChatMessage || isCall, // Re-alert for new messages & calls
    silent: data.silent === 'true',
    actions: isChatMessage
      ? [
          { action: 'reply', title: 'Reply' },
          { action: 'mark_read', title: 'Mark as read' },
        ]
      : isCall
        ? [{ action: 'view', title: 'View' }]
        : [],
  };

  // High-urgency for calls — require interaction
  if (isCall) {
    notificationOptions.requireInteraction = true;
  }

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Handle action buttons
  if (action === 'mark_read') {
    // Just close the notification — app will sync unread on next open
    return;
  }

  // Build the URL to navigate to
  let urlToOpen = '/';
  if (data.link) {
    urlToOpen = data.link;
  } else if (data.action_url) {
    urlToOpen = data.action_url;
  } else if (data.type === 'chat_message' || data.type === 'chat_mention') {
    const convId = data.conversationId || data.conversation_id;
    if (convId) urlToOpen = `/chat?c=${convId}`;
  } else if (data.type === 'incoming_call' || data.type === 'missed_call') {
    const convId = data.conversationId || data.conversation_id;
    if (convId) urlToOpen = `/chat?c=${convId}`;
    else urlToOpen = '/chat';
  } else if (data.type && data.type.startsWith('scheduled_call')) {
    const convId = data.conversationId || data.conversation_id;
    if (convId) urlToOpen = `/chat?c=${convId}`;
    else urlToOpen = '/chat';
  } else if (data.type && data.type.startsWith('task_')) {
    urlToOpen = '/tasks';
  } else if (data.type && data.type.startsWith('case_')) {
    urlToOpen = data.action_url || '/cases';
  } else {
    urlToOpen = '/notifications';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          // Post message to the app to navigate to the chat
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            payload: {
              navigateTo: urlToOpen,
              conversationId: data.conversationId || data.conversation_id,
              messageId: data.messageId || data.message_id,
            },
          });
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
