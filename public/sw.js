// Portex · service worker del citófono.
// Su único trabajo: mostrar la alerta cuando alguien está en portería,
// aunque el residente tenga el teléfono bloqueado.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Chrome no ofrece instalar la app si el service worker no tiene un handler
// de fetch. No interceptamos nada —Portex necesita datos frescos, no una
// copia vieja de la portería—, pero el handler tiene que existir.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Portex", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Portex";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "portex",
    renotify: true,
    requireInteraction: data.requireInteraction === true,
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || "/residente" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/residente";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Si ya tiene Portex abierto, lo trae al frente en vez de abrir otra
      for (const client of list) {
        if (client.url.includes("/residente") && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
