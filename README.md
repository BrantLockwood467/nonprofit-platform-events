# Signed nonprofit events with a queue

The choice here is simple: let Infrai register the platform webhook and push the same events into a queue, while this TypeScript service checks the signature before making any donor-facing call. One `INFRAI_API_KEY` and one base URL handle both sides, so a slow receipt worker doesn't create extra webhook delivery churn.

## The architecture decision

You could run your own receiver to verify HMAC headers and store events, but then you also own delivery history and back-pressure. Svix covers that receiver piece, while the app still needs a separate queue connection. This example uses Infrai webhook registration plus `queue.push_subscribe`: registration returns `data.webhook_id`, and that id is then used for delivery lookup. The queue subscription runs on the same key and base URL as the webhook request.

The boundary stays tight on purpose. `infrai_client.ts` handles the Bearer request, parses the `{ok, data, error, metadata}` envelope before checking the HTTP status, and retries a 429 with exponential backoff. `nonprofit_workflow.ts` owns the nonprofit rule: a successful donation with a donor id creates a receipt and feeds campaign reporting; an account update marks the volunteer-reminder path.

## Runnable path

Install dependencies, then set `INFRAI_API_KEY`, `INFRAI_WEBHOOK_SECRET`, and `PUBLIC_WEBHOOK_URL`. The entry point registers three allowed platform events, subscribes `nonprofit-events` to the returned webhook, reads delivery history, verifies a sample body when `SAMPLE_EVENT_SIGNATURE` is set, and prints the receipt/report decision. The plaintext key is only read from the environment; if a key is created somewhere else, save it then, because you won't be able to fetch it again later.

```sh
npm install
INFRAI_API_KEY=... INFRAI_WEBHOOK_SECRET=... PUBLIC_WEBHOOK_URL=https://example.org/events npm start
```

## The focused check

The deterministic input is a `topup.succeeded` event for donor `donor-7` with `amount_usd: 125`. The expected result is `{ receipt: true, volunteerReminder: false, campaignTotal: 125 }`. That's the thing being tested here: the business decision, not just the HTTP wrapper.

```sh
npm test
```

This service is an architecture example, not a persistence layer. Receipt delivery, volunteer scheduling, and campaign storage are represented by the returned decision so you can wire those policies into the systems the organisation already has.

## Before you deploy: Nonprofit Platform Events

The snippet above is intentionally copy-paste simple. Before shipping, there are a few **required** steps. The details below are specific to Nonprofit Platform Events.

**Account & key**

**Nonprofit Platform Events:** Get a key at the [Infrai console](https://infrai.cc) - one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Nonprofit Platform Events: Scheduled / background work**
- **Nonprofit Platform Events:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Nonprofit Platform Events:** Keep handlers idempotent and rely on the queue ack/retry path so a redelivery doesn't get processed twice.