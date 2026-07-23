import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    })
  : null;

export const STRIPE_PLANS = {
  PRO: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    name: "Pro",
    price: 29,
  },
  ENTERPRISE: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    name: "Enterprise",
    price: 99,
  },
} as const;
