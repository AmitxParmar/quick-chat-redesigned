"use strict";

self.addEventListener("install", function(event) {
  console.log("[Service Worker] Installing...");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function(event) {
  console.log("[Service Worker] Activating...");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function(event) {
  console.log("[Service Worker] Push Received.");
  if (!event.data) return;

  var data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "New Message", body: event.data.text() };
  }

  var title = data.title || "New Message";
  var options = {
    body: data.body || "You have a new message.",
    icon: data.icon || "/icon.png",
    badge: "/badge.png",
    vibrate: [100, 50, 100],
    data: { url: (data.data && data.data.url) || "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function(event) {
  console.log("[Service Worker] Notification click received.");
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(self.clients.openWindow(url));
});
