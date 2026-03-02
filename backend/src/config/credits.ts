export const REQUEST_TYPES = [
  'TEXT_CHAT',
  'TEXT_SIMPLE',
  'AI_BROKER',
  'CODE_AGENT_EXECUTE',
  'FILE_OPERATION',
  'MCP_TOOL',
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

/**
 * Credits Pricing Configuration
 *
 * All prices are in credits.
 * 1 credit = R0.01 (1 cent)
 * 100 credits = R1.00
 *
 * Pricing is based on the type of request and complexity.
 */

export interface RequestPricing {
  baseCost: number;           // Base cost in credits
  perTokenCost?: number;      // Cost per token (for AI requests)
  perMultiplier?: number;     // Multiplier for certain conditions
}

/**
 * Request type pricing configuration
 */
export const REQUEST_PRICING: Record<RequestType, RequestPricing> = {
  // Text-based AI chat (more complex, uses more tokens)
  TEXT_CHAT: {
    baseCost: 10,             // R0.10 base cost
    perTokenCost: 0.01,       // R0.0001 per token (1000 tokens = R0.10)
  },

  // Simple text requests (less complex)
  TEXT_SIMPLE: {
    baseCost: 5,              // R0.05 base cost
    perTokenCost: 0.005,      // R0.00005 per token (1000 tokens = R0.05)
  },

  // External-provider proxying (minimal processing fee)
  AI_BROKER: {
    baseCost: 1,              // R0.01 per request
  },

  // Code agent execution (higher complexity and value)
  CODE_AGENT_EXECUTE: {
    baseCost: 20,             // R0.20 base cost
    perTokenCost: 0.02,       // R0.0002 per token
  },

  // File operations (lower cost, utility function)
  FILE_OPERATION: {
    baseCost: 1,              // R0.01 per operation
  },

  // MCP tool calls (varies by tool complexity)
  MCP_TOOL: {
    baseCost: 5,              // R0.05 base cost
    perMultiplier: 1.0,       // Can be adjusted based on tool complexity
  },
} as const;

/**
 * Calculate credit cost for a request
 */
export function calculateCreditCost(
  requestType: RequestType,
  metadata: {
    tokens?: number;
    complexityMultiplier?: number;
  } = {}
): number {
  const pricing = REQUEST_PRICING[requestType];
  let cost = pricing.baseCost;

  // Add token-based cost if applicable
  if (pricing.perTokenCost && metadata.tokens) {
    cost += metadata.tokens * pricing.perTokenCost;
  }

  // Apply complexity multiplier if specified
  if (pricing.perMultiplier && metadata.complexityMultiplier) {
    cost = Math.round(cost * metadata.complexityMultiplier);
  }

  return Math.max(1, cost); // Minimum 1 credit
}

/**
 * Credit package tiers for purchase
 */
export const CREDIT_PACKAGES = [
  {
    name: 'Starter',
    description: 'Perfect for trying out the service',
    credits: 1000,            // R10.00 worth
    price: 1000,              // R10.00 in cents
    bonusCredits: 0,
    featured: false,
  },
  {
    name: 'Standard',
    description: 'Best value for regular users',
    credits: 5000,            // R50.00 worth
    price: 4750,              // R47.50 (5% discount)
    bonusCredits: 250,        // R2.50 bonus
    featured: true,
  },
  {
    name: 'Professional',
    description: 'For power users and teams',
    credits: 10000,           // R100.00 worth
    price: 9000,              // R90.00 (10% discount)
    bonusCredits: 1000,       // R10.00 bonus
    featured: false,
  },
  {
    name: 'Business',
    description: 'Maximum value for businesses',
    credits: 25000,           // R250.00 worth
    price: 21250,             // R212.50 (15% discount)
    bonusCredits: 3750,       // R37.50 bonus
    featured: true,
  },
  {
    name: 'Enterprise',
    description: 'For large scale operations',
    credits: 100000,          // R1000.00 worth
    price: 75000,             // R750.00 (25% discount)
    bonusCredits: 25000,      // R250.00 bonus
    featured: false,
  },
] as const;

/**
 * Low balance thresholds (in credits)
 */
export const LOW_BALANCE_THRESHOLDS = {
  WARNING: 5000,       // R50.00 - Send warning email
  CRITICAL: 1000,      // R10.00 - Send critical alert
  EMPTY: 0,            // R0.00 - Service blocked
} as const;

/**
 * Bonus credits for new teams
 */
export const SIGNUP_BONUS_CREDITS = 100; // R1.00 free credit for new teams

/**
 * Referral bonus credits
 */
export const REFERRAL_BONUS_CREDITS = 500; // R5.00 for both referrer and referee

/**
 * Format credits to currency display
 */
export function creditsToZAR(credits: number): string {
  const rand = credits / 100;
  return `R${rand.toFixed(2)}`;
}

/**
 * Convert ZAR to credits
 */
export function zarToCredits(rand: number): number {
  return Math.round(rand * 100);
}
