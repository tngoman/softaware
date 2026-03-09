// Export all models for easy importing
export { AuthModel } from './AuthModel';
export { ContactModel } from './ContactModel';
export { QuotationModel } from './QuotationModel';
export { InvoiceModel } from './InvoiceModel';
export { TransactionModel } from './TransactionModel';
export { PaymentModel } from './OtherModels';
export { FinancialReportModel } from './OtherModels';
export { CredentialModel } from './CredentialModel';
export type { Credential, CreateCredentialData, UpdateCredentialData } from './CredentialModel';
export { default as AppSettingsModel } from './AppSettingsModel';
export { NotificationModel } from './NotificationModel';
export type { Notification } from './NotificationModel';

// System models (separate from app models)
export { 
  UserModel as SystemUserModel, 
  RoleModel as SystemRoleModel, 
  PermissionModel as SystemPermissionModel,
  SystemSettingModel
} from './SystemModels';
export type { User, Role, Permission, SystemSetting } from './SystemModels';

export {
  PricingModel,
  UserModel,
  RoleModel,
  CategoryModel,
  SettingsModel,
  AccountModel,
  LedgerModel,
  ReportModel,
  ExpenseCategoryModel,
  VatPeriodModel,
  VatReportModel
} from './OtherModels';

// Admin AI models
export {
  AdminClientModel,
  AdminEnterpriseModel,
  AdminCreditsModel,
  AdminConfigModel,
} from './AdminAIModels';
export type {
  EnterpriseEndpoint,
  EndpointCreateInput,
  RequestLog,
  ClientOverview,
  CreditPackage,
  CreditBalance,
  SystemStats,
} from './AdminAIModels';

// Case Management
export { CaseModel } from './CaseModel';

// Team Chat
export { TeamChatModel } from './TeamChatModel';
export type { TeamChat, TeamChatMember, TeamChatMessage, AvailableUser } from './TeamChatModel';

// Webmail
export { WebmailAccountModel, WebmailModel, WebmailSettingsModel } from './WebmailModel';
export type {
  MailboxAccount, CreateMailboxInput, WebmailDomainSettings, MailFolder, MailAddress,
  MailMessageHeader, MailMessage, MailAttachment, ConnectionTestResult,
  MessageListResponse,
} from './WebmailModel';

// Local Tasks (synced from external sources)
export { LocalTasksModel } from './LocalTasksModel';
