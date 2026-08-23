// Portex · service worker de los avisos.
// Muestra la alerta aunque la pantalla esté bloqueada: al residente cuando
// alguien lo espera en portería, y al conserje cuando un vecino pide acceso
// a la app desde el cartel del edificio.

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

  // Alguien esperando en la puerta no es lo mismo que un aviso de encomienda.
  // Para eso vibra más fuerte y más rato, y la alerta se queda en pantalla
  // hasta que la toquen.
  const urgente = data.requireInteraction === true;

  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "portex",
    renotify: true,
    requireInteraction: urgente,
    // El sonido de una notificación web lo elige el sistema operativo: no se
    // puede mandar un tono propio. La vibración sí es nuestra, y en un
    // teléfono en silencio —que es como anda medio mundo— es lo único que se
    // siente. El timbre de verdad lo toca la app al abrirse (lib/timbre.ts).
    vibrate: urgente
      ? [400, 150, 400, 150, 400, 150, 600]
      : [200, 100, 200],
    silent: false,
    data: { url: data.url || "/residente" },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // El punto rojo en el ícono, como cualquier app. Acá va sin número: el
      // service worker no sabe cuántas cosas hay esperando. Cuando la persona
      // abre Portex, la app lo reemplaza por la cuenta exacta y lo limpia al
      // resolverse. Sirve sobre todo cuando la notificación se deslizó sin
      // querer: el punto se queda igual.
      self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : Promise.resolve(),
      // Si la pantalla está abierta —la portería es un kiosco que no se
      // cierra nunca—, además de la alerta se le avisa a la página para que
      // traiga los datos nuevos sin que nadie tenga que recargar.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const client of list) client.postMessage({ tipo: "portex:push", url: options.data.url });
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/residente";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Cualquier ventana de Portex sirve para traerla al frente. Antes solo
      // se reconocían las del residente, así que al conserje le abría una
      // pestaña nueva encima de la portería que ya tenía abierta.
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
