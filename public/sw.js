self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "新しいメッセージ";
  const options = {
    body: data.body || "メッセージが届きました",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    tag: "message-notification",
    requireInteraction: false,
    data: data.url ? { url: data.url } : {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
