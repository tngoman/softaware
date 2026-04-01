import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AdminClientApiModel,
  AdminEnterpriseModel,
  AdminPackagesModel,
  type ClientApiConfig,
  type ClientApiLog,
  type EnterpriseEndpoint,
  type PackageContactAssignment,
} from '../../models';
import {
  ServerStackIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  NoSymbolIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldCheckIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  SignalIcon,
  PlayIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentDuplicateIcon,
  CommandLineIcon,
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
  CubeIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';
import Swal from 'sweetalert2';

// ═══════════════════════════════════════════════════════════════════════════
// Inline Components
// ═══════════════════════════════════════════════════════════════════════════

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    disabled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    active: CheckCircleIcon, paused: PauseCircleIcon, disabled: NoSymbolIcon,
  };
  const Icon = icons[status] || CheckCircleIcon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      <Icon className="w-3.5 h-3.5" />{status}
    </span>
  );
};

const AuthBadge: React.FC<{ type: string }> = ({ type }) => {
  const labels: Record<string, { label: string; color: string }> = {
    rolling_token: { label: 'Daily Rolling Token', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    bearer: { label: 'Bearer Token', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    basic: { label: 'Basic Auth', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    api_key: { label: 'API Key', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
    none: { label: 'No Auth', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  };
  const info = labels[type] || labels.none;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
      <ShieldCheckIcon className="w-3 h-3" />{info.label}
    </span>
  );
};

const SectionLabel: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; badge?: string }> = ({ icon: Icon, label, badge }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="w-4 h-4 text-indigo-500" />
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
    {badge && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium">{badge}</span>}
  </div>
);

const PackageBadge: React.FC<{ slug?: string | null; name?: string | null; status?: string | null }> = ({ slug, name, status }) => {
  if (!slug || !name) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <CubeIcon className="w-3 h-3" /> No Package
      </span>
    );
  }
  const styles: Record<string, string> = {
    pro: 'bg-gradient-to-r from-violet-100 to-purple-100 text-purple-800 dark:from-violet-900/40 dark:to-purple-900/40 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700',
    enterprise: 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-800 dark:from-amber-900/40 dark:to-orange-900/40 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700',
    advanced: 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 dark:from-blue-900/40 dark:to-cyan-900/40 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700',
    starter: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700',
    staff: 'bg-gradient-to-r from-pink-100 to-rose-100 text-rose-800 dark:from-pink-900/40 dark:to-rose-900/40 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-700',
    free: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  const style = styles[slug] || styles.free;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${style}`}>
      <CubeIcon className="w-3.5 h-3.5" />
      {name}
      {status && status !== 'ACTIVE' && (
        <span className="ml-1 text-[10px] opacity-75">({status})</span>
      )}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Tool Definition Interfaces
// ═══════════════════════════════════════════════════════════════════════════

interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

interface ToolDef {
  name: string;
  description: string;
  parameters: ToolParam[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Empty form templates
// ═══════════════════════════════════════════════════════════════════════════

const emptyConfigForm = {
  client_id: '',
  client_name: '',
  contact_id: '' as string | number,
  endpoint_id: '',
  target_base_url: '',
  auth_type: 'rolling_token',
  auth_secret: '',
  auth_header: 'X-AI-Auth-Token',
  allowed_actions: [] as string[],
  rate_limit_rpm: 60,
  timeout_ms: 30000,
};

const emptyToolForm: ToolDef = {
  name: '',
  description: '',
  parameters: [],
};

const emptyParamForm: ToolParam = {
  name: '',
  type: 'string',
  description: '',
  required: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const ClientApiConfigs: React.FC = () => {
  // ─── State ──────────────────────────────────────────────────────────────
  const [configs, setConfigs] = useState<ClientApiConfig[]>([]);
  const [endpoints, setEndpoints] = useState<EnterpriseEndpoint[]>([]);
  const [contacts, setContacts] = useState<PackageContactAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Config CRUD form
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ClientApiConfig | null>(null);
  const [configForm, setConfigForm] = useState({ ...emptyConfigForm });
  const [savingConfig, setSavingConfig] = useState(false);

  // Tool builder
  const [showToolBuilder, setShowToolBuilder] = useState<string | null>(null); // config id
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [editingTool, setEditingTool] = useState<number | null>(null); // index
  const [toolForm, setToolForm] = useState<ToolDef>({ ...emptyToolForm });
  const [showToolForm, setShowToolForm] = useState(false);
  const [savingTools, setSavingTools] = useState(false);

  // Tool parameter sub-form
  const [editingParam, setEditingParam] = useState<number | null>(null);
  const [paramForm, setParamForm] = useState<ToolParam>({ ...emptyParamForm });
  const [showParamForm, setShowParamForm] = useState(false);

  // Logs
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<ClientApiLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Secret visibility
  const [showSecret, setShowSecret] = useState(false);
  const [showDetailSecret, setShowDetailSecret] = useState(false);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importContactId, setImportContactId] = useState<number | ''>('');
  const [importEndpointId, setImportEndpointId] = useState('');
  const [importAvailableTools, setImportAvailableTools] = useState<Array<{ name: string; description: string; paramCount: number }>>([]);
  const [importSelectedTools, setImportSelectedTools] = useState<string[]>([]);
  const [importLoadingTools, setImportLoadingTools] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSpecData, setImportSpecData] = useState<{
    base_url?: string;
    auth_type?: string;
    shared_secret?: string;
    auth_header?: string;
    available_actions: string[];
    toolDetails: Array<{ name: string; description: string; paramCount: number }>;
    fileName: string;
  } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importDragOver, setImportDragOver] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // ─── Data Loading ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configData, endpointData, contactData] = await Promise.all([
        AdminClientApiModel.getAll(),
        AdminEnterpriseModel.getAll(),
        AdminPackagesModel.getContacts(),
      ]);
      setConfigs(configData);
      setEndpoints(endpointData);
      setContacts(contactData);
    } catch (err) {
      console.error('Failed to load data:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load client API configurations' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = async (configId: string) => {
    setLogsLoading(true);
    try {
      const data = await AdminClientApiModel.getLogs(configId, 50);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Helpers ────────────────────────────────────────────────────────────
  const getLinkedEndpoint = (endpointId: string | null): EnterpriseEndpoint | undefined =>
    endpoints.find(ep => ep.id === endpointId);

  /** Resolve the contact associated with a config — direct contact_id, or fallback through linked endpoint */
  const getLinkedContact = (config: ClientApiConfig): PackageContactAssignment | undefined => {
    // Direct link first
    if (config.contact_id) {
      const direct = contacts.find(c => c.contact_id === config.contact_id);
      if (direct) return direct;
    }
    // Fallback: resolve through the linked enterprise endpoint
    const ep = getLinkedEndpoint(config.endpoint_id);
    if (ep?.contact_id) {
      return contacts.find(c => c.contact_id === ep.contact_id);
    }
    return undefined;
  };

  const parseAllowedActions = (config: ClientApiConfig): string[] => {
    if (!config.allowed_actions) return [];
    try { return JSON.parse(config.allowed_actions); } catch { return []; }
  };

  const parseToolsFromEndpoint = (ep: EnterpriseEndpoint): ToolDef[] => {
    if (!ep.llm_tools_config) return [];
    try {
      const raw = JSON.parse(ep.llm_tools_config);
      return raw.map((t: any) => ({
        name: t.function?.name || t.name || '',
        description: t.function?.description || t.description || '',
        parameters: Object.entries(t.function?.parameters?.properties || {}).map(([key, val]: [string, any]) => ({
          name: key,
          type: val.type || 'string',
          description: val.description || '',
          required: (t.function?.parameters?.required || []).includes(key),
          ...(val.enum ? { enum: val.enum } : {}),
        })),
      }));
    } catch { return []; }
  };

  const toolsToOpenAIFormat = (toolDefs: ToolDef[]): any[] =>
    toolDefs.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            t.parameters.map(p => [
              p.name,
              {
                type: p.type,
                description: p.description,
                ...(p.enum && p.enum.length > 0 ? { enum: p.enum } : {}),
              },
            ])
          ),
          required: t.parameters.filter(p => p.required).map(p => p.name),
        },
      },
    }));

  // ─── Config CRUD Handlers ──────────────────────────────────────────────
  const openCreateConfig = () => {
    setEditingConfig(null);
    setConfigForm({ ...emptyConfigForm });
    setShowSecret(false);
    setShowConfigForm(true);
  };

  const openEditConfig = (config: ClientApiConfig) => {
    setEditingConfig(config);
    setConfigForm({
      client_id: config.client_id,
      client_name: config.client_name,
      contact_id: config.contact_id || '',
      endpoint_id: config.endpoint_id || '',
      target_base_url: config.target_base_url,
      auth_type: config.auth_type,
      auth_secret: config.auth_secret || '',
      auth_header: config.auth_header || 'X-AI-Auth-Token',
      allowed_actions: parseAllowedActions(config),
      rate_limit_rpm: config.rate_limit_rpm,
      timeout_ms: config.timeout_ms,
    });
    setShowSecret(false);
    setShowConfigForm(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const payload = {
        ...configForm,
        contact_id: configForm.contact_id ? Number(configForm.contact_id) : undefined,
        endpoint_id: configForm.endpoint_id || undefined,
        auth_secret: configForm.auth_secret || undefined,
      };
      if (editingConfig) {
        await AdminClientApiModel.update(editingConfig.id, payload);
        Swal.fire({ icon: 'success', title: 'Updated', timer: 1500, showConfirmButton: false });
      } else {
        const created = await AdminClientApiModel.create(payload);
        Swal.fire({
          icon: 'success',
          title: 'Gateway Created',
          html: `<p class="text-sm">Config ID:</p><code class="text-xs bg-gray-100 p-2 rounded block mt-2">${created.id}</code>`,
        });
      }
      setShowConfigForm(false);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.details?.[0]?.message || err.response?.data?.error || 'Save failed';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleKillSwitch = async (config: ClientApiConfig) => {
    const isActive = config.status === 'active';
    const result = await Swal.fire({
      title: isActive ? '🛑 Kill Switch — Disable API?' : '✅ Reactivate API?',
      html: isActive
        ? `<p class="text-sm">This will <strong>immediately sever</strong> all API connections to <strong>${config.client_name}</strong>. No requests will be forwarded until reactivated.</p>`
        : `<p class="text-sm">This will reactivate the API gateway for <strong>${config.client_name}</strong>.</p>`,
      icon: isActive ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: isActive ? 'Disable Now' : 'Reactivate',
      confirmButtonColor: isActive ? '#EF4444' : '#10B981',
    });
    if (!result.isConfirmed) return;
    try {
      await AdminClientApiModel.setStatus(config.id, isActive ? 'disabled' : 'active');
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handlePauseToggle = async (config: ClientApiConfig) => {
    const nextStatus = config.status === 'active' ? 'paused' : 'active';
    try {
      await AdminClientApiModel.setStatus(config.id, nextStatus);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleDeleteConfig = async (config: ClientApiConfig) => {
    const result = await Swal.fire({
      title: 'Delete Gateway Config?',
      html: `<p>This will permanently delete the API gateway for <strong>${config.client_name}</strong> and all associated request logs.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await AdminClientApiModel.delete(config.id);
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  // ─── Export / Import Handlers ──────────────────────────────────────────
  const handleExportTemplate = async () => {
    try {
      const template = await AdminClientApiModel.exportTemplate();
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'softaware-gateway-integration-spec.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.response?.data?.error || 'Could not export template' });
    }
  };

  const handleExportConfig = async (config: ClientApiConfig) => {
    try {
      const data = await AdminClientApiModel.exportConfig(config.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gateway-${config.client_id}-spec.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Export Failed', text: err.response?.data?.error || 'Could not export config' });
    }
  };

  const openImportModal = () => {
    setImportContactId('');
    setImportEndpointId('');
    setImportAvailableTools([]);
    setImportSelectedTools([]);
    setImportError('');
    setImportSpecData(null);
    if (importFileInputRef.current) importFileInputRef.current.value = '';
    setShowImportModal(true);
  };

  const processSpecFile = (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setImportError('Please drop a .json file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        const metaType = parsed?._meta?.type;

        // Accept template format, client-filled format, and round-tripped export format
        const VALID_TYPES = ['softaware_gateway_integration_spec', 'softaware_client_api_gateway', 'softaware_gateway_client_spec'];
        if (!metaType || !VALID_TYPES.includes(metaType)) {
          setImportError('Invalid file: not a Soft Aware gateway spec. Expected _meta.type to be one of: ' + VALID_TYPES.join(', '));
          return;
        }

        let base_url: string | undefined;
        let auth_type: string | undefined;
        let shared_secret: string | undefined;
        let auth_header: string | undefined;
        const toolDetails: Array<{ name: string; description: string; paramCount: number }> = [];
        const toolNames: string[] = [];

        if (metaType === 'softaware_client_api_gateway') {
          // ── v1.1 format: connection + tools[] ──
          const conn = parsed.connection || {};
          base_url = conn.target_base_url || undefined;
          auth_type = conn.auth_type || undefined;
          shared_secret = conn.auth_secret && conn.auth_secret.length > 0 ? conn.auth_secret : undefined;
          auth_header = conn.auth_header || undefined;

          const tools: any[] = Array.isArray(parsed.tools) ? parsed.tools : [];
          for (const t of tools) {
            if (t.name && typeof t.name === 'string') {
              const paramCount = t.parameters ? Object.keys(t.parameters).length : 0;
              toolDetails.push({ name: t.name, description: t.description || '', paramCount });
              toolNames.push(t.name);
            }
          }
        } else if (metaType === 'softaware_gateway_client_spec') {
          // ── Round-tripped export-config format: connection + tools.endpoints[] + your_config ──
          // Prefer your_config.available_actions if present (admin may have edited it to add new tools)
          const conn = parsed.connection || {};
          base_url = conn.base_url || conn.target_base_url || undefined;
          auth_type = conn.auth_type || undefined;
          auth_header = conn.auth_header || undefined;

          // Build tool map from tools.endpoints[] for descriptions
          const endpoints: any[] = Array.isArray(parsed.tools?.endpoints) ? parsed.tools.endpoints : [];
          const toolMap = new Map<string, { description: string; paramCount: number }>();
          for (const ep of endpoints) {
            const name = ep.action || ep.name;
            if (name && typeof name === 'string') {
              const paramCount = ep.parameters ? ep.parameters.length : 0;
              toolMap.set(name, { description: ep.description || '', paramCount });
            }
          }

          // your_config.available_actions is the canonical editable list
          const cfg = parsed.your_config || {};
          const rawActions: string[] = Array.isArray(cfg.available_actions) ? cfg.available_actions : [];
          const actionList = rawActions.length > 0
            ? rawActions
            : endpoints.map((ep: any) => ep.action || ep.name).filter(Boolean);

          for (const a of actionList) {
            if (typeof a === 'string' && !a.includes(' ') && a.length > 0) {
              const detail = toolMap.get(a);
              toolDetails.push({ name: a, description: detail?.description || '', paramCount: detail?.paramCount || 0 });
              toolNames.push(a);
            }
          }
        } else {
          // ── v2.0 format: your_config + example_tools.endpoints[] ──
          const cfg = parsed.your_config || {};
          base_url = cfg.base_url && !cfg.base_url.includes('your-server') ? cfg.base_url : undefined;
          auth_type = cfg.auth_type || undefined;
          shared_secret = cfg.shared_secret && !cfg.shared_secret.startsWith('<') ? cfg.shared_secret : undefined;
          auth_header = cfg.auth_header || undefined;

          // Build rich tool details from example_tools.endpoints[]
          const exampleEndpoints: any[] = Array.isArray(parsed.example_tools?.endpoints) ? parsed.example_tools.endpoints : [];
          const toolMap = new Map<string, { description: string; paramCount: number }>();
          for (const ep of exampleEndpoints) {
            const name = ep.action || ep.name;
            if (name && typeof name === 'string') {
              const paramCount = ep.soft_aware_sends ? Object.keys(ep.soft_aware_sends).length : (ep.parameters ? Object.keys(ep.parameters).length : 0);
              toolMap.set(name, { description: ep.description || '', paramCount });
            }
          }

          // Use example_tools.endpoints as the canonical list (all endpoints the client has built).
          // Fall back to your_config.available_actions only if no endpoints are defined.
          const rawActions: string[] = Array.isArray(cfg.available_actions) ? cfg.available_actions : [];
          const actionList: string[] = exampleEndpoints.length > 0
            ? exampleEndpoints.map((ep: any) => ep.action || ep.name).filter((n: any) => typeof n === 'string' && n.length > 0)
            : rawActions;
          // Also include any extra names from available_actions not already in the endpoint list
          for (const a of rawActions) {
            if (typeof a === 'string' && a.length > 0 && !actionList.includes(a)) actionList.push(a);
          }
          for (const a of actionList) {
            if (typeof a === 'string' && !a.includes(' ') && a.length > 0) {
              const detail = toolMap.get(a);
              toolDetails.push({ name: a, description: detail?.description || '', paramCount: detail?.paramCount || 0 });
              toolNames.push(a);
            }
          }
        }

        // Filter out placeholder secrets
        const cleanSecret = shared_secret && !shared_secret.startsWith('<') && shared_secret.length > 5 ? shared_secret : undefined;

        const specData = {
          base_url,
          auth_type,
          shared_secret: cleanSecret,
          auth_header,
          available_actions: toolNames,
          toolDetails,
          fileName: file.name,
        };
        setImportSpecData(specData);
        setImportSelectedTools(toolNames);
        setImportError('');
      } catch {
        setImportError('Could not parse file. Make sure it is a valid JSON spec file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSpecFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSpecFile(file);
  };

  const handleSpecFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processSpecFile(file);
  };

  const handleImportEndpointChange = async (endpointId: string) => {
    setImportEndpointId(endpointId);
    setImportAvailableTools([]);
    // When clearing endpoint, restore spec-loaded tools instead of wiping them
    if (!endpointId) {
      setImportSelectedTools(importSpecData?.available_actions ?? []);
      return;
    }
    setImportSelectedTools([]);
    setImportLoadingTools(true);
    try {
      const result = await AdminClientApiModel.getEndpointTools(endpointId);
      setImportAvailableTools(result.tools);
      // Auto-select all tools by default
      setImportSelectedTools(result.tools.map(t => t.name));
    } catch (err: any) {
      setImportError('Failed to load tools from endpoint');
    } finally {
      setImportLoadingTools(false);
    }
  };

  const toggleImportTool = (toolName: string) => {
    setImportSelectedTools(prev =>
      prev.includes(toolName) ? prev.filter(t => t !== toolName) : [...prev, toolName]
    );
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importContactId) { setImportError('A client account is required'); return; }
    setImporting(true);
    setImportError('');
    try {
      const existingForContact = configs.find(c => c.contact_id === Number(importContactId));
      const payload: any = {
        contact_id: Number(importContactId),
        selected_tools: importSelectedTools,
        mode: existingForContact ? importMode : 'merge',
      };
      if (importEndpointId) {
        payload.endpoint_id = importEndpointId;
      }
      if (importSpecData) {
        const overrides: any = {};
        if (importSpecData.base_url) overrides.target_base_url = importSpecData.base_url;
        if (importSpecData.auth_type) overrides.auth_type = importSpecData.auth_type;
        if (importSpecData.shared_secret) overrides.auth_secret = importSpecData.shared_secret;
        if (importSpecData.auth_header) overrides.auth_header = importSpecData.auth_header;
        if (Object.keys(overrides).length > 0) payload.connection_overrides = overrides;
      }
      const result = await AdminClientApiModel.importConfig(payload);
      setShowImportModal(false);
      Swal.fire({
        icon: 'success',
        title: 'Gateway Created',
        html: `<p class="text-sm">${result.message}</p>`,
        timer: 4000,
        showConfirmButton: true,
      });
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.details?.[0]?.message || err.response?.data?.error || 'Import failed';
      setImportError(msg);
    } finally {
      setImporting(false);
    }
  };

  // ─── Tool Builder Handlers ─────────────────────────────────────────────
  const openToolBuilder = (config: ClientApiConfig) => {
    const linkedEp = getLinkedEndpoint(config.endpoint_id);
    const parsedTools = linkedEp ? parseToolsFromEndpoint(linkedEp) : [];
    setTools(parsedTools);
    setShowToolBuilder(config.id);
  };

  const openAddTool = () => {
    setEditingTool(null);
    setToolForm({ ...emptyToolForm });
    setShowToolForm(true);
  };

  const openEditTool = (index: number) => {
    setEditingTool(index);
    setToolForm({ ...tools[index] });
    setShowToolForm(true);
  };

  const handleSaveTool = () => {
    if (!toolForm.name.trim()) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Tool name is required' });
      return;
    }
    if (editingTool !== null) {
      const updated = [...tools];
      updated[editingTool] = { ...toolForm };
      setTools(updated);
    } else {
      setTools([...tools, { ...toolForm }]);
    }
    setShowToolForm(false);
  };

  const handleDeleteTool = (index: number) => {
    setTools(tools.filter((_, i) => i !== index));
  };

  const handleDuplicateTool = (index: number) => {
    const copy = { ...tools[index], name: `${tools[index].name}_copy` };
    setTools([...tools, copy]);
  };

  // ─── Parameter sub-form handlers ──────────────────────────────────────
  const openAddParam = () => {
    setEditingParam(null);
    setParamForm({ ...emptyParamForm });
    setShowParamForm(true);
  };

  const openEditParam = (index: number) => {
    setEditingParam(index);
    setParamForm({ ...toolForm.parameters[index] });
    setShowParamForm(true);
  };

  const handleSaveParam = () => {
    if (!paramForm.name.trim()) return;
    const params = [...toolForm.parameters];
    if (editingParam !== null) {
      params[editingParam] = { ...paramForm };
    } else {
      params.push({ ...paramForm });
    }
    setToolForm({ ...toolForm, parameters: params });
    setShowParamForm(false);
  };

  const handleDeleteParam = (index: number) => {
    setToolForm({ ...toolForm, parameters: toolForm.parameters.filter((_, i) => i !== index) });
  };

  // ─── Save & Sync Tools ────────────────────────────────────────────────
  const handleSyncTools = async () => {
    if (!showToolBuilder) return;
    setSavingTools(true);
    try {
      const config = configs.find(c => c.id === showToolBuilder);
      if (!config) throw new Error('Config not found');

      const openaiTools = toolsToOpenAIFormat(tools);
      const allowedActions = tools.map(t => t.name);

      // 1. Update the client API config's allowed_actions
      await AdminClientApiModel.update(config.id, { allowed_actions: allowedActions });

      // 2. If linked to an enterprise endpoint, sync tool definitions there too
      if (config.endpoint_id) {
        await AdminClientApiModel.syncTools(config.id, openaiTools);
      }

      Swal.fire({
        icon: 'success',
        title: 'Tools Synced',
        html: `<p class="text-sm">${tools.length} tool(s) synced to gateway <strong>${config.client_id}</strong>${config.endpoint_id ? ' and linked enterprise endpoint' : ''}.</p>`,
        timer: 2500,
        showConfirmButton: false,
      });
      setShowToolBuilder(null);
      loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Sync Failed', text: err.response?.data?.error || err.message || 'Failed to sync tools' });
    } finally {
      setSavingTools(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ icon: 'success', title: 'Copied!', timer: 1200, showConfirmButton: false });
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ServerStackIcon className="w-7 h-7 text-indigo-500" />
            Client API Gateway
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage client API proxy configs, map endpoints visually, and control kill switches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors">
            <ArrowPathIcon className="w-4 h-4" /> Refresh
          </button>
          <button onClick={handleExportTemplate} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors">
            <ArrowDownTrayIcon className="w-4 h-4" /> Integration Spec
          </button>
          <button onClick={openImportModal} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors">
            <ArrowUpTrayIcon className="w-4 h-4" /> Import
          </button>
          <button onClick={openCreateConfig} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
            <PlusIcon className="w-4 h-4" /> New Gateway
          </button>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{configs.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Gateways</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{configs.filter(c => c.status === 'active').length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{configs.reduce((sum, c) => sum + c.total_requests, 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Requests</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{configs.reduce((sum, c) => sum + parseAllowedActions(c).length, 0)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Mapped Actions</p>
          </div>
        </Card>
      </div>

      {/* ── Configs Table ──────────────────────────────────────────────── */}
      <Card>
        <div className="p-5">
          {configs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mx-auto mb-4">
                <ServerStackIcon className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No client API gateways configured</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Create your first gateway to connect to a client's API.</p>
              <button onClick={openCreateConfig} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors">
                <PlusIcon className="w-4 h-4" /> Create Gateway
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-semibold uppercase tracking-wider">Client</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Account / Package</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Target API</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Auth</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Requests</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {configs.map((config) => {
                    const linkedEp = getLinkedEndpoint(config.endpoint_id);
                    const linkedContact = getLinkedContact(config);
                    const actions = parseAllowedActions(config);
                    return (
                      <React.Fragment key={config.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-4">
                            <p className="font-semibold text-gray-900 dark:text-white">{config.client_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{config.client_id}</p>
                            {linkedEp && (
                              <span className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                                <LinkIcon className="w-3 h-3" />{linkedEp.id}
                              </span>
                            )}
                          </td>
                          <td className="py-4">
                            {linkedContact ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <UserGroupIcon className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[160px]" title={linkedContact.contact_name}>
                                    {linkedContact.contact_name}
                                  </span>
                                </div>
                                <PackageBadge
                                  slug={linkedContact.package_slug}
                                  name={linkedContact.package_name}
                                  status={linkedContact.package_status}
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Not linked
                              </span>
                            )}
                          </td>
                          <td className="py-4">
                            <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={config.target_base_url}>
                              {config.target_base_url}
                            </p>
                          </td>
                          <td className="py-4">
                            <div className="space-y-1">
                              <AuthBadge type={config.auth_type} />
                              <span className="block text-xs font-mono text-gray-500 dark:text-gray-400">
                                {actions.length} action{actions.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-4"><StatusBadge status={config.status} /></td>
                          <td className="py-4 text-right">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-mono font-semibold bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg">
                              {config.total_requests.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center justify-end gap-1">
                              {/* Tool Builder */}
                              <button onClick={() => openToolBuilder(config)} className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors" title="Endpoint Mapper & Tool Builder">
                                <WrenchScrewdriverIcon className="w-4 h-4" />
                              </button>
                              {/* Logs */}
                              <button onClick={() => { setShowLogs(config.id); loadLogs(config.id); }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" title="Request Logs">
                                <ClockIcon className="w-4 h-4" />
                              </button>
                              {/* Pause/Resume */}
                              {config.status !== 'disabled' && (
                                <button onClick={() => handlePauseToggle(config)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title={config.status === 'paused' ? 'Resume' : 'Pause'}>
                                  {config.status === 'active' ? <PauseCircleIcon className="w-4 h-4 text-amber-500" /> : <PlayIcon className="w-4 h-4 text-green-500" />}
                                </button>
                              )}
                              {/* Kill Switch */}
                              <button onClick={() => handleKillSwitch(config)} className={`p-2 rounded-lg transition-colors ${config.status === 'disabled' ? 'hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400' : 'hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400'}`} title={config.status === 'disabled' ? 'Reactivate' : 'Kill Switch'}>
                                {config.status === 'disabled' ? <CheckCircleIcon className="w-4 h-4" /> : <BoltIcon className="w-4 h-4" />}
                              </button>
                              {/* Edit */}
                              <button onClick={() => openEditConfig(config)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors" title="Edit">
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              {/* Export */}
                              <button onClick={() => handleExportConfig(config)} className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors" title="Export Integration Spec">
                                <ArrowDownTrayIcon className="w-4 h-4" />
                              </button>
                              {/* Delete */}
                              <button onClick={() => handleDeleteConfig(config)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors" title="Delete">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                              {/* Expand */}
                              <button onClick={() => { setExpandedRow(expandedRow === config.id ? null : config.id); setShowDetailSecret(false); }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" title="Details">
                                {expandedRow === config.id ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Expanded Detail Row ─────────────────────── */}
                        {expandedRow === config.id && (
                          <tr>
                            <td colSpan={7} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 p-6">
                              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                {/* Client Account & Package */}
                                <div className="space-y-3">
                                  <SectionLabel icon={UserGroupIcon} label="Client Account" />
                                  {linkedContact ? (
                                    <div className="space-y-3">
                                      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Company</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{linkedContact.contact_name}</p>
                                        {linkedContact.contact_person && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{linkedContact.contact_person}</p>
                                        )}
                                      </div>
                                      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Package Tier</p>
                                        <div className="mt-1">
                                          <PackageBadge slug={linkedContact.package_slug} name={linkedContact.package_name} status={linkedContact.package_status} />
                                        </div>
                                      </div>
                                      {linkedContact.contact_email && (
                                        <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Contact</p>
                                          <p className="text-xs text-gray-700 dark:text-gray-300">{linkedContact.contact_email}</p>
                                          {linkedContact.contact_phone && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{linkedContact.contact_phone}</p>
                                          )}
                                        </div>
                                      )}
                                      {linkedContact.linked_user_count != null && linkedContact.linked_user_count > 0 && (
                                        <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Linked Users</p>
                                          <p className="text-sm text-gray-900 dark:text-white font-medium">{linkedContact.linked_user_count}</p>
                                          {linkedContact.linked_user_emails && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" title={linkedContact.linked_user_emails}>{linkedContact.linked_user_emails}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
                                      <ExclamationTriangleIcon className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                                      <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">No client account linked</p>
                                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Edit this config to link it to a client record.</p>
                                    </div>
                                  )}
                                </div>

                                {/* Connection Details */}
                                <div className="space-y-3">
                                  <SectionLabel icon={ArrowsRightLeftIcon} label="Connection" />
                                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Client ID</p>
                                    <div className="flex items-center gap-2">
                                      <code className="text-sm font-mono font-semibold text-gray-900 dark:text-white flex-1 truncate">{config.client_id}</code>
                                      <button onClick={() => copyToClipboard(config.client_id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Copy Client ID">
                                        <ClipboardDocumentIcon className="w-3.5 h-3.5 text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Gateway URL</p>
                                    <div className="flex items-center gap-2">
                                      <code className="text-xs font-mono text-indigo-700 dark:text-indigo-400 flex-1 truncate">
                                        POST /api/v1/client-api/{config.client_id}/:action
                                      </code>
                                      <button onClick={() => copyToClipboard(`${window.location.origin}/api/v1/client-api/${config.client_id}`)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Copy Gateway URL">
                                        <ClipboardDocumentIcon className="w-3.5 h-3.5 text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Target Base URL</p>
                                    <code className="text-xs font-mono text-gray-700 dark:text-gray-300">{config.target_base_url}</code>
                                  </div>
                                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Auth Type</p>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      config.auth_type === 'rolling_token' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                      config.auth_type === 'bearer' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                      config.auth_type === 'api_key' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>{config.auth_type.replace('_', ' ')}</span>
                                  </div>
                                  {config.auth_secret && (
                                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                        {config.auth_type === 'rolling_token' ? 'Shared Secret' : 'Auth Secret'}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">
                                          {showDetailSecret ? config.auth_secret : '•'.repeat(Math.min(config.auth_secret.length, 32))}
                                        </code>
                                        <button onClick={() => setShowDetailSecret(!showDetailSecret)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0" title={showDetailSecret ? 'Hide' : 'Reveal'}>
                                          {showDetailSecret ? <EyeSlashIcon className="w-3.5 h-3.5 text-gray-400" /> : <EyeIcon className="w-3.5 h-3.5 text-gray-400" />}
                                        </button>
                                        <button onClick={() => copyToClipboard(config.auth_secret!)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0" title="Copy">
                                          <ClipboardDocumentIcon className="w-3.5 h-3.5 text-gray-400" />
                                        </button>
                                      </div>
                                      {config.auth_type === 'rolling_token' && (
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">Token = SHA256(secret + YYYY-MM-DD)</p>
                                      )}
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Rate Limit</p>
                                      <p className="text-sm text-gray-900 dark:text-white font-medium">{config.rate_limit_rpm} RPM</p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Timeout</p>
                                      <p className="text-sm text-gray-900 dark:text-white font-medium">{(config.timeout_ms / 1000).toFixed(0)}s</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Mapped Actions */}
                                <div className="space-y-3">
                                  <SectionLabel icon={CommandLineIcon} label="Mapped Actions" badge={`${actions.length}`} />
                                  {actions.length === 0 ? (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
                                      <ExclamationTriangleIcon className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                                      <p className="text-sm text-amber-800 dark:text-amber-300">No actions mapped yet</p>
                                      <button onClick={() => openToolBuilder(config)} className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                                        Open Tool Builder →
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                      {actions.map((action, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                          <CommandLineIcon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                          <span className="text-xs font-mono text-gray-900 dark:text-white">{action}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Linked Enterprise Endpoint */}
                                <div className="space-y-3">
                                  <SectionLabel icon={SignalIcon} label="Linked Endpoint" />
                                  {linkedEp ? (
                                    <div className="space-y-3">
                                      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Endpoint</p>
                                        <p className="text-sm font-mono text-indigo-700 dark:text-indigo-400">{linkedEp.id}</p>
                                      </div>
                                      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">LLM</p>
                                        <p className="text-sm text-gray-900 dark:text-white">{linkedEp.llm_provider} / {linkedEp.llm_model}</p>
                                      </div>
                                      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Tool Defs on Endpoint</p>
                                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                                          {linkedEp.llm_tools_config ? JSON.parse(linkedEp.llm_tools_config).length : 0} functions
                                        </p>
                                      </div>
                                      <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Created</p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">{new Date(config.created_at).toLocaleString()}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                                      <p className="text-sm text-gray-500 dark:text-gray-400">No linked enterprise endpoint</p>
                                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Edit config to link one</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Create / Edit Config
         ══════════════════════════════════════════════════════════════════ */}
      {showConfigForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowConfigForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ServerStackIcon className="w-5 h-5 text-indigo-500" />
                {editingConfig ? 'Edit Gateway Config' : 'New Client API Gateway'}
              </h2>
              <button onClick={() => setShowConfigForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleSaveConfig} className="p-5 space-y-5">
              {/* Client Identity */}
              <div>
                <SectionLabel icon={LinkIcon} label="Client Identity" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Client ID <span className="text-red-500">*</span></label>
                    <input type="text" value={configForm.client_id} onChange={e => setConfigForm({ ...configForm, client_id: e.target.value })} required disabled={!!editingConfig} placeholder="e.g., silulumanzi" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white disabled:opacity-50 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Client Name <span className="text-red-500">*</span></label>
                    <input type="text" value={configForm.client_name} onChange={e => setConfigForm({ ...configForm, client_name: e.target.value })} required placeholder="e.g., Silulumanzi Water Services" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                  </div>
                </div>
              </div>

              {/* Client Account Link */}
              <div>
                <SectionLabel icon={UserGroupIcon} label="Client Account" />
                <select
                  value={configForm.contact_id}
                  onChange={(e) => {
                    const cid = e.target.value ? Number(e.target.value) : '';
                    setConfigForm({ ...configForm, contact_id: cid });
                    // Auto-fill client name from contact if empty
                    if (cid && !configForm.client_name) {
                      const c = contacts.find(ct => ct.contact_id === cid);
                      if (c) setConfigForm(prev => ({ ...prev, contact_id: cid, client_name: c.contact_name }));
                    }
                  }}
                  required
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="">Select a client account...</option>
                  {contacts.map(c => (
                    <option key={c.contact_id} value={c.contact_id}>
                      {c.contact_name}{c.contact_person ? ` — ${c.contact_person}` : ''}{c.package_name ? ` [${c.package_name}]` : ''}
                    </option>
                  ))}
                </select>
                {configForm.contact_id && (() => {
                  const sel = contacts.find(c => c.contact_id === Number(configForm.contact_id));
                  return sel ? (
                    <div className="mt-2 flex items-center gap-2">
                      <PackageBadge slug={sel.package_slug} name={sel.package_name} status={sel.package_status} />
                      {sel.contact_email && <span className="text-xs text-gray-500 dark:text-gray-400">{sel.contact_email}</span>}
                    </div>
                  ) : null;
                })()}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Links this gateway to a client record for billing, package enforcement, and audit trail.</p>
              </div>

              {/* Link to Enterprise Endpoint */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Link to Enterprise Endpoint</label>
                <select value={configForm.endpoint_id} onChange={e => setConfigForm({ ...configForm, endpoint_id: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                  <option value="">— No link (standalone gateway) —</option>
                  {endpoints.map(ep => (
                    <option key={ep.id} value={ep.id}>{ep.client_name} — {ep.id}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Links this gateway to an enterprise webhook endpoint. Tool definitions will sync bidirectionally.</p>
              </div>

              {/* Target API */}
              <div>
                <SectionLabel icon={ArrowTopRightOnSquareIcon} label="Target API (Client's Server)" />
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Base URL <span className="text-red-500">*</span></label>
                    <input type="url" value={configForm.target_base_url} onChange={e => setConfigForm({ ...configForm, target_base_url: e.target.value })} required placeholder="https://portal.client.com/api/ai" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono" />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">The action name will be appended as a path segment: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{configForm.target_base_url || 'https://...'}/actionName</code></p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Rate Limit (RPM)</label>
                      <input type="number" min={1} value={configForm.rate_limit_rpm} onChange={e => setConfigForm({ ...configForm, rate_limit_rpm: parseInt(e.target.value) || 60 })} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Timeout (ms)</label>
                      <input type="number" min={1000} step={1000} value={configForm.timeout_ms} onChange={e => setConfigForm({ ...configForm, timeout_ms: parseInt(e.target.value) || 30000 })} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Authentication */}
              <div>
                <SectionLabel icon={ShieldCheckIcon} label="Authentication" />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Auth Type</label>
                      <select value={configForm.auth_type} onChange={e => setConfigForm({ ...configForm, auth_type: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                        <option value="rolling_token">Daily Rolling Token (SHA-256)</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                        <option value="api_key">API Key</option>
                        <option value="none">No Authentication</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Auth Header</label>
                      <input type="text" value={configForm.auth_header} onChange={e => setConfigForm({ ...configForm, auth_header: e.target.value })} placeholder="X-AI-Auth-Token" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono" />
                    </div>
                  </div>
                  {configForm.auth_type !== 'none' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {configForm.auth_type === 'rolling_token' ? 'Shared Secret' : 'Auth Secret / Token'}
                      </label>
                      <div className="relative">
                        <input
                          type={showSecret ? 'text' : 'password'}
                          value={configForm.auth_secret}
                          onChange={e => setConfigForm({ ...configForm, auth_secret: e.target.value })}
                          placeholder={configForm.auth_type === 'rolling_token' ? 'Shared secret for SHA256(secret + YYYY-MM-DD)' : 'Secret value...'}
                          className="w-full px-3 py-2 pr-10 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono"
                        />
                        <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                          {showSecret ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                      </div>
                      {configForm.auth_type === 'rolling_token' && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                          <ShieldCheckIcon className="w-3 h-3" />
                          Token auto-generated daily: SHA256(secret + YYYY-MM-DD)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowConfigForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={savingConfig} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors">
                  {savingConfig ? 'Saving...' : editingConfig ? 'Update Gateway' : 'Create Gateway'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Tool Builder & Endpoint Mapper
         ══════════════════════════════════════════════════════════════════ */}
      {showToolBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowToolBuilder(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Tool Builder Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <WrenchScrewdriverIcon className="w-5 h-5 text-purple-500" />
                  Endpoint Mapper & Tool Builder
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {configs.find(c => c.id === showToolBuilder)?.client_name} — Define the actions the AI can call on the client's API
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openAddTool} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">
                  <PlusIcon className="w-3.5 h-3.5" /> Add Tool
                </button>
                <button onClick={() => setShowToolBuilder(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <XMarkIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Tool List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {tools.length === 0 ? (
                <div className="text-center py-16">
                  <WrenchScrewdriverIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No tools defined yet</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add tools to define what actions the AI can call on the client's API.</p>
                  <button onClick={openAddTool} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                    <PlusIcon className="w-4 h-4" /> Add First Tool
                  </button>
                </div>
              ) : (
                tools.map((tool, index) => (
                  <div key={index} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100 dark:bg-emerald-900/30">
                        <BoltIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{tool.name}</h4>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            ⚡ Tool
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{tool.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400 mr-2">{tool.parameters.length} param(s)</span>
                        <button onClick={() => handleDuplicateTool(index)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors" title="Duplicate">
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditTool(index)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors" title="Edit">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTool(index)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors" title="Remove">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Parameters preview */}
                    {tool.parameters.length > 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex flex-wrap gap-2">
                          {tool.parameters.map((p, pi) => (
                            <span key={pi} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${p.required ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600'}`}>
                              {p.name}: <span className="text-gray-500 dark:text-gray-500">{p.type}</span>
                              {p.required && <span className="text-red-500">*</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Tool Builder Footer — Sync Button */}
            {tools.length > 0 && (
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{tools.length}</span> tool(s) •{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">{tools.length} tool{tools.length !== 1 ? 's' : ''} registered</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowToolBuilder(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleSyncTools} disabled={savingTools} className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors">
                      <ArrowPathIcon className={`w-4 h-4 ${savingTools ? 'animate-spin' : ''}`} />
                      {savingTools ? 'Syncing...' : 'Save & Sync Tools'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SUB-MODAL: Add / Edit Tool
         ══════════════════════════════════════════════════════════════════ */}
      {showToolForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowToolForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingTool !== null ? 'Edit Tool' : 'Add New Tool'}
              </h3>
              <button onClick={() => setShowToolForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Tool basics */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Function Name <span className="text-red-500">*</span></label>
                <input type="text" value={toolForm.name} onChange={e => setToolForm({ ...toolForm, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="getCustomerContext" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono" />
                <p className="text-xs text-gray-400 mt-1">Alphanumeric + underscore only</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea value={toolForm.description} onChange={e => setToolForm({ ...toolForm, description: e.target.value })} rows={2} placeholder="What does this endpoint do? The AI reads this to decide when to call it." className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>

              {/* Parameters */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel icon={CommandLineIcon} label="Parameters" badge={`${toolForm.parameters.length}`} />
                  <button type="button" onClick={openAddParam} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors">
                    <PlusIcon className="w-3 h-3" /> Add Parameter
                  </button>
                </div>
                {toolForm.parameters.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-center">
                    <p className="text-xs text-gray-400">No parameters yet — click "Add Parameter" above</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {toolForm.parameters.map((p, pi) => (
                      <div key={pi} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{p.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{p.type}</span>
                            {p.required && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">required</span>}
                            {p.enum && p.enum.length > 0 && <span className="text-xs text-purple-600 dark:text-purple-400">enum: {p.enum.join(', ')}</span>}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{p.description}</p>
                        </div>
                        <button onClick={() => openEditParam(pi)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><PencilIcon className="w-3.5 h-3.5 text-blue-500" /></button>
                        <button onClick={() => handleDeleteParam(pi)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><TrashIcon className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* JSON Preview */}
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium">Preview OpenAI JSON Format</summary>
                <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-40 overflow-y-auto font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(toolsToOpenAIFormat([toolForm])[0], null, 2)}
                </pre>
              </details>

              {/* Save / Cancel */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowToolForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleSaveTool} className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition-colors">
                  {editingTool !== null ? 'Update Tool' : 'Add Tool'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SUB-SUB-MODAL: Add / Edit Parameter
         ══════════════════════════════════════════════════════════════════ */}
      {showParamForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowParamForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {editingParam !== null ? 'Edit Parameter' : 'Add Parameter'}
              </h3>
              <button onClick={() => setShowParamForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
                <input type="text" value={paramForm.name} onChange={e => setParamForm({ ...paramForm, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="phone_number" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select value={paramForm.type} onChange={e => setParamForm({ ...paramForm, type: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="integer">integer</option>
                    <option value="boolean">boolean</option>
                    <option value="array">array</option>
                    <option value="object">object</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input type="checkbox" checked={paramForm.required} onChange={e => setParamForm({ ...paramForm, required: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" value={paramForm.description} onChange={e => setParamForm({ ...paramForm, description: e.target.value })} placeholder="Customer phone number" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Enum Values <span className="text-gray-400">(comma separated, optional)</span></label>
                <input type="text" value={(paramForm.enum || []).join(', ')} onChange={e => setParamForm({ ...paramForm, enum: e.target.value ? e.target.value.split(',').map(v => v.trim()).filter(Boolean) : undefined })} placeholder="leak, no_water, burst_pipe" className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-mono" />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setShowParamForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleSaveParam} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition-colors">
                  {editingParam !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Request Logs
         ══════════════════════════════════════════════════════════════════ */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowLogs(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-indigo-500" />
                Gateway Logs — {configs.find(c => c.id === showLogs)?.client_name || showLogs}
              </h2>
              <button onClick={() => setShowLogs(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16">
                  <ClockIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-gray-500 dark:text-gray-400">No request logs yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className={`p-4 rounded-xl border text-sm ${log.status_code >= 400 ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${log.status_code < 400 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                            {log.status_code}
                          </span>
                          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{log.action}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-mono">{log.duration_ms}ms</span>
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">Error: {log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Import Modal ───────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <ArrowUpTrayIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Gateway</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Upload a filled-in spec file, select a client, and optionally link an endpoint</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleImportSubmit} className="p-5 space-y-4">

              {/* Spec File Upload */}
              <div>
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={importFileInputRef}
                  onChange={handleSpecFileLoad}
                  className="hidden"
                />
                {importSpecData ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 truncate">{importSpecData.fileName}</p>
                      <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 space-y-0.5">
                        {importSpecData.base_url && <p>Base URL: <span className="font-mono">{importSpecData.base_url}</span></p>}
                        {importSpecData.auth_type && <p>Auth: {importSpecData.auth_type}</p>}
                        {importSpecData.shared_secret && <p>Secret: <span className="font-mono">{'•'.repeat(12)}</span></p>}
                        {importSpecData.available_actions.length > 0
                          ? <p>{importSpecData.available_actions.length} tool(s): {importSpecData.available_actions.join(', ')}</p>
                          : <p className="text-amber-600 dark:text-amber-400">No tools found in spec — add them via Tool Builder after creation.</p>
                        }
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setImportSpecData(null); setImportSelectedTools([]); if (importFileInputRef.current) importFileInputRef.current.value = ''; }}
                      className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => importFileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setImportDragOver(true); }}
                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setImportDragOver(true); }}
                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setImportDragOver(false); }}
                    onDrop={handleSpecFileDrop}
                    className={`w-full flex flex-col items-center justify-center gap-1.5 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                      importDragOver
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                        : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    <ArrowUpTrayIcon className="w-6 h-6" />
                    <span className="text-sm font-medium">{importDragOver ? 'Drop spec file here' : 'Drop spec file or click to browse'}</span>
                    <span className="text-xs opacity-60">Accepts .json — optional</span>
                  </div>
                )}
              </div>

              {/* Step 1: Client Account (required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">1</span>
                    Client Account <span className="text-red-500">*</span>
                  </span>
                </label>
                <select
                  value={importContactId}
                  onChange={e => { setImportContactId(e.target.value ? Number(e.target.value) : ''); setImportEndpointId(''); setImportAvailableTools([]); if (!importSpecData) setImportSelectedTools([]); }}
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm p-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a client account…</option>
                  {contacts.map(c => (
                    <option key={c.contact_id} value={c.contact_id}>
                      {c.contact_name || c.contact_email} (ID: {c.contact_id}){c.package_name ? ` — ${c.package_name}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The gateway will derive its client ID and name from this account. Package tier determines action capabilities.
                </p>
                {/* Existing gateway warning + mode picker */}
                {importContactId && configs.find(c => c.contact_id === Number(importContactId)) && (() => {
                  const eg = configs.find(c => c.contact_id === Number(importContactId))!;
                  const egTools = parseAllowedActions(eg);
                  return (
                    <div className="mt-2 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        ⚠️ Gateway already exists: <span className="font-mono">{eg.client_id}</span> ({egTools.length} tools)
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 mb-2">Choose how to handle the tool list:</p>
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="radio" name="importMode" value="merge" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="mt-0.5 accent-amber-600" />
                          <span className="text-xs text-amber-800 dark:text-amber-300">
                            <strong>Merge</strong> — add new tools to the existing {egTools.length} (recommended)
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="radio" name="importMode" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="mt-0.5 accent-amber-600" />
                          <span className="text-xs text-amber-800 dark:text-amber-300">
                            <strong>Replace</strong> — overwrite with only the tools in this spec file
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Step 2: Endpoint (required) */}
              {importContactId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">2</span>
                      Enterprise Endpoint <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </span>
                  </label>
                  <select
                    value={importEndpointId}
                    onChange={e => handleImportEndpointChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm p-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select an endpoint…</option>
                    {endpoints.map(ep => (
                      <option key={ep.id} value={ep.id}>
                        {ep.client_name || ep.id} ({ep.llm_provider} — {ep.llm_model})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Link an endpoint to load tools. You can connect or change this later.
                  </p>
                </div>
              )}

              {/* Step 3: Tool Picker */}
              {(importEndpointId || (!importEndpointId && importSpecData && importSpecData.available_actions.length > 0)) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold">3</span>
                      Enable Tools
                    </span>
                  </label>

                  {!importEndpointId && importSpecData && importSpecData.available_actions.length > 0 ? (
                    // Tools from uploaded spec file
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{importSelectedTools.length} of {importSpecData.available_actions.length} selected</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setImportSelectedTools(importSpecData!.available_actions)} className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">Select All</button>
                          <button type="button" onClick={() => setImportSelectedTools([])} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">Clear</button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {importSpecData.toolDetails.map(tool => (
                          <label key={tool.name} className="flex items-start gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={importSelectedTools.includes(tool.name)}
                              onChange={() => toggleImportTool(tool.name)}
                              className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">{tool.name}</p>
                              {tool.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tool.description}</p>}
                              {tool.paramCount > 0 && <p className="text-xs text-gray-400 dark:text-gray-500">{tool.paramCount} parameter{tool.paramCount !== 1 ? 's' : ''}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tools from spec file. Full schemas can be added via the Tool Builder after creation.</p>
                    </div>
                  ) : importLoadingTools ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" /> Loading tools from endpoint…
                    </div>
                  ) : importAvailableTools.length === 0 ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                        No tools configured on this endpoint. You can add tools later via the Tool Builder.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{importSelectedTools.length} of {importAvailableTools.length} selected</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setImportSelectedTools(importAvailableTools.map(t => t.name))} className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">Select All</button>
                          <button type="button" onClick={() => setImportSelectedTools([])} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">Clear</button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {importAvailableTools.map(tool => (
                          <label key={tool.name} className="flex items-start gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={importSelectedTools.includes(tool.name)}
                              onChange={() => toggleImportTool(tool.name)}
                              className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">{tool.name}</p>
                              {tool.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tool.description}</p>}
                              <p className="text-xs text-gray-400 dark:text-gray-500">{tool.paramCount} parameter{tool.paramCount !== 1 ? 's' : ''}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      {/* Info note */}
                      <div className="mt-2 rounded-lg p-2.5 text-xs flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                        <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>All selected tools will have <strong>full capability</strong>. Trial accounts are limited by free-tier resource caps only. Vision/file processing requires the <strong>Advanced</strong> package or higher.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {importError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                    {importError}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !importContactId}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
                >
                  {importing ? (
                    <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Creating…</>
                  ) : (
                    <><ArrowUpTrayIcon className="w-4 h-4" /> Create Gateway</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientApiConfigs;
