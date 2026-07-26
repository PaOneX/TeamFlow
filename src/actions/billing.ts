"use server";

import { db } from "@/lib/db";
import { stripe, STRIPE_PLANS } from "@/lib/stripe";
import { requireAuth, requireMembership } from "@/lib/session";
import { absoluteUrl } from "@/utils/helpers";
import type { ActionResult } from "@/types";

export async function createCheckoutSession(
  orgId: string,
  plan: "PRO" | "ENTERPRISE"
): Promise<ActionResult<{ url: string }>> {
  try {
    if (!stripe) {
      return { success: false, error: "Stripe is not configured" };
    }

    const session = await requireAuth();
    await requireMembership(orgId, session.user.id, ["OWNER", "ADMIN"]);

    const organization = await db.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });

    if (!organization) {
      return { success: false, error: "Organization not found" };
    }

    const planConfig = STRIPE_PLANS[plan];

    if (!planConfig.priceId) {
      return { success: false, error: "Stripe price not configured" };
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: organization.subscription?.stripeCustomerId ?? undefined,
      customer_email: organization.subscription?.stripeCustomerId
        ? undefined
        : session.user.email ?? undefined,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: absoluteUrl(`/settings/billing?success=true&orgId=${orgId}`),
      cancel_url: absoluteUrl(`/settings/billing?canceled=true&orgId=${orgId}`),
      metadata: {
        organizationId: orgId,
        plan,
      },
      subscription_data: {
        metadata: {
          organizationId: orgId,
          plan,
        },
      },
    });

    if (!checkoutSession.url) {
      return { success: false, error: "Failed to create checkout session" };
    }

    return { success: true, data: { url: checkoutSession.url } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Checkout failed",
    };
  }
}

export async function createBillingPortalSession(
  orgId: string
): Promise<ActionResult<{ url: string }>> {
  try {
    if (!stripe) {
      return { success: false, error: "Stripe is not configured" };
    }

    const session = await requireAuth();
    await requireMembership(orgId, session.user.id, ["OWNER", "ADMIN"]);

    const subscription = await db.subscription.findUnique({
      where: { organizationId: orgId },
    });

    if (!subscription?.stripeCustomerId) {
      return { success: false, error: "No billing account found" };
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: absoluteUrl(`/settings/billing?orgId=${orgId}`),
    });

    return { success: true, data: { url: portalSession.url } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Billing portal failed",
    };
  }
}
