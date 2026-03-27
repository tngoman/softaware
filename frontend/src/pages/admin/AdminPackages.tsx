import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CubeIcon,
  LinkIcon,
  PlusIcon,
  Squares2X2Icon,
  UserGroupIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  EyeSlashIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import {
  AdminPackagesModel,
  type AdminPackage,
  type PackagePayload,
  type PackageContactAssignment,
} from '../../models/AdminPackagesModel';

/* ─── helpers ─────────────────────────────────────────────────────── */
const bytesToMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;
const mbToBytes = (mb: number) => Math.round(mb * 1024 * 1024);
const moneyFromCents = (cents: number) => (cents / 100).toFixed(2);
const centsFromMoney = (value: string) => Math.round((parseFloat(value || '0') || 0) * 100);
const fmtStorage = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${bytesToMb(bytes)} MB`;
};

const siteTypeOptions = [
  { value: 'single_page', label: 'Single Page' },
  { value: 'classic_cms', label: 'Classic CMS' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'web_application', label: 'Web Application' },
  { value: 'headless', label: 'Headless' },
] as const;

const packageTypeColors: Record<string, string> = {
  CONSUMER: 'bg-sky-100 text-sky-700',
  ENTERPRISE: 'bg-violet-100 text-violet-700',
  STAFF: 'bg-amber-100 text-amber-700',
  ADDON: 'bg-emerald-100 text-emerald-700',
};

/* ─── payload builder ─────────────────────────────────────────────── */
function toPayload(pkg: AdminPackage, draft?: any): PackagePayload {
  const s = draft || {};
  const monthly = s.priceMonthly ?? moneyFromCents(pkg.priceMonthly);
  const annually = s.priceAnnually ?? (pkg.priceAnnually ? moneyFromCents(pkg.priceAnnually) : '');

  return {
    slug: s.slug ?? pkg.slug,
    name: s.name ?? pkg.name,
    description: s.description ?? pkg.description,
    package_type: s.packageType ?? pkg.packageType,
    price_monthly: centsFromMoney(String(monthly)),
    price_annually: annually === '' ? null : centsFromMoney(String(annually)),
    max_users: Number(s.maxUsers ?? pkg.raw.max_users ?? 0),
    max_agents: Number(s.maxAgents ?? pkg.raw.max_agents ?? pkg.limits.maxWidgets),
    max_widgets: Number(s.maxWidgets ?? pkg.raw.max_widgets ?? pkg.limits.maxWidgets),
    max_landing_pages: Number(s.maxLandingPages ?? pkg.raw.max_landing_pages ?? pkg.limits.maxSites),
    max_enterprise_endpoints: Number(s.maxEnterpriseEndpoints ?? pkg.raw.max_enterprise_endpoints ?? 0),
    features: String(s.features ?? pkg.features.join('\n')).split('\n').map((i) => i.trim()).filter(Boolean),
    is_active: Boolean(s.isActive ?? Boolean(pkg.raw.is_active)),
    is_public: Boolean(s.isPublic ?? pkg.isPublic),
    display_order: Number(s.displayOrder ?? pkg.displayOrder),
    featured: Boolean(s.featured ?? pkg.featured),
    cta_text: s.ctaText ?? pkg.ctaText,
    gateway_plan_id: s.gatewayPlanId ?? pkg.raw.gateway_plan_id ?? null,
    max_sites: Number(s.maxSites ?? pkg.limits.maxSites),
    max_collections_per_site: Number(s.maxCollectionsPerSite ?? pkg.limits.maxCollectionsPerSite),
    max_storage_bytes: mbToBytes(Number(s.maxStorageMb ?? bytesToMb(pkg.limits.maxStorageBytes))),
    max_actions_per_month: Number(s.maxActionsPerMonth ?? pkg.limits.maxActionsPerMonth),
    allow_auto_recharge: Boolean(s.allowAutoRecharge ?? pkg.limits.allowAutoRecharge),
    max_knowledge_pages: Number(s.maxKnowledgePages ?? pkg.limits.maxKnowledgePages),
    allowed_site_type: s.allowedSiteType ?? pkg.limits.allowedSiteType,
    can_remove_watermark: Boolean(s.canRemoveWatermark ?? pkg.limits.canRemoveWatermark),
    allowed_system_actions: String(s.allowedSystemActions ?? pkg.limits.allowedSystemActions.join(', ')).split(',').map((i) => i.trim()).filter(Boolean),
    has_custom_knowledge_categories: Boolean(s.hasCustomKnowledgeCategories ?? pkg.limits.hasCustomKnowledgeCategories),
    has_omni_channel_endpoints: Boolean(s.hasOmniChannelEndpoints ?? pkg.limits.hasOmniChannelEndpoints),
    ingestion_priority: Number(s.ingestionPriority ?? pkg.limits.ingestionPriority),
  };
}

const blankNewPackage = {
  slug: '',
  name: '',
  description: '',
  packageType: 'CONSUMER',
  priceMonthly: '0.00',
  priceAnnually: '',
  maxUsers: 1,
  maxAgents: 1,
  maxWidgets: 1,
  maxLandingPages: 1,
  maxEnterpriseEndpoints: 0,
  features: '',
  isActive: true,
  isPublic: true,
  displayOrder: 0,
  featured: false,
  ctaText: 'Get Started',
  gatewayPlanId: '',
  maxSites: 1,
  maxCollectionsPerSite: 1,
  maxStorageMb: 5,
  maxActionsPerMonth: 500,
  allowAutoRecharge: false,
  maxKnowledgePages: 50,
  allowedSiteType: 'single_page',
  canRemoveWatermark: false,
  allowedSystemActions: 'email_capture',
  hasCustomKnowledgeCategories: false,
  hasOmniChannelEndpoints: false,
  ingestionPriority: 1,
};

/* ─── tab definitions ─────────────────────────────────────────────── */
type TabKey = 'packages' | 'assignments' | 'create';

const tabDefs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'packages', label: 'Packages', icon: <Squares2X2Icon className="h-4 w-4" /> },
  { key: 'assignments', label: 'Client Assignments', icon: <UserGroupIcon className="h-4 w-4" /> },
  { key: 'create', label: 'Create Package', icon: <PlusIcon className="h-4 w-4" /> },
];

/* ═══════════════════════════════════════════════════════════════════
   Shared UI atoms
   ═══════════════════════════════════════════════════════════════════ */
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{children}</span>
);

const Field: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, className: _cls, ...props }) => (
  <div>
    <Label>{label}</Label>
    <input {...props} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition" />
  </div>
);

const SelectField: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }
> = ({ label, options, className: _cls, ...props }) => (
  <div>
    <Label>{label}</Label>
    <select {...props} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition">
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm cursor-pointer hover:border-picton-blue/30 transition select-none">
    <span
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${checked ? 'bg-picton-blue' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </span>
    <span className="text-slate-700">{label}</span>
  </label>
);

const StatBadge: React.FC<{ label: string; value: string | number; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`rounded-lg px-3 py-2 text-center ${accent ? 'bg-picton-blue/10' : 'bg-slate-50'}`}>
    <div className={`text-lg font-bold ${accent ? 'text-picton-blue' : 'text-slate-900'}`}>{value}</div>
    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   PACKAGES TAB
   ═══════════════════════════════════════════════════════════════════ */
const PackagesTab: React.FC<{
  packages: AdminPackage[];
  drafts: Record<number, any>;
  savingId: number | null;
  onDraft: (id: number, field: string, value: any) => void;
  onSave: (pkg: AdminPackage) => void;
}> = ({ packages, drafts, savingId, onDraft, onSave }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const filtered = useMemo(() => {
    let list = packages;
    if (typeFilter !== 'ALL') list = list.filter((p) => p.packageType === typeFilter);
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
    }
    return list;
  }, [packages, filter, typeFilter]);

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
            placeholder="Search packages…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-w-[160px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">All Types</option>
          <option value="CONSUMER">Consumer</option>
          <option value="ENTERPRISE">Enterprise</option>
          <option value="STAFF">Staff</option>
          <option value="ADDON">Add-on</option>
        </select>
      </div>

      {/* summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBadge label="Total" value={packages.length} accent />
        <StatBadge label="Active" value={packages.filter((p) => p.raw.is_active).length} />
        <StatBadge label="Public" value={packages.filter((p) => p.isPublic).length} />
        <StatBadge label="Featured" value={packages.filter((p) => p.featured).length} />
      </div>

      {/* package cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
          No packages match your criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((pkg) => {
            const draft = drafts[pkg.id] || {};
            const isExpanded = expandedId === pkg.id;
            const isDirty = Object.keys(draft).length > 0;

            return (
              <div
                key={pkg.id}
                className={`rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${isDirty ? 'border-picton-blue/40 ring-1 ring-picton-blue/10' : 'border-slate-200'}`}
              >
                {/* collapsed header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-900 truncate">{pkg.name}</h3>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${packageTypeColors[pkg.packageType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {pkg.packageType}
                      </span>
                      {pkg.featured && <StarIconSolid className="h-4 w-4 text-amber-400" title="Featured" />}
                      {pkg.isPublic ? (
                        <EyeIcon className="h-4 w-4 text-emerald-500" title="Public" />
                      ) : (
                        <EyeSlashIcon className="h-4 w-4 text-slate-400" title="Hidden" />
                      )}
                      {!pkg.raw.is_active && (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">Inactive</span>
                      )}
                      {isDirty && (
                        <span className="inline-flex rounded-full bg-picton-blue/10 px-2 py-0.5 text-[11px] font-bold text-picton-blue">Unsaved</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {pkg.slug} &middot; R{moneyFromCents(pkg.priceMonthly)}/mo
                      {pkg.priceAnnually ? ` · R${moneyFromCents(pkg.priceAnnually)}/yr` : ''}
                      {' · '}{pkg.assignmentCount} linked
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 shrink-0">
                    <span title="Sites">{pkg.limits.maxSites} sites</span>
                    <span className="text-slate-300">|</span>
                    <span title="Widgets">{pkg.limits.maxWidgets} widgets</span>
                    <span className="text-slate-300">|</span>
                    <span title="Storage">{fmtStorage(pkg.limits.maxStorageBytes)}</span>
                  </div>

                  {isExpanded ? (
                    <ChevronUpIcon className="h-5 w-5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-slate-400 shrink-0" />
                  )}
                </button>

                {/* expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5">
                    {/* identity */}
                    <fieldset>
                      <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                        <CubeIcon className="h-3.5 w-3.5" /> Identity &amp; Pricing
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <Field label="Slug" value={draft.slug ?? pkg.slug} onChange={(e) => onDraft(pkg.id, 'slug', e.target.value)} />
                        <Field label="Name" value={draft.name ?? pkg.name} onChange={(e) => onDraft(pkg.id, 'name', e.target.value)} />
                        <Field label="CTA Text" value={draft.ctaText ?? pkg.ctaText} onChange={(e) => onDraft(pkg.id, 'ctaText', e.target.value)} />
                        <SelectField
                          label="Type"
                          value={draft.packageType ?? pkg.packageType}
                          onChange={(e) => onDraft(pkg.id, 'packageType', e.target.value)}
                          options={[
                            { value: 'CONSUMER', label: 'Consumer' },
                            { value: 'ENTERPRISE', label: 'Enterprise' },
                            { value: 'STAFF', label: 'Staff' },
                            { value: 'ADDON', label: 'Add-on' },
                          ]}
                        />
                        <Field label="Monthly Price (R)" value={draft.priceMonthly ?? moneyFromCents(pkg.priceMonthly)} onChange={(e) => onDraft(pkg.id, 'priceMonthly', e.target.value)} />
                        <Field label="Annual Price (R)" value={draft.priceAnnually ?? (pkg.priceAnnually ? moneyFromCents(pkg.priceAnnually) : '')} onChange={(e) => onDraft(pkg.id, 'priceAnnually', e.target.value)} placeholder="Leave empty if N/A" />
                        <Field label="Display Order" type="number" value={draft.displayOrder ?? pkg.displayOrder} onChange={(e) => onDraft(pkg.id, 'displayOrder', Number(e.target.value))} />
                        <Field label="Gateway Plan ID" value={draft.gatewayPlanId ?? pkg.raw.gateway_plan_id ?? ''} onChange={(e) => onDraft(pkg.id, 'gatewayPlanId', e.target.value)} placeholder="Optional" />
                      </div>
                    </fieldset>

                    {/* limits */}
                    <fieldset>
                      <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                        <BoltIcon className="h-3.5 w-3.5" /> Limits &amp; Quotas
                      </legend>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                        <Field label="Max Sites" type="number" value={draft.maxSites ?? pkg.limits.maxSites} onChange={(e) => onDraft(pkg.id, 'maxSites', Number(e.target.value))} />
                        <Field label="Max Widgets" type="number" value={draft.maxWidgets ?? pkg.limits.maxWidgets} onChange={(e) => onDraft(pkg.id, 'maxWidgets', Number(e.target.value))} />
                        <Field label="Collections / Site" type="number" value={draft.maxCollectionsPerSite ?? pkg.limits.maxCollectionsPerSite} onChange={(e) => onDraft(pkg.id, 'maxCollectionsPerSite', Number(e.target.value))} />
                        <Field label="Knowledge Pages" type="number" value={draft.maxKnowledgePages ?? pkg.limits.maxKnowledgePages} onChange={(e) => onDraft(pkg.id, 'maxKnowledgePages', Number(e.target.value))} />
                        <Field label="Storage (MB)" type="number" value={draft.maxStorageMb ?? bytesToMb(pkg.limits.maxStorageBytes)} onChange={(e) => onDraft(pkg.id, 'maxStorageMb', Number(e.target.value))} />
                        <Field label="Actions / Month" type="number" value={draft.maxActionsPerMonth ?? pkg.limits.maxActionsPerMonth} onChange={(e) => onDraft(pkg.id, 'maxActionsPerMonth', Number(e.target.value))} />
                        <Field label="Max Users" type="number" value={draft.maxUsers ?? pkg.raw.max_users ?? 0} onChange={(e) => onDraft(pkg.id, 'maxUsers', Number(e.target.value))} />
                        <Field label="Ingestion Priority" type="number" value={draft.ingestionPriority ?? pkg.limits.ingestionPriority} onChange={(e) => onDraft(pkg.id, 'ingestionPriority', Number(e.target.value))} />
                        <SelectField
                          label="Allowed Site Type"
                          value={draft.allowedSiteType ?? pkg.limits.allowedSiteType}
                          onChange={(e) => onDraft(pkg.id, 'allowedSiteType', e.target.value)}
                          options={siteTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
                        />
                      </div>
                    </fieldset>

                    {/* text areas */}
                    <fieldset>
                      <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Content</legend>
                      <div className="space-y-3">
                        <div>
                          <Label>Description</Label>
                          <textarea
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[72px] focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
                            value={draft.description ?? pkg.description ?? ''}
                            onChange={(e) => onDraft(pkg.id, 'description', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Features (one per line)</Label>
                          <textarea
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[96px] focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
                            value={draft.features ?? pkg.features.join('\n')}
                            onChange={(e) => onDraft(pkg.id, 'features', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Allowed System Actions (comma separated)</Label>
                          <input
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
                            value={draft.allowedSystemActions ?? pkg.limits.allowedSystemActions.join(', ')}
                            onChange={(e) => onDraft(pkg.id, 'allowedSystemActions', e.target.value)}
                          />
                        </div>
                      </div>
                    </fieldset>

                    {/* boolean toggles */}
                    <fieldset>
                      <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Flags</legend>
                      <div className="flex flex-wrap gap-2.5">
                        <Toggle label="Active" checked={draft.isActive ?? Boolean(pkg.raw.is_active)} onChange={(v) => onDraft(pkg.id, 'isActive', v)} />
                        <Toggle label="Public" checked={draft.isPublic ?? pkg.isPublic} onChange={(v) => onDraft(pkg.id, 'isPublic', v)} />
                        <Toggle label="Featured" checked={draft.featured ?? pkg.featured} onChange={(v) => onDraft(pkg.id, 'featured', v)} />
                        <Toggle label="Auto Recharge" checked={draft.allowAutoRecharge ?? pkg.limits.allowAutoRecharge} onChange={(v) => onDraft(pkg.id, 'allowAutoRecharge', v)} />
                        <Toggle label="Remove Watermark" checked={draft.canRemoveWatermark ?? pkg.limits.canRemoveWatermark} onChange={(v) => onDraft(pkg.id, 'canRemoveWatermark', v)} />
                        <Toggle label="Custom Knowledge Categories" checked={draft.hasCustomKnowledgeCategories ?? pkg.limits.hasCustomKnowledgeCategories} onChange={(v) => onDraft(pkg.id, 'hasCustomKnowledgeCategories', v)} />
                        <Toggle label="Omnichannel Endpoints" checked={draft.hasOmniChannelEndpoints ?? pkg.limits.hasOmniChannelEndpoints} onChange={(v) => onDraft(pkg.id, 'hasOmniChannelEndpoints', v)} />
                      </div>
                    </fieldset>

                    {/* save */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                      {isDirty && (
                        <button
                          onClick={() => onDraft(pkg.id, '__reset', null)}
                          className="text-sm text-slate-500 hover:text-slate-700 transition"
                        >
                          Discard changes
                        </button>
                      )}
                      <button
                        onClick={() => onSave(pkg)}
                        disabled={savingId === pkg.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
                      >
                        {savingId === pkg.id ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ASSIGNMENTS TAB
   ═══════════════════════════════════════════════════════════════════ */
const AssignmentsTab: React.FC<{
  contacts: PackageContactAssignment[];
  packages: AdminPackage[];
  selectedPackages: Record<number, number>;
  setSelectedPackages: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  selectedStatuses: Record<number, 'ACTIVE' | 'TRIAL'>;
  setSelectedStatuses: React.Dispatch<React.SetStateAction<Record<number, 'ACTIVE' | 'TRIAL'>>>;
  assigningContactId: number | null;
  onAssign: (contactId: number) => void;
}> = ({ contacts, packages, selectedPackages, setSelectedPackages, selectedStatuses, setSelectedStatuses, assigningContactId, onAssign }) => {
  const [search, setSearch] = useState('');

  const customerContacts = useMemo(
    () => contacts.filter((c) => c.contact_type === 1 || c.contact_id === 1),
    [contacts],
  );

  const filtered = useMemo(() => {
    if (!search) return customerContacts;
    const q = search.toLowerCase();
    return customerContacts.filter(
      (c) =>
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_person?.toLowerCase().includes(q) ||
        c.contact_email?.toLowerCase().includes(q) ||
        c.package_name?.toLowerCase().includes(q),
    );
  }, [customerContacts, search]);

  const linked = customerContacts.filter((c) => c.package_name).length;
  const unlinked = customerContacts.length - linked;

  return (
    <div className="space-y-5">
      {/* stats & search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3">
          <StatBadge label="Total Clients" value={customerContacts.length} accent />
          <StatBadge label="Linked" value={linked} />
          <StatBadge label="Unlinked" value={unlinked} />
        </div>
        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-left">
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Company</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Linked Users</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Current Package</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Assign Package</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">No clients match your search.</td>
                </tr>
              ) : (
                filtered.map((contact) => (
                  <tr key={contact.contact_id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{contact.contact_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{contact.contact_person || contact.contact_email || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px] truncate">
                      {contact.linked_user_emails || <span className="text-slate-400 italic">No linked users</span>}
                    </td>
                    <td className="py-3 px-4">
                      {contact.package_name ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            {contact.package_name}
                          </span>
                          <span className="text-[11px] text-slate-400">{contact.package_status || 'ACTIVE'}</span>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          No package
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-w-[200px]"
                        value={selectedPackages[contact.contact_id] || ''}
                        onChange={(e) => setSelectedPackages((prev) => ({ ...prev, [contact.contact_id]: Number(e.target.value) }))}
                      >
                        <option value="">Select package…</option>
                        {packages.filter((p) => p.raw.is_active).map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setSelectedStatuses((prev) => ({ ...prev, [contact.contact_id]: 'ACTIVE' }))}
                          className={`px-3 py-1.5 text-xs font-semibold transition ${
                            (selectedStatuses[contact.contact_id] || 'ACTIVE') === 'ACTIVE'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          Full
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedStatuses((prev) => ({ ...prev, [contact.contact_id]: 'TRIAL' }))}
                          className={`px-3 py-1.5 text-xs font-semibold transition ${
                            selectedStatuses[contact.contact_id] === 'TRIAL'
                              ? 'bg-amber-500 text-white'
                              : 'bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          Trial
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onAssign(contact.contact_id)}
                        disabled={!selectedPackages[contact.contact_id] || assigningContactId === contact.contact_id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-picton-blue px-3.5 py-2 text-xs font-semibold text-white hover:bg-picton-blue/90 disabled:opacity-40 transition"
                      >
                        {assigningContactId === contact.contact_id ? (
                          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LinkIcon className="h-3.5 w-3.5" />
                        )}
                        Link
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   CREATE TAB
   ═══════════════════════════════════════════════════════════════════ */
const CreateTab: React.FC<{
  newPackage: typeof blankNewPackage;
  setNewPackage: React.Dispatch<React.SetStateAction<typeof blankNewPackage>>;
  savingId: number | null;
  onCreate: () => void;
}> = ({ newPackage, setNewPackage, savingId, onCreate }) => {
  const set = (patch: Partial<typeof blankNewPackage>) => setNewPackage((p) => ({ ...p, ...patch }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <PlusIcon className="h-5 w-5 text-picton-blue" />
          Create New Package
        </h2>
        <p className="text-sm text-slate-500 mt-1">Fill in the details below and hit Create when ready.</p>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* identity */}
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <CubeIcon className="h-3.5 w-3.5" /> Identity &amp; Pricing
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Field label="Slug" value={newPackage.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="e.g. starter" />
            <Field label="Name" value={newPackage.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Starter Plan" />
            <SelectField
              label="Type"
              value={newPackage.packageType}
              onChange={(e) => set({ packageType: e.target.value })}
              options={[
                { value: 'CONSUMER', label: 'Consumer' },
                { value: 'ENTERPRISE', label: 'Enterprise' },
                { value: 'STAFF', label: 'Staff' },
                { value: 'ADDON', label: 'Add-on' },
              ]}
            />
            <Field label="CTA Text" value={newPackage.ctaText} onChange={(e) => set({ ctaText: e.target.value })} />
            <Field label="Monthly Price (R)" value={newPackage.priceMonthly} onChange={(e) => set({ priceMonthly: e.target.value })} />
            <Field label="Annual Price (R)" value={newPackage.priceAnnually} onChange={(e) => set({ priceAnnually: e.target.value })} placeholder="Optional" />
            <Field label="Display Order" type="number" value={newPackage.displayOrder} onChange={(e) => set({ displayOrder: Number(e.target.value) })} />
            <Field label="Gateway Plan ID" value={newPackage.gatewayPlanId} onChange={(e) => set({ gatewayPlanId: e.target.value })} placeholder="Optional" />
          </div>
        </fieldset>

        {/* limits */}
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <BoltIcon className="h-3.5 w-3.5" /> Limits &amp; Quotas
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            <Field label="Max Sites" type="number" value={newPackage.maxSites} onChange={(e) => set({ maxSites: Number(e.target.value) })} />
            <Field label="Max Widgets" type="number" value={newPackage.maxWidgets} onChange={(e) => set({ maxWidgets: Number(e.target.value) })} />
            <Field label="Collections / Site" type="number" value={newPackage.maxCollectionsPerSite} onChange={(e) => set({ maxCollectionsPerSite: Number(e.target.value) })} />
            <Field label="Knowledge Pages" type="number" value={newPackage.maxKnowledgePages} onChange={(e) => set({ maxKnowledgePages: Number(e.target.value) })} />
            <Field label="Storage (MB)" type="number" value={newPackage.maxStorageMb} onChange={(e) => set({ maxStorageMb: Number(e.target.value) })} />
            <Field label="Actions / Month" type="number" value={newPackage.maxActionsPerMonth} onChange={(e) => set({ maxActionsPerMonth: Number(e.target.value) })} />
            <Field label="Max Users" type="number" value={newPackage.maxUsers} onChange={(e) => set({ maxUsers: Number(e.target.value) })} />
            <Field label="Ingestion Priority" type="number" value={newPackage.ingestionPriority} onChange={(e) => set({ ingestionPriority: Number(e.target.value) })} />
            <SelectField
              label="Allowed Site Type"
              value={newPackage.allowedSiteType}
              onChange={(e) => set({ allowedSiteType: e.target.value })}
              options={siteTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </fieldset>

        {/* content */}
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Content</legend>
          <div className="space-y-3">
            <div>
              <Label>Description</Label>
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[72px] focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
                value={newPackage.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Brief package description"
              />
            </div>
            <div>
              <Label>Features (one per line)</Label>
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm min-h-[120px] focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
                value={newPackage.features}
                onChange={(e) => set({ features: e.target.value })}
                placeholder={"Feature 1\nFeature 2\nFeature 3"}
              />
            </div>
            <div>
              <Label>Allowed System Actions (comma separated)</Label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 transition"
                value={newPackage.allowedSystemActions}
                onChange={(e) => set({ allowedSystemActions: e.target.value })}
                placeholder="email_capture, lead_gen"
              />
            </div>
          </div>
        </fieldset>

        {/* flags */}
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Flags</legend>
          <div className="flex flex-wrap gap-2.5">
            <Toggle label="Active" checked={newPackage.isActive} onChange={(v) => set({ isActive: v })} />
            <Toggle label="Public" checked={newPackage.isPublic} onChange={(v) => set({ isPublic: v })} />
            <Toggle label="Featured" checked={newPackage.featured} onChange={(v) => set({ featured: v })} />
            <Toggle label="Auto Recharge" checked={newPackage.allowAutoRecharge} onChange={(v) => set({ allowAutoRecharge: v })} />
            <Toggle label="Remove Watermark" checked={newPackage.canRemoveWatermark} onChange={(v) => set({ canRemoveWatermark: v })} />
            <Toggle label="Custom Knowledge Categories" checked={newPackage.hasCustomKnowledgeCategories} onChange={(v) => set({ hasCustomKnowledgeCategories: v })} />
            <Toggle label="Omnichannel Endpoints" checked={newPackage.hasOmniChannelEndpoints} onChange={(v) => set({ hasOmniChannelEndpoints: v })} />
          </div>
        </fieldset>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/40 rounded-b-2xl">
        <button
          onClick={() => setNewPackage(blankNewPackage)}
          className="text-sm text-slate-500 hover:text-slate-700 transition"
        >
          Reset Form
        </button>
        <button
          onClick={onCreate}
          disabled={savingId === -1 || !newPackage.slug || !newPackage.name}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {savingId === -1 ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
          Create Package
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const AdminPackages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('packages');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [assigningContactId, setAssigningContactId] = useState<number | null>(null);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [contacts, setContacts] = useState<PackageContactAssignment[]>([]);
  const [drafts, setDrafts] = useState<Record<number, any>>({});
  const [selectedPackages, setSelectedPackages] = useState<Record<number, number>>({});
  const [selectedStatuses, setSelectedStatuses] = useState<Record<number, 'ACTIVE' | 'TRIAL'>>({});
  const [newPackage, setNewPackage] = useState(blankNewPackage);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgRows, contactRows] = await Promise.all([
        AdminPackagesModel.getAll(),
        AdminPackagesModel.getContacts(),
      ]);
      setPackages(pkgRows);
      setContacts(contactRows);
      setSelectedPackages(Object.fromEntries(contactRows.map((c) => [c.contact_id, c.package_id || pkgRows[0]?.id || 0])));
    } catch (err: any) {
      setError(err?.message || 'Failed to load package data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDraft = (packageId: number, field: string, value: any) => {
    if (field === '__reset') {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[packageId];
        return next;
      });
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [packageId]: { ...(prev[packageId] || {}), [field]: value },
    }));
  };

  const handleSave = async (pkg: AdminPackage) => {
    setSavingId(pkg.id);
    setMessage(null);
    setError(null);
    try {
      await AdminPackagesModel.update(pkg.id, toPayload(pkg, drafts[pkg.id]));
      setMessage(`${pkg.name} updated successfully.`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[pkg.id];
        return next;
      });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update package.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    setSavingId(-1);
    setMessage(null);
    setError(null);
    try {
      const payload: PackagePayload = {
        slug: newPackage.slug,
        name: newPackage.name,
        description: newPackage.description || null,
        package_type: newPackage.packageType as PackagePayload['package_type'],
        price_monthly: centsFromMoney(newPackage.priceMonthly),
        price_annually: newPackage.priceAnnually ? centsFromMoney(newPackage.priceAnnually) : null,
        max_users: Number(newPackage.maxUsers),
        max_agents: Number(newPackage.maxAgents),
        max_widgets: Number(newPackage.maxWidgets),
        max_landing_pages: Number(newPackage.maxLandingPages),
        max_enterprise_endpoints: Number(newPackage.maxEnterpriseEndpoints),
        features: newPackage.features.split('\n').map((i) => i.trim()).filter(Boolean),
        is_active: newPackage.isActive,
        is_public: newPackage.isPublic,
        display_order: Number(newPackage.displayOrder),
        featured: newPackage.featured,
        cta_text: newPackage.ctaText,
        gateway_plan_id: newPackage.gatewayPlanId || null,
        max_sites: Number(newPackage.maxSites),
        max_collections_per_site: Number(newPackage.maxCollectionsPerSite),
        max_storage_bytes: mbToBytes(Number(newPackage.maxStorageMb)),
        max_actions_per_month: Number(newPackage.maxActionsPerMonth),
        allow_auto_recharge: newPackage.allowAutoRecharge,
        max_knowledge_pages: Number(newPackage.maxKnowledgePages),
        allowed_site_type: newPackage.allowedSiteType as PackagePayload['allowed_site_type'],
        can_remove_watermark: newPackage.canRemoveWatermark,
        allowed_system_actions: newPackage.allowedSystemActions.split(',').map((i) => i.trim()).filter(Boolean),
        has_custom_knowledge_categories: newPackage.hasCustomKnowledgeCategories,
        has_omni_channel_endpoints: newPackage.hasOmniChannelEndpoints,
        ingestion_priority: Number(newPackage.ingestionPriority),
      };
      await AdminPackagesModel.create(payload);
      setMessage('Package created successfully.');
      setNewPackage(blankNewPackage);
      setActiveTab('packages');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create package.');
    } finally {
      setSavingId(null);
    }
  };

  const handleAssign = async (contactId: number) => {
    const packageId = selectedPackages[contactId];
    if (!packageId) return;
    const status = selectedStatuses[contactId] || 'ACTIVE';
    setAssigningContactId(contactId);
    setMessage(null);
    setError(null);
    try {
      await AdminPackagesModel.assignContact(packageId, contactId, 'MONTHLY', status);
      setMessage('Contact linked to package successfully.');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to link contact to package.');
    } finally {
      setAssigningContactId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center gap-3 text-slate-500">
        <ArrowPathIcon className="h-6 w-6 animate-spin" />
        Loading packages…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CubeIcon className="h-6 w-6 text-picton-blue" />
            Package Catalogue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage packages, assign them to clients, and control limits &amp; pricing.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ─── Toast messages ───────────────────────────────────── */}
      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" />
          {message}
          <button onClick={() => setMessage(null)} className="ml-auto text-emerald-500 hover:text-emerald-700 text-lg leading-none">&times;</button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 text-red-500 font-bold">!</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* ─── Tab navigation ───────────────────────────────────── */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1" role="tablist">
          {tabDefs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.key === 'packages' && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isActive ? 'bg-picton-blue/10 text-picton-blue' : 'bg-slate-100 text-slate-500'}`}>
                    {packages.length}
                  </span>
                )}
                {tab.key === 'assignments' && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isActive ? 'bg-picton-blue/10 text-picton-blue' : 'bg-slate-100 text-slate-500'}`}>
                    {contacts.filter((c) => c.contact_type === 1 || c.contact_id === 1).length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── Tab panels ───────────────────────────────────────── */}
      {activeTab === 'packages' && (
        <PackagesTab
          packages={packages}
          drafts={drafts}
          savingId={savingId}
          onDraft={handleDraft}
          onSave={handleSave}
        />
      )}

      {activeTab === 'assignments' && (
        <AssignmentsTab
          contacts={contacts}
          packages={packages}
          selectedPackages={selectedPackages}
          setSelectedPackages={setSelectedPackages}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
          assigningContactId={assigningContactId}
          onAssign={handleAssign}
        />
      )}

      {activeTab === 'create' && (
        <CreateTab
          newPackage={newPackage}
          setNewPackage={setNewPackage}
          savingId={savingId}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default AdminPackages;
