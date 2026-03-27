export type TierName = 'free' | 'starter' | 'pro' | 'advanced' | 'enterprise';

export interface TierLimits {
    name: string;
    priceZAR: number | 'Custom';
    gatewayPlanId: string | null;
    maxSites: number;
    maxWidgets: number;
    maxCollectionsPerSite: number;
    maxStorageBytes: number;
    maxActionsPerMonth: number;
    allowAutoRecharge: boolean;
    maxKnowledgePages: number;
    allowedSiteType: 'single_page' | 'classic_cms' | 'ecommerce' | 'web_application' | 'headless';
    canRemoveWatermark: boolean;
    allowedSystemActions: string[];
    hasCustomKnowledgeCategories: boolean;
    hasOmniChannelEndpoints: boolean;
    hasVision: boolean;
    ingestionPriority: number;
}

export const TIER_LIMITS: Record<TierName, TierLimits> = {
    free: {
        name: 'Free',
        priceZAR: 0,
        gatewayPlanId: null,
        maxSites: 1,
        maxWidgets: 1,
        maxCollectionsPerSite: 1,
        maxStorageBytes: 5242880,        // 5 MB
        maxActionsPerMonth: 500,
        allowAutoRecharge: false,
        maxKnowledgePages: 50,
        allowedSiteType: 'single_page',
        canRemoveWatermark: false,
        allowedSystemActions: ['email_capture'],
        hasCustomKnowledgeCategories: false,
        hasOmniChannelEndpoints: false,
        hasVision: false,
        ingestionPriority: 1
    },
    starter: {
        name: 'Starter',
        priceZAR: 349,
        gatewayPlanId: 'PLN_starter_abc123',
        maxSites: 3,
        maxWidgets: 3,
        maxCollectionsPerSite: 6,
        maxStorageBytes: 52428800,       // 50 MB
        maxActionsPerMonth: 2000,
        allowAutoRecharge: true,
        maxKnowledgePages: 200,
        allowedSiteType: 'classic_cms',
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture'],
        hasCustomKnowledgeCategories: false,
        hasOmniChannelEndpoints: false,
        hasVision: false,
        ingestionPriority: 2
    },
    pro: {
        name: 'Pro',
        priceZAR: 699,
        gatewayPlanId: 'PLN_pro_def456',
        maxSites: 10,
        maxWidgets: 10,
        maxCollectionsPerSite: 15,
        maxStorageBytes: 209715200,      // 200 MB
        maxActionsPerMonth: 5000,
        allowAutoRecharge: true,
        maxKnowledgePages: 500,
        allowedSiteType: 'ecommerce',
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture', 'payment_gateway_hook'],
        hasCustomKnowledgeCategories: true,
        hasOmniChannelEndpoints: false,
        hasVision: false,
        ingestionPriority: 3
    },
    advanced: {
        name: 'Advanced',
        priceZAR: 1499,
        gatewayPlanId: 'PLN_advanced_xyz789',
        maxSites: 25,
        maxWidgets: 25,
        maxCollectionsPerSite: 40,
        maxStorageBytes: 1073741824,     // 1 GB
        maxActionsPerMonth: 20000,
        allowAutoRecharge: true,
        maxKnowledgePages: 2000,
        allowedSiteType: 'web_application',
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture', 'payment_gateway_hook', 'api_webhook'],
        hasCustomKnowledgeCategories: true,
        hasOmniChannelEndpoints: false,
        hasVision: true,
        ingestionPriority: 4
    },
    enterprise: {
        name: 'Enterprise',
        priceZAR: 'Custom',
        gatewayPlanId: 'custom',
        maxSites: 999,
        maxWidgets: 999,
        maxCollectionsPerSite: 999,
        maxStorageBytes: 5368709120,     // 5 GB+
        maxActionsPerMonth: 999999,
        allowAutoRecharge: true,
        maxKnowledgePages: 99999,
        allowedSiteType: 'headless',
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture', 'payment_gateway_hook', 'api_webhook', 'custom_middleware'],
        hasCustomKnowledgeCategories: true,
        hasOmniChannelEndpoints: true,
        hasVision: true,
        ingestionPriority: 5
    }
};

/**
 * Utility to check a specific limit for a user's tier
 */
export const getLimitsForTier = (tierName: string | undefined | null): TierLimits => {
    // Default to 'free' if something goes wrong or is undefined
    const safeTier = (tierName && TIER_LIMITS[tierName as TierName]) ? (tierName as TierName) : 'free';
    return TIER_LIMITS[safeTier];
};

/**
 * Global pricing configuration for the Auto-Recharge overage system.
 * When a tier has allowAutoRecharge: true and the user exceeds maxActionsPerMonth,
 * the system may charge this amount per actionPackSize additional actions.
 */
export const OVERAGE_CONFIG = {
    priceZAR: 99,
    actionPackSize: 1000,
} as const;
