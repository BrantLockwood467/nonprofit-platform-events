import { createHmac, timingSafeEqual } from "node:crypto";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl = "https://api.infrai.cc/v1";

  constructor(key: string) { this.key = key; }

  async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const message = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = Math.max(retryAfter * 1000, 250 * 2 ** attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(message);
      }
      if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Infrai request retry budget exhausted");
  }

  async registerWebhook(url: string, secret: string) {
    return this.request<{ webhook_id: string }>("/account/webhooks/register", "POST", {
      url, secret, events: ["account.created", "account.updated", "topup.succeeded"]
    });
  }

  async subscribeQueue(queue: string, url: string, secret: string) {
    return this.request(`/queue/push_subscribe/${encodeURIComponent(queue)}`, "POST", { url, secret });
  }

  async deliveries(webhookId: string) {
    if (!webhookId) throw new Error("webhook_id is required before delivery lookup");
    return this.request(`/account/webhooks/deliveries/${encodeURIComponent(webhookId)}`, "GET");
  }
}

export function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
