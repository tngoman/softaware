/**
 * Stripe routes — REMOVED
 * 
 * All payment processing now goes through Yoco.
 * This file is kept as a stub so existing imports don't break at startup.
 * Remove the import + mount in app.ts when convenient.
 */
import { Router } from 'express';

export const stripeRouter = Router();

stripeRouter.all('*', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Stripe is no longer supported. Please use the Yoco checkout endpoint at /api/v1/yoco/checkout.',
  });
});

