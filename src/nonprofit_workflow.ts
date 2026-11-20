import { z } from "zod";

export const eventSchema = z.object({
  type: z.string(),
  donor_id: z.string().optional(),
  amount_usd: z.number().nonnegative().optional(),
  campaign: z.string().optional()
});

export type PlatformEvent = z.infer<typeof eventSchema>;

export function decideDonationEvent(event: PlatformEvent): { receipt: boolean; volunteerReminder: boolean; campaignTotal: number } {
  const parsed = eventSchema.parse(event);
  const donation = parsed.type === "topup.succeeded" && parsed.amount_usd !== undefined;
  return {
    receipt: donation && Boolean(parsed.donor_id),
    volunteerReminder: parsed.type === "account.updated",
    campaignTotal: donation ? parsed.amount_usd ?? 0 : 0
  };
}
