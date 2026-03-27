import api from '../services/api';

export interface EditablePackageLimits {
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
  ingestionPriority: number;
}

export interface AdminPackage {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  packageType: 'CONSUMER' | 'ENTERPRISE' | 'STAFF' | 'ADDON';
  priceMonthly: number;
  priceAnnually: number | null;
  featured: boolean;
  ctaText: string;
  isPublic: boolean;
  displayOrder: number;
  features: string[];
  limits: EditablePackageLimits;
  assignmentCount: number;
  raw: {
    max_users: number | null;
    max_agents: number | null;
    max_widgets: number | null;
    max_landing_pages: number | null;
    max_enterprise_endpoints: number | null;
    gateway_plan_id?: string | null;
    is_active: number;
  };
}

export interface PackageContactAssignment {
  contact_id: number;
  contact_name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_type: number;
  contact_package_id?: number | null;
  package_status?: string | null;
  billing_cycle?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  package_id?: number | null;
  package_slug?: string | null;
  package_name?: string | null;
  linked_user_emails?: string | null;
  linked_user_count?: number | null;
}

export interface PackagePayload {
  slug: string;
  name: string;
  description?: string | null;
  package_type: 'CONSUMER' | 'ENTERPRISE' | 'STAFF' | 'ADDON';
  price_monthly: number;
  price_annually?: number | null;
  max_users?: number | null;
  max_agents?: number | null;
  max_widgets?: number | null;
  max_landing_pages?: number | null;
  max_enterprise_endpoints?: number | null;
  features: string[];
  is_active: boolean;
  is_public: boolean;
  display_order: number;
  featured: boolean;
  cta_text: string;
  gateway_plan_id?: string | null;
  max_sites?: number | null;
  max_collections_per_site?: number | null;
  max_storage_bytes?: number | null;
  max_actions_per_month?: number | null;
  allow_auto_recharge: boolean;
  max_knowledge_pages?: number | null;
  allowed_site_type: EditablePackageLimits['allowedSiteType'];
  can_remove_watermark: boolean;
  allowed_system_actions: string[];
  has_custom_knowledge_categories: boolean;
  has_omni_channel_endpoints: boolean;
  ingestion_priority: number;
}

export class AdminPackagesModel {
  static async getAll(): Promise<AdminPackage[]> {
    const res = await api.get<{ success: boolean; packages: AdminPackage[] }>('/admin/packages');
    return res.data.packages || [];
  }

  static async getContacts(): Promise<PackageContactAssignment[]> {
    const res = await api.get<{ success: boolean; contacts: PackageContactAssignment[] }>('/admin/packages/contacts');
    return res.data.contacts || [];
  }

  static async create(payload: PackagePayload) {
    const res = await api.post('/admin/packages', payload);
    return res.data;
  }

  static async update(id: number, payload: PackagePayload) {
    const res = await api.put(`/admin/packages/${id}`, payload);
    return res.data;
  }

  static async assignContact(packageId: number, contactId: number, billingCycle: 'MONTHLY' | 'ANNUALLY' | 'NONE' = 'MONTHLY', status: 'ACTIVE' | 'TRIAL' = 'ACTIVE') {
    const res = await api.post(`/admin/packages/${packageId}/assign-contact`, {
      contactId,
      billingCycle,
      status,
    });
    return res.data;
  }
}
