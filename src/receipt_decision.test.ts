import test from "node:test";
import assert from "node:assert/strict";
import { decideDonationEvent } from "./nonprofit_workflow.ts";

test("a successful donation creates a receipt and campaign total", () => {
  assert.deepEqual(decideDonationEvent({ type: "topup.succeeded", donor_id: "donor-7", amount_usd: 125, campaign: "winter" }), {
    receipt: true, volunteerReminder: false, campaignTotal: 125
  });
});
