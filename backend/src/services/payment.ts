import { db, type credit_packages, type Team, type User, type credit_transactions, generateId } from '../db/mysql.js';
import { getPayFastConfig, getYocoConfig } from './credentialVault.js';

/**
 * Payment Provider types
 */
type PaymentProvider = 'PAYFAST' | 'YOCO' | 'MANUAL';

/**
 * Payment Service
 *
 * Handles payment gateway integration for credit purchases.
 * Supports Yoco checkout API for South African payments.
 *
 * Yoco API Reference: https://developer.yoco.com/api-reference/checkout-api/checkout/create-checkout
 */

export interface PaymentRequest {
  teamId: string;
  packageId: string;
  provider: PaymentProvider;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentUrl?: string;
  paymentId?: string;
  error?: string;
}

/**
 * Create a payment intent for credit purchase
 */
export async function createPayment(
  request: PaymentRequest
): Promise<PaymentResponse> {
  // Get the credit package
  const creditPackage = await db.queryOne<credit_packages>(
    'SELECT * FROM credit_packages WHERE id = ?',
    [request.packageId]
  );

  if (!creditPackage) {
    return {
      success: false,
      error: 'Credit package not found',
    };
  }

  // Get team details with creator user
  const team = await db.queryOne<Team & { creatorEmail?: string }>(
    `SELECT t.*, u.email as creatorEmail FROM teams t 
     LEFT JOIN users u ON t.createdByUserId = u.id 
     WHERE t.id = ?`,
    [request.teamId]
  );

  if (!team) {
    return {
      success: false,
      error: 'Team not found',
    };
  }

  // Calculate total price in Rands (from cents)
  const amountInRand = creditPackage.price / 100;
  const totalCredits = creditPackage.credits + creditPackage.bonusCredits;

  switch (request.provider) {
    case 'PAYFAST':
      return createPayFastPayment({
        package: creditPackage,
        amountInRand,
        team,
        returnUrl: request.returnUrl,
        cancelUrl: request.cancelUrl,
      });

    case 'YOCO':
      return createYocoPayment({
        package: creditPackage,
        amountInRand,
        team,
        returnUrl: request.returnUrl,
        cancelUrl: request.cancelUrl,
      });

    case 'MANUAL':
      return {
        success: false,
        error: 'Manual payments must be processed by admin',
      };

    default:
      return {
        success: false,
        error: 'Unsupported payment provider',
      };
  }
}

/**
 * Process payment webhook/callback
 */
export async function processPaymentCallback(
  provider: PaymentProvider,
  payload: any,
  signature?: string
): Promise<{ success: boolean; creditsAdded?: number; error?: string }> {
  switch (provider) {
    case 'PAYFAST':
      return processPayFastCallback(payload);
    case 'YOCO':
      return processYocoCallback(payload, signature);
    default:
      return {
        success: false,
        error: 'Unsupported payment provider',
      };
  }
}

// ============================================
// PayFast Integration
// ============================================

interface PayFastPaymentRequest {
  package: credit_packages;
  amountInRand: number;
  team: Team & { creatorEmail?: string };
  returnUrl?: string;
  cancelUrl?: string;
}

async function createPayFastPayment(
  request: PayFastPaymentRequest
): Promise<PaymentResponse> {
  const pfConfig = await getPayFastConfig();
  const merchantId = pfConfig?.merchantId;
  const merchantKey = pfConfig?.merchantKey;

  if (!merchantId || !merchantKey) {
    return {
      success: false,
      error: 'PayFast not configured. Please contact admin.',
    };
  }

  // Generate payment ID
  const paymentId = `PF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Construct PayFast payment URL
  const paymentUrl = `https://payfast.co.za/eng/process?merchant_id=${merchantId}&merchant_key=${merchantKey}&amount=${request.amountInRand.toFixed(2)}&item_name=${encodeURIComponent(request.package.name + ' Credits')}&custom_int1=${request.team.id}`;

  console.log(`[PayFast] Payment initiated:`, {
    paymentId,
    amount: request.amountInRand,
    package: request.package.name,
    teamId: request.team.id,
  });

  return {
    success: true,
    paymentUrl,
    paymentId,
  };
}

async function processPayFastCallback(
  payload: any
): Promise<{ success: boolean; creditsAdded?: number; error?: string }> {
  const teamId = payload.custom_int1;
  const paymentStatus = payload.payment_status;
  const amountGross = parseFloat(payload.amount_gross);
  const pfPaymentId = payload.pf_payment_id;

  if (paymentStatus !== 'COMPLETE') {
    return {
      success: false,
      error: `Payment not complete. Status: ${paymentStatus}`,
    };
  }

  // Find the package that matches this amount
  const packages = await db.query<credit_packages>(
    'SELECT * FROM credit_packages WHERE isActive = 1'
  );

  const matchedPackage = packages.find(
    (pkg: credit_packages) => Math.abs(pkg.price / 100 - amountGross) < 0.01
  );

  if (!matchedPackage) {
    return {
      success: false,
      error: 'Could not match payment amount to a credit package',
    };
  }

  // Add credits to team
  const { addCredits } = await import('./credits.js');
  const totalCredits = matchedPackage.credits + matchedPackage.bonusCredits;

  await addCredits(teamId, totalCredits, 'PURCHASE', {
    description: `Purchased ${matchedPackage.name} package via PayFast`,
    paymentProvider: 'PAYFAST',
    externalPaymentId: pfPaymentId,
  });

  console.log(`[PayFast] Payment completed:`, {
    pfPaymentId,
    teamId,
    credits: totalCredits,
    amount: amountGross,
  });

  return {
    success: true,
    creditsAdded: totalCredits,
  };
}

// ============================================
// Yoco Checkout API Integration
// Reference: https://developer.yoco.com/api-reference/checkout-api/checkout/create-checkout
// ============================================

interface YocoPaymentRequest {
  package: credit_packages;
  amountInRand: number;
  team: Team & { creatorEmail?: string };
  returnUrl?: string;
  cancelUrl?: string;
}

interface YocoCheckoutRequest {
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, any>;
  success_url?: string;
  cancel_url?: string;
  // Optional fields
  name?: string;
  email?: string;
}

interface YocoCheckoutResponse {
  id: string;
  redirectUrl: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, any>;
  created_at: string;
}

async function createYocoPayment(request: YocoPaymentRequest): Promise<PaymentResponse> {
  const yocoConfig = await getYocoConfig();
  const secretKey = yocoConfig?.secretKey;

  if (!secretKey) {
    return {
      success: false,
      error: 'Yoco not configured. Please contact admin.',
    };
  }

  const amountInCents = Math.round(request.amountInRand * 100);
  const totalCredits = request.package.credits + request.package.bonusCredits;

  // Prepare Yoco checkout request
  const checkoutRequest: YocoCheckoutRequest = {
    amount: amountInCents,
    currency: 'ZAR',
    description: `${request.package.name} Credits (${totalCredits.toLocaleString()} credits)`,
    metadata: {
      teamId: request.team.id,
      packageId: request.package.id,
      teamName: request.team.name,
      credits: totalCredits,
      userId: request.team.createdByUserId,
    },
    success_url: request.returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:3001'}/portal/credits?success=true`,
    cancel_url: request.cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3001'}/portal/credits?cancelled=true`,
  };

  // Add user info if available
  if (request.team.creatorEmail) {
    checkoutRequest.email = request.team.creatorEmail;
    checkoutRequest.name = request.team.creatorEmail.split('@')[0];
  }

  try {
    // Call Yoco Checkout API
    const yocoResponse = await fetch('https://online.yoco.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Secret-Key': secretKey,
      },
      body: JSON.stringify(checkoutRequest),
    });

    if (!yocoResponse.ok) {
      const errorText = await yocoResponse.text();
      console.error('[Yoco] Checkout creation failed:', {
        status: yocoResponse.status,
        error: errorText,
      });
      return {
        success: false,
        error: `Yoco payment failed: ${yocoResponse.status} ${errorText}`,
      };
    }

    const checkout = await yocoResponse.json() as YocoCheckoutResponse;

    console.log('[Yoco] Checkout created successfully:', {
      checkoutId: checkout.id,
      amount: checkout.amount,
      redirectUrl: checkout.redirectUrl,
    });

    return {
      success: true,
      paymentUrl: checkout.redirectUrl,
      paymentId: checkout.id,
    };
  } catch (error) {
    console.error('[Yoco] Checkout request failed:', error);
    return {
      success: false,
      error: 'Failed to create Yoco checkout. Please try again.',
    };
  }
}

/**
 * Process Yoco webhook notification
 * Reference: https://developer.yoco.com/api-reference/webhooks/webhook-notifications
 */
async function processYocoCallback(
  payload: any,
  signature?: string
): Promise<{ success: boolean; creditsAdded?: number; error?: string }> {
  // Verify signature if provided
  const yocoConfig = await getYocoConfig();
  if (signature && yocoConfig?.webhookSecret) {
    const hmac = require('crypto')
      .createHmac('sha256', yocoConfig.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('base64');

    if (hmac !== signature) {
      console.error('[Yoco] Invalid webhook signature');
      return {
        success: false,
        error: 'Invalid signature',
      };
    }
  }

  const teamId = payload.metadata?.teamId;
  const packageId = payload.metadata?.packageId;
  const paymentStatus = payload.status;
  const amountInCents = payload.amount;
  const yocoCheckoutId = payload.id;

  // Only process successful payments
  if (paymentStatus !== 'successful' && paymentStatus !== 'paid') {
    return {
      success: false,
      error: `Payment not successful. Status: ${paymentStatus}`,
    };
  }

  if (!teamId || !packageId) {
    return {
      success: false,
      error: 'Missing required metadata (teamId, packageId)',
    };
  }

  // Get the package
  const creditPackage = await db.queryOne<credit_packages>(
    'SELECT * FROM credit_packages WHERE id = ?',
    [packageId]
  );

  if (!creditPackage) {
    return {
      success: false,
      error: 'Credit package not found',
    };
  }

  // Verify amount matches (allow small rounding differences)
  if (Math.abs(creditPackage.price - amountInCents) > 1) {
    console.error('[Yoco] Amount mismatch:', {
      expected: creditPackage.price,
      received: amountInCents,
    });
    return {
      success: false,
      error: 'Payment amount does not match package price',
    };
  }

  // Check if this payment has already been processed (idempotency)
  const existingTransaction = await db.queryOne<credit_transactions>(
    'SELECT * FROM credit_transactions WHERE externalPaymentId = ? LIMIT 1',
    [yocoCheckoutId]
  );

  if (existingTransaction) {
    console.log('[Yoco] Payment already processed, skipping');
    return {
      success: true,
      creditsAdded: 0,
    };
  }

  // Add credits to team
  const { addCredits } = await import('./credits.js');
  const totalCredits = creditPackage.credits + creditPackage.bonusCredits;

  await addCredits(teamId, totalCredits, 'PURCHASE', {
    description: `Purchased ${creditPackage.name} package via Yoco`,
    paymentProvider: 'YOCO',
    externalPaymentId: yocoCheckoutId,
  });

  console.log('[Yoco] Payment completed:', {
    yocoCheckoutId,
    teamId,
    credits: totalCredits,
    amount: amountInCents / 100,
  });

  return {
    success: true,
    creditsAdded: totalCredits,
  };
}

/**
 * Verify Yoco webhook signature
 */
export async function verifyYocoWebhookSignature(
  payload: any,
  signature: string
): Promise<boolean> {
  const yocoConfig = await getYocoConfig();
  if (!yocoConfig?.webhookSecret) {
    console.warn('[Yoco] Webhook secret not configured, skipping signature verification');
    return false;
  }

  try {
    const hmac = require('crypto')
      .createHmac('sha256', yocoConfig.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('base64');

    return hmac === signature;
  } catch (error) {
    console.error('[Yoco] Signature verification failed:', error);
    return false;
  }
}

/**
 * Verify payment webhook signature (for security)
 */
export async function verifyWebhookSignature(
  provider: PaymentProvider,
  payload: any,
  signature: string
): Promise<boolean> {
  switch (provider) {
    case 'PAYFAST':
      return verifyPayFastSignature(payload);

    case 'YOCO':
      return verifyYocoWebhookSignature(payload, signature);

    default:
      return false;
  }
}

/**
 * Verify PayFast ITN signature
 * Reference: https://developers.payfast.co.za/docs/#callback-security
 *
 * 1. Collect all POST params except "signature"
 * 2. URL-encode values, join with "&", append passphrase if configured
 * 3. MD5 hash the string → compare with the "signature" param
 */
async function verifyPayFastSignature(payload: Record<string, any>): Promise<boolean> {
  try {
    const pfConfig = await getPayFastConfig();
    const passphrase = pfConfig?.passphrase || '';

    // Build param string in the order received, excluding "signature"
    const paramString = Object.keys(payload)
      .filter((k) => k !== 'signature')
      .map((k) => `${k}=${encodeURIComponent(String(payload[k]).trim()).replace(/%20/g, '+')}`)
      .join('&');

    const withPassphrase = passphrase
      ? `${paramString}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
      : paramString;

    const expectedSig = require('crypto')
      .createHash('md5')
      .update(withPassphrase)
      .digest('hex');

    return expectedSig === payload.signature;
  } catch (err) {
    console.error('[PayFast] Signature verification error:', err);
    return false;
  }
}
