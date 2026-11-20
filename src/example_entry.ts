import { InfraiClient, verifySignature } from "./infrai_client.ts";
import { decideDonationEvent, eventSchema } from "./nonprofit_workflow.ts";

const key = process.env.INFRAI_API_KEY;
const secret = process.env.INFRAI_WEBHOOK_SECRET;
const webhookUrl = process.env.PUBLIC_WEBHOOK_URL;
if (!key || !secret || !webhookUrl) throw new Error("Set INFRAI_API_KEY, INFRAI_WEBHOOK_SECRET, and PUBLIC_WEBHOOK_URL");

const infrai = new InfraiClient(key);
const registered = await infrai.registerWebhook(webhookUrl, secret);
const webhookId = registered.webhook_id;
if (!webhookId) throw new Error("Webhook registration did not return data.webhook_id");
await infrai.subscribeQueue("nonprofit-events", webhookUrl, secret);
const deliveryHistory = await infrai.deliveries(webhookId);

const rawBody = process.env.SAMPLE_EVENT_BODY ?? JSON.stringify({ type: "topup.succeeded", donor_id: "donor-7", amount_usd: 125, campaign: "winter" });
const signature = process.env.SAMPLE_EVENT_SIGNATURE ?? "";
if (signature && !verifySignature(rawBody, signature, secret)) throw new Error("Signature verification failed");
const event = eventSchema.parse(JSON.parse(rawBody));
console.log(JSON.stringify({ webhookId, deliveryHistory, decision: decideDonationEvent(event) }, null, 2));
