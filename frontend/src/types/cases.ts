/**
 * Case Types
 * TypeScript interfaces for the case management system
 */

export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type CaseSource = 'user_report' | 'auto_detected' | 'health_monitor' | 'ai_analysis';
export type CaseCategory = 'bug' | 'performance' | 'ui_issue' | 'data_issue' | 'security' | 'feature_request' | 'other';

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  category: CaseCategory;
  severity: CaseSeverity;
  status: CaseStatus;
  source: CaseSource;
  component_name?: string;
  component_path?: string;
  page_url?: string;
  page_path?: string;
  error_message?: string;
  error_stack?: string;
  browser_info?: string;
  tags?: string[];
  resolution?: string;
  user_rating?: number;
  user_feedback?: string;
  reported_by: number;
  assigned_to?: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  reporter_name?: string;
  reporter_email?: string;
  assignee_name?: string;
  assignee_email?: string;
}

export interface CaseComment {
  id: string;
  case_id: string;
  user_id: number;
  comment: string;
  is_internal: boolean;
  attachments?: string[];
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface CaseActivity {
  id: string;
  case_id: string;
  user_id: number;
  action: string;
  old_value?: string;
  new_value?: string;
  metadata?: Record<string, any>;
  created_at: string;
  user_name?: string;
}

export interface CaseCreateInput {
  title: string;
  description: string;
  category: CaseCategory;
  severity: CaseSeverity;
  page_url?: string;
  page_path?: string;
  error_message?: string;
  error_stack?: string;
  browser_info?: Record<string, any>;
  tags?: string[];
}

export interface CaseUpdateInput {
  title?: string;
  description?: string;
  severity?: CaseSeverity;
  status?: CaseStatus;
  assigned_to?: number;
  resolution?: string;
  tags?: string[];
}

export interface CaseAnalytics {
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  avgResolutionTime: string;
  bySeverity: { severity: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  recentTrend: { date: string; count: number }[];
}

export interface HealthCheck {
  id: string;
  check_type: string;
  check_name: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  response_time_ms: number | null;
  error_message: string | null;
  details: Record<string, any>;
  case_id: string | null;
  last_check: string | null;
  last_success: string | null;
  last_failure: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export interface HealthStatus {
  overall_status: 'healthy' | 'warning' | 'error';
  total_checks: number;
  healthy: number;
  warning: number;
  error: number;
  unknown: number;
  checks: HealthCheck[];
}
