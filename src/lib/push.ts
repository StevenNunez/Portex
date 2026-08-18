import "server-only";

import webpush from "web-push";
import { createServerClient } from "./supabase-server";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:portex@teolabs.app",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Envía la alerta a todos los dispositivos de esos residentes.
 * Las suscripciones muertas (410/404) se borran solas: si el residente
 * desinstaló la app, no tiene sentido guardarlas ni reintentar.
 */
export async function sendPushToProfiles(
  profileIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (profileIds.length === 0 || !configure()) return { sent: 0, failed: 0 };

  const db = createServerClient();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", profileIds);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
          { TTL: 120, urgency: "high" }
        );
        sent++;
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    })
  );

  if (dead.length > 0) {
    await db.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, failed };
}
