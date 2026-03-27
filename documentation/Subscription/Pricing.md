// config/tiers.js

export const TIER_LIMITS = {
    free: {
        name: "Free",
        priceZAR: 0,
        gatewayPlanId: null,           // No billing required
        maxSites: 1,                   // For the user to test the platform
        maxWidgets: 1,                 // 1 standalone AI widget
        maxCollectionsPerSite: 1,      // Just enough for a contact form/leads
        maxStorageBytes: 5242880,      // 5 MB
        maxActionsPerMonth: 500,       // Swapped from 'Messages' to 'Actions'
        allowAutoRecharge: false,      // Hard cap. No overage billing allowed.
        maxKnowledgePages: 50,
        allowedSiteType: 'single_page', 
        canRemoveWatermark: false,
        allowedSystemActions: ['email_capture'], // Note: Renamed to avoid clashing with billing 'Actions'
        hasCustomKnowledgeCategories: false,
        hasOmniChannelEndpoints: false,
        ingestionPriority: 1 
    },
    starter: {
        name: "Starter",
        priceZAR: 349,
        gatewayPlanId: "PLN_starter_abc123", // Replace with your Yoco/Paystack ID
        maxSites: 3,                   // Perfect for a new freelancer
        maxWidgets: 3,
        maxCollectionsPerSite: 6,      // Enough for the "Classic CMS"
        maxStorageBytes: 52428800,     // 50 MB
        maxActionsPerMonth: 2000,
        allowAutoRecharge: true,       // Unlocks R99 per 1000 extra actions
        maxKnowledgePages: 200,
        allowedSiteType: 'classic_cms', 
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture'],
        hasCustomKnowledgeCategories: false,
        hasOmniChannelEndpoints: false,
        ingestionPriority: 2 
    },
    pro: {
        name: "Pro",
        priceZAR: 699,
        gatewayPlanId: "PLN_pro_def456", 
        maxSites: 10,                  // Growing agency
        maxWidgets: 10,
        maxCollectionsPerSite: 15,     // Unlocks E-commerce
        maxStorageBytes: 209715200,    // 200 MB
        maxActionsPerMonth: 5000,
        allowAutoRecharge: true,
        maxKnowledgePages: 500,
        allowedSiteType: 'ecommerce',  // Transactional logic
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture', 'payment_gateway_hook'], 
        hasCustomKnowledgeCategories: true,
        hasOmniChannelEndpoints: false,
        ingestionPriority: 3 
    },
    advanced: {
        name: "Advanced",
        priceZAR: 1499,
        gatewayPlanId: "PLN_advanced_xyz789", 
        maxSites: 25,                  // Established agency hosting multiple clients
        maxWidgets: 25,
        maxCollectionsPerSite: 40,     // Full Web App limits
        maxStorageBytes: 1073741824,   // 1 GB
        maxActionsPerMonth: 20000,
        allowAutoRecharge: true,
        maxKnowledgePages: 2000,
        allowedSiteType: 'web_application',
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture', 'payment_gateway_hook', 'api_webhook'], 
        hasCustomKnowledgeCategories: true, 
        hasOmniChannelEndpoints: false,
        ingestionPriority: 4 
    },
    enterprise: {
        name: "Enterprise",
        priceZAR: "Custom",
        gatewayPlanId: "custom", 
        maxSites: 999,
        maxWidgets: 999,
        maxCollectionsPerSite: 999,
        maxStorageBytes: 5368709120,   // 5 GB+
        maxActionsPerMonth: 999999,
        allowAutoRecharge: true,
        maxKnowledgePages: 99999,
        allowedSiteType: 'headless',
        canRemoveWatermark: true,
        allowedSystemActions: ['email_capture', 'payment_gateway_hook', 'api_webhook', 'custom_middleware'],
        hasCustomKnowledgeCategories: true,
        hasOmniChannelEndpoints: true, 
        ingestionPriority: 5 
    }
};

// Global pricing configuration for the Auto-Recharge system
export const OVERAGE_CONFIG = {
    priceZAR: 99,
    actionPackSize: 1000
};
 