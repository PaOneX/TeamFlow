import Pusher from "pusher";
import PusherClient from "pusher-js";

export const pusherServer =
  process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER || "ap2",
        useTLS: true,
      })
    : null;

export function getPusherClient() {
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return null;
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2",
    authEndpoint: "/api/pusher/auth",
  });
}

export async function triggerEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
) {
  if (!pusherServer) {
    console.log(`[PUSHER SKIPPED] ${channel}:${event}`);
    return;
  }
  await pusherServer.trigger(channel, event, data);
}
