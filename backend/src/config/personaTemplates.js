/**
 * Persona Templates — Dynamic Knowledge Checklists
 *
 * Instead of rigid boolean columns, each assistant stores a JSON checklist
 * tailored to its business type. When a user creates an assistant, the
 * system injects a default checklist based on their selection.
 *
 * Paid users can add custom checklist items.
 */
// ---------------------------------------------------------------------------
// Templates keyed by businessType (matches <select> values in CreateAssistant)
// ---------------------------------------------------------------------------
const TEMPLATES = {
    ecommerce: {
        id: 'ecommerce',
        name: 'E-commerce Store',
        description: 'Online shop selling products',
        checklist: [
            { key: 'pricing_info', label: 'Pricing / Product Prices', type: 'url' },
            { key: 'contact_details', label: 'Contact Details', type: 'url' },
            { key: 'products_catalog', label: 'Products / Catalog', type: 'url' },
            { key: 'return_policy', label: 'Return / Refund Policy', type: 'file' },
            { key: 'shipping_info', label: 'Shipping & Delivery Info', type: 'url' },
            { key: 'about_company', label: 'About / Company Info', type: 'url' },
        ],
    },
    service: {
        id: 'service',
        name: 'Service Business',
        description: 'Professional or local services',
        checklist: [
            { key: 'pricing_info', label: 'Pricing / Rates', type: 'url' },
            { key: 'contact_details', label: 'Contact Details', type: 'url' },
            { key: 'services_offered', label: 'Services Offered', type: 'url' },
            { key: 'about_company', label: 'About / Company Info', type: 'url' },
        ],
    },
    saas: {
        id: 'saas',
        name: 'SaaS / Software',
        description: 'Software product company',
        checklist: [
            { key: 'pricing_plans', label: 'Pricing / Plans', type: 'url' },
            { key: 'contact_details', label: 'Contact / Support', type: 'url' },
            { key: 'features', label: 'Features & Capabilities', type: 'url' },
            { key: 'integrations', label: 'Integrations / API Docs', type: 'url' },
            { key: 'about_team', label: 'About / Team', type: 'url' },
            { key: 'onboarding_docs', label: 'Onboarding / Getting Started', type: 'file' },
        ],
    },
    restaurant: {
        id: 'restaurant',
        name: 'Restaurant / Food',
        description: 'Restaurant, café, or food business',
        checklist: [
            { key: 'menu_prices', label: 'Menu & Prices', type: 'file' },
            { key: 'contact_hours', label: 'Contact & Opening Hours', type: 'url' },
            { key: 'location', label: 'Location / Directions', type: 'url' },
            { key: 'delivery_info', label: 'Delivery / Takeaway Info', type: 'url' },
            { key: 'about_restaurant', label: 'About / Story', type: 'url' },
        ],
    },
    healthcare: {
        id: 'healthcare',
        name: 'Healthcare',
        description: 'Medical practice or health service',
        checklist: [
            { key: 'services_offered', label: 'Medical Services', type: 'url' },
            { key: 'contact_details', label: 'Contact & Appointments', type: 'url' },
            { key: 'insurance_info', label: 'Insurance / Payment Info', type: 'file' },
            { key: 'practitioners', label: 'Practitioners / Doctors', type: 'url' },
            { key: 'about_practice', label: 'About the Practice', type: 'url' },
        ],
    },
    education: {
        id: 'education',
        name: 'Education',
        description: 'School, course provider, or educational institution',
        checklist: [
            { key: 'courses_programs', label: 'Courses / Programs', type: 'url' },
            { key: 'enrollment_info', label: 'Enrollment / Admissions', type: 'url' },
            { key: 'pricing_fees', label: 'Pricing / Fees', type: 'file' },
            { key: 'contact_details', label: 'Contact Details', type: 'url' },
            { key: 'about_institution', label: 'About the Institution', type: 'url' },
        ],
    },
    real_estate: {
        id: 'real_estate',
        name: 'Real Estate',
        description: 'Property agency or real estate firm',
        checklist: [
            { key: 'listings', label: 'Property Listings', type: 'url' },
            { key: 'contact_details', label: 'Contact / Agents', type: 'url' },
            { key: 'services_offered', label: 'Services Offered', type: 'url' },
            { key: 'area_info', label: 'Area / Neighbourhood Info', type: 'url' },
            { key: 'about_agency', label: 'About the Agency', type: 'url' },
        ],
    },
    // Fallback for "other" or empty
    other: {
        id: 'other',
        name: 'General Business',
        description: 'Default template for any business',
        checklist: [
            { key: 'pricing_info', label: 'Pricing Information', type: 'url' },
            { key: 'contact_details', label: 'Contact Details', type: 'url' },
            { key: 'services_products', label: 'Services / Products', type: 'url' },
            { key: 'about_company', label: 'About / Company Info', type: 'url' },
            { key: 'faq', label: 'FAQ / Common Questions', type: 'file' },
        ],
    },
};
// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------
/** Return a fresh checklist (all items satisfied = false) for the given business type */
export function getDefaultChecklist(businessType) {
    const template = TEMPLATES[businessType] || TEMPLATES.other;
    return template.checklist.map((item) => ({
        ...item,
        satisfied: false,
    }));
}
/** Get all available templates (for the frontend dropdown) */
export function getAllTemplates() {
    return Object.values(TEMPLATES);
}
/** Get a single template by id */
export function getTemplate(businessType) {
    return TEMPLATES[businessType] || TEMPLATES.other;
}
