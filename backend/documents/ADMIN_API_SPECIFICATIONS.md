# Backend API Specifications for Admin Features
## RESTful Endpoints for Admin Panel Integration

**Document Version**: 1.0  
**Created**: March 1, 2026  
**Target**: `/var/opt/backend` API Routes  
**Base URL**: `http://localhost:3001/api`

---

## API Overview

All admin endpoints must be protected by authentication and authorization middleware.

**Authentication**: Bearer token in `Authorization` header  
**Authorization**: Admin role required for all `/admin/*` endpoints  
**Response Format**: JSON  
**Error Format**: Consistent error responses with status codes

---

## Global Response Format

### Success Response (2xx)
```json
{
  "success": true,
  "data": { /* resource data */ },
  "message": "Operation successful"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 0,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Error Response (4xx/5xx)
```json
{
  "success": false,
  "error": "Error code",
  "message": "Descriptive error message",
  "details": { /* optional additional context */ }
}
```

---

## Admin Authentication

### Middleware Requirements
All admin endpoints require:
1. Valid JWT token in Authorization header
2. Admin role verification
3. Audit logging of admin actions

### Role Check
```typescript
// Backend middleware
if (!user.is_admin) {
  throw forbiddenError('Admin access required');
}
```

---

## Dashboard Endpoints

### GET /admin/dashboard/stats
**Purpose**: Fetch KPI statistics for dashboard

**Query Parameters**: None

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalWorkspaces": 42,
    "activeTeams": 28,
    "totalCreditsIssued": 150000,
    "totalCreditsUsed": 45000,
    "pendingTransactions": 3,
    "revenueThisMonth": 12500,
    "newWorkspacesThisMonth": 5
  }
}
```

**Errors**:
- 401: Unauthorized
- 403: Admin access required

---

### GET /admin/dashboard/activity
**Purpose**: Fetch recent admin activity and events

**Query Parameters**:
```
limit?: number (default: 20, max: 100)
offset?: number (default: 0)
type?: string (comma-separated: workspace_created, key_generated, credits_adjusted, plan_updated)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_123",
      "type": "workspace_created",
      "description": "Workspace 'Acme Corp' created",
      "actor": "admin@example.com",
      "createdAt": "2026-03-01T10:30:00Z",
      "metadata": {
        "workspaceId": "ws_123",
        "workspaceName": "Acme Corp"
      }
    },
    {
      "id": "evt_124",
      "type": "credits_adjusted",
      "description": "1000 credits added to Acme Corp (+10%)",
      "actor": "admin@example.com",
      "createdAt": "2026-03-01T09:15:00Z",
      "metadata": {
        "teamId": "team_123",
        "amount": 1000,
        "adjusterType": "BONUS"
      }
    }
  ],
  "pagination": {
    "total": 245,
    "page": 0,
    "limit": 20,
    "pages": 13
  }
}
```

---

## Workspace Management Endpoints

### GET /admin/workspaces
**Purpose**: List all workspaces with pagination

**Query Parameters**:
```
page?: number (default: 0)
limit?: number (default: 20, max: 100)
search?: string (search by name, owner email)
status?: string (active | inactive | archived)
sortBy?: string (name | createdAt | updatedAt, default: createdAt)
sortOrder?: string (asc | desc, default: desc)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "ws_123",
      "name": "Acme Corporation",
      "description": "Main workspace for Acme Corp",
      "owner": {
        "id": "user_456",
        "name": "John Doe",
        "email": "john@acme.com"
      },
      "memberCount": 5,
      "createdAt": "2025-12-01T08:00:00Z",
      "updatedAt": "2026-02-28T15:30:00Z",
      "status": "active"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 0,
    "limit": 20,
    "pages": 3
  }
}
```

**Errors**:
- 401: Unauthorized
- 403: Admin access required

---

### POST /admin/workspaces
**Purpose**: Create new workspace

**Request Body**:
```json
{
  "name": "New Company Inc",
  "description": "Optional description",
  "ownerId": "user_789"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "ws_999",
    "name": "New Company Inc",
    "description": "Optional description",
    "owner": {
      "id": "user_789",
      "name": "Jane Smith",
      "email": "jane@newco.com"
    },
    "memberCount": 1,
    "createdAt": "2026-03-01T11:00:00Z",
    "updatedAt": "2026-03-01T11:00:00Z",
    "status": "active"
  }
}
```

**Errors**:
- 400: Invalid input (missing name, etc.)
- 401: Unauthorized
- 403: Admin access required
- 409: Workspace name already exists

---

### GET /admin/workspaces/:id
**Purpose**: Get specific workspace details

**Path Parameters**:
```
id: string (workspace ID)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "ws_123",
    "name": "Acme Corporation",
    "description": "Main workspace",
    "owner": {
      "id": "user_456",
      "name": "John Doe",
      "email": "john@acme.com"
    },
    "members": [
      {
        "id": "user_456",
        "name": "John Doe",
        "email": "john@acme.com",
        "role": "owner"
      },
      {
        "id": "user_789",
        "name": "Jane Smith",
        "email": "jane@acme.com",
        "role": "admin"
      }
    ],
    "memberCount": 5,
    "createdAt": "2025-12-01T08:00:00Z",
    "updatedAt": "2026-02-28T15:30:00Z",
    "status": "active",
    "stats": {
      "totalCredits": 50000,
      "creditsUsed": 12000,
      "activeTeams": 2,
      "activeKeys": 3
    }
  }
}
```

**Errors**:
- 401: Unauthorized
- 403: Admin access required
- 404: Workspace not found

---

### PUT /admin/workspaces/:id
**Purpose**: Update workspace details

**Request Body**:
```json
{
  "name": "Updated Company Name",
  "description": "Updated description",
  "status": "active"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "ws_123",
    "name": "Updated Company Name",
    "description": "Updated description",
    "status": "active",
    "updatedAt": "2026-03-01T12:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid input
- 401: Unauthorized
- 403: Admin access required
- 404: Workspace not found
- 409: Conflict (e.g., duplicate name)

---

### DELETE /admin/workspaces/:id
**Purpose**: Delete workspace (soft delete)

**Query Parameters**:
```
permanent?: boolean (false = soft delete, true = permanent, default: false)
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Workspace deleted successfully"
}
```

**Errors**:
- 401: Unauthorized
- 403: Admin access required (permanent delete requires extra confirmation)
- 404: Workspace not found

---

## Activation Keys Endpoints

### GET /admin/activation-keys
**Purpose**: List all activation keys

**Query Parameters**:
```
page?: number (default: 0)
limit?: number (default: 20)
status?: string (active | revoked)
tier?: string (PERSONAL | PROFESSIONAL | ENTERPRISE)
search?: string (search by code)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "key_123",
      "code": "ACM-E-CORP-2024-A1B2C3D4E5",
      "tier": "PROFESSIONAL",
      "features": {
        "cloudSync": true,
        "vault": true
      },
      "limits": {
        "maxAgents": 50,
        "maxUsers": 25
      },
      "createdAt": "2025-12-01T10:00:00Z",
      "revokedAt": null,
      "status": "active",
      "usageStats": {
        "activations": 1,
        "lastUsed": "2026-02-28T14:30:00Z"
      }
    }
  ],
  "pagination": {
    "total": 87,
    "page": 0,
    "limit": 20,
    "pages": 5
  }
}
```

---

### POST /admin/activation-keys
**Purpose**: Generate new activation key

**Request Body**:
```json
{
  "tier": "PROFESSIONAL",
  "cloudSyncAllowed": true,
  "vaultAllowed": true,
  "maxAgents": 50,
  "maxUsers": 25,
  "description": "Optional: Acme Corp License"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "key_999",
    "code": "ACM-E-NEW-2026-X9Y8Z7W6V5",
    "tier": "PROFESSIONAL",
    "features": {
      "cloudSync": true,
      "vault": true
    },
    "limits": {
      "maxAgents": 50,
      "maxUsers": 25
    },
    "createdAt": "2026-03-01T13:00:00Z",
    "status": "active"
  }
}
```

**Errors**:
- 400: Invalid tier or parameters
- 401: Unauthorized
- 403: Admin access required

---

### DELETE /admin/activation-keys/:id
**Purpose**: Revoke activation key

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Activation key revoked successfully",
  "data": {
    "id": "key_123",
    "revokedAt": "2026-03-01T14:00:00Z",
    "status": "revoked"
  }
}
```

**Errors**:
- 401: Unauthorized
- 403: Admin access required
- 404: Key not found
- 409: Key already revoked

---

### GET /admin/activation-keys/:id/usage
**Purpose**: Get key usage statistics

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "keyId": "key_123",
    "totalActivations": 12,
    "activeTeams": 8,
    "usageTimeline": [
      {
        "date": "2026-02-01",
        "activations": 2
      },
      {
        "date": "2026-02-02",
        "activations": 3
      }
    ],
    "lastUsed": "2026-02-28T14:30:00Z",
    "createdAt": "2025-12-01T10:00:00Z"
  }
}
```

---

## Subscription Plans Endpoints

### GET /admin/subscription-plans
**Purpose**: List all subscription plans

**Query Parameters**:
```
page?: number (default: 0)
limit?: number (default: 20)
tier?: string (BYOE | MANAGED | ENTERPRISE)
status?: string (active | inactive)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "plan_123",
      "name": "Professional Monthly",
      "tier": "MANAGED",
      "pricing": {
        "monthly": 4900,
        "annually": 49000
      },
      "trialDays": 14,
      "features": {
        "maxKnowledgePages": 50000,
        "loopbackAPIIncluded": true,
        "automatedDocSync": true,
        "dedicatedVectorInfra": false,
        "onPremiseDeployment": false,
        "prioritySupport": true,
        "slaGuarantees": false
      },
      "description": "Perfect for growing teams",
      "isActive": true,
      "createdAt": "2025-06-01T08:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 0,
    "limit": 20,
    "pages": 1
  }
}
```

---

### POST /admin/subscription-plans
**Purpose**: Create new subscription plan

**Request Body**:
```json
{
  "name": "Enterprise Annual",
  "tier": "ENTERPRISE",
  "pricing": {
    "monthly": 9900,
    "annually": 99000
  },
  "trialDays": 30,
  "features": {
    "maxKnowledgePages": -1,
    "loopbackAPIIncluded": true,
    "automatedDocSync": true,
    "dedicatedVectorInfra": true,
    "onPremiseDeployment": true,
    "prioritySupport": true,
    "slaGuarantees": true
  },
  "description": "Unlimited everything",
  "isActive": true
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "plan_999",
    "name": "Enterprise Annual",
    "tier": "ENTERPRISE",
    "pricing": {
      "monthly": 9900,
      "annually": 99000
    },
    "features": {
      "maxKnowledgePages": -1,
      "loopbackAPIIncluded": true,
      "automatedDocSync": true,
      "dedicatedVectorInfra": true,
      "onPremiseDeployment": true,
      "prioritySupport": true,
      "slaGuarantees": true
    },
    "isActive": true,
    "createdAt": "2026-03-01T15:00:00Z"
  }
}
```

---

### PUT /admin/subscription-plans/:id
**Purpose**: Update subscription plan

**Request Body**:
```json
{
  "name": "Updated Plan Name",
  "pricing": {
    "monthly": 5900,
    "annually": 59000
  },
  "features": {
    "prioritySupport": true
  },
  "isActive": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "plan_123",
    "name": "Updated Plan Name",
    "pricing": {
      "monthly": 5900,
      "annually": 59000
    },
    "updatedAt": "2026-03-01T15:30:00Z"
  }
}
```

---

### DELETE /admin/subscription-plans/:id
**Purpose**: Delete subscription plan

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Plan deleted successfully"
}
```

**Errors**:
- 409: Cannot delete plan if active subscriptions exist

---

## Credit Management Endpoints

### GET /admin/credits/teams
**Purpose**: List teams with credit balances

**Query Parameters**:
```
page?: number (default: 0)
limit?: number (default: 20)
search?: string (search by team name, email)
sortBy?: string (name | balance | createdAt, default: name)
sortOrder?: string (asc | desc)
minBalance?: number (filter by minimum balance)
maxBalance?: number (filter by maximum balance)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "team_123",
      "name": "Acme Corp",
      "email": "billing@acme.com",
      "balance": 35000,
      "currency": "ZAR",
      "updatedAt": "2026-02-28T20:00:00Z",
      "lastTransaction": "2026-02-28T18:30:00Z",
      "usageThisMonth": 5000,
      "status": "active"
    }
  ],
  "pagination": {
    "total": 156,
    "page": 0,
    "limit": 20,
    "pages": 8
  }
}
```

---

### GET /admin/credits/teams/:teamId/balance
**Purpose**: Get current balance for specific team

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "teamId": "team_123",
    "balance": 35000,
    "currency": "ZAR",
    "updatedAt": "2026-02-28T20:00:00Z",
    "usageThisMonth": 5000,
    "usageThisYear": 45000,
    "lastTransactionDate": "2026-02-28T18:30:00Z",
    "balanceHistory": [
      {
        "date": "2026-02-28",
        "balance": 35000
      },
      {
        "date": "2026-02-27",
        "balance": 37500
      }
    ]
  }
}
```

---

### GET /admin/credits/teams/:teamId/transactions
**Purpose**: Get transaction history for team

**Query Parameters**:
```
page?: number (default: 0)
limit?: number (default: 20)
type?: string (PURCHASE | USAGE | BONUS | REFUND | ADJUSTMENT)
startDate?: string (ISO 8601)
endDate?: string (ISO 8601)
sortBy?: string (date | amount, default: date)
sortOrder?: string (asc | desc, default: desc)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "txn_123",
      "teamId": "team_123",
      "amount": 2500,
      "type": "USAGE",
      "description": "API request usage for 2026-02-28",
      "createdAt": "2026-02-28T18:30:00Z",
      "balanceBefore": 37500,
      "balanceAfter": 35000,
      "actor": null,
      "metadata": {
        "requestCount": 2500,
        "averageCost": 1.0
      }
    },
    {
      "id": "txn_124",
      "teamId": "team_123",
      "amount": 10000,
      "type": "PURCHASE",
      "description": "Credit package purchase",
      "createdAt": "2026-02-27T12:00:00Z",
      "balanceBefore": 27500,
      "balanceAfter": 37500,
      "metadata": {
        "packageId": "pkg_456",
        "paymentId": "pay_789"
      }
    }
  ],
  "pagination": {
    "total": 245,
    "page": 0,
    "limit": 20,
    "pages": 13
  }
}
```

---

### POST /admin/credits/adjust
**Purpose**: Manual credit adjustment (bonus, refund, or correction)

**Request Body**:
```json
{
  "teamId": "team_123",
  "amount": 5000,
  "type": "BONUS",
  "description": "Customer appreciation bonus",
  "reason": "High-value customer retention",
  "approvedBy": "admin@company.com"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_999",
    "teamId": "team_123",
    "amount": 5000,
    "type": "BONUS",
    "description": "Customer appreciation bonus",
    "balanceBefore": 35000,
    "balanceAfter": 40000,
    "createdAt": "2026-03-01T16:00:00Z",
    "createdBy": "admin@company.com"
  }
}
```

**Errors**:
- 400: Invalid amount or type
- 401: Unauthorized
- 403: Admin access required
- 404: Team not found

---

## Credit Packages Endpoints

### GET /admin/credit-packages
**Purpose**: List credit packages

**Query Parameters**:
```
page?: number (default: 0)
limit?: number (default: 20)
featured?: boolean
active?: boolean (default: true)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "pkg_123",
      "name": "Starter Pack",
      "description": "Perfect for getting started",
      "credits": 1000,
      "price": 2999,
      "currency": "ZAR",
      "bonusCredits": 100,
      "featured": true,
      "createdAt": "2025-06-01T08:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "page": 0,
    "limit": 20,
    "pages": 1
  }
}
```

---

### POST /admin/credit-packages
**Purpose**: Create new credit package

**Request Body**:
```json
{
  "name": "Premium Bundle",
  "description": "Large credit bundle with bonus",
  "credits": 10000,
  "price": 24990,
  "bonusCredits": 2000,
  "featured": false
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "pkg_999",
    "name": "Premium Bundle",
    "description": "Large credit bundle with bonus",
    "credits": 10000,
    "price": 24990,
    "bonusCredits": 2000,
    "featured": false,
    "createdAt": "2026-03-01T16:30:00Z"
  }
}
```

---

### PUT /admin/credit-packages/:id
**Purpose**: Update credit package

**Request Body**:
```json
{
  "name": "Updated Package Name",
  "price": 29990,
  "bonusCredits": 3000,
  "featured": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "pkg_123",
    "name": "Updated Package Name",
    "price": 29990,
    "bonusCredits": 3000,
    "featured": true,
    "updatedAt": "2026-03-01T17:00:00Z"
  }
}
```

---

### DELETE /admin/credit-packages/:id
**Purpose**: Delete credit package

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Package deleted successfully"
}
```

---

## Pricing Configuration Endpoints

### GET /admin/pricing
**Purpose**: Get all pricing rules

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "type": "TEXT_SIMPLE",
      "baseCost": 50,
      "perTokenCost": 10,
      "label": "Simple Text",
      "description": "Quick single-prompt AI requests",
      "lastUpdated": "2026-02-15T10:00:00Z"
    },
    {
      "type": "TEXT_CHAT",
      "baseCost": 100,
      "perTokenCost": 20,
      "label": "Full Chat",
      "description": "Conversational AI with history context",
      "lastUpdated": "2026-02-15T10:00:00Z"
    },
    {
      "type": "CODE_AGENT_EXECUTE",
      "baseCost": 200,
      "perTokenCost": 30,
      "label": "Code Agent",
      "description": "Code generation and execution",
      "lastUpdated": "2026-02-15T10:00:00Z"
    },
    {
      "type": "FILE_OPERATION",
      "baseCost": 75,
      "perTokenCost": null,
      "label": "File Operation",
      "description": "File read/write operations via MCP",
      "lastUpdated": "2026-02-15T10:00:00Z"
    },
    {
      "type": "MCP_TOOL",
      "baseCost": 150,
      "perTokenCost": null,
      "label": "MCP Tool",
      "description": "MCP tool invocation calls",
      "lastUpdated": "2026-02-15T10:00:00Z"
    }
  ]
}
```

---

### PUT /admin/pricing/:type
**Purpose**: Update pricing for specific request type

**Request Body**:
```json
{
  "baseCost": 60,
  "perTokenCost": 12
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "type": "TEXT_SIMPLE",
    "baseCost": 60,
    "perTokenCost": 12,
    "label": "Simple Text",
    "lastUpdated": "2026-03-01T17:30:00Z"
  }
}
```

**Errors**:
- 400: Invalid pricing values (must be positive)
- 401: Unauthorized
- 403: Admin access required
- 404: Pricing type not found

---

## System Configuration Endpoints

### GET /admin/config
**Purpose**: Get all system configuration

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "payment": {
      "stripe": {
        "enabled": true,
        "apiKeyPrefix": "sk_live_***",
        "configuredAt": "2025-06-01T08:00:00Z"
      },
      "paypal": {
        "enabled": false,
        "configuredAt": null
      }
    },
    "ai_providers": {
      "openai": {
        "enabled": true,
        "model": "gpt-4-turbo",
        "configuredAt": "2025-06-01T08:00:00Z"
      },
      "anthropic": {
        "enabled": true,
        "model": "claude-3-opus",
        "configuredAt": "2025-06-01T08:00:00Z"
      }
    },
    "system": {
      "site_name": "SoftAware Billing",
      "site_url": "https://billing.softaware.co.za",
      "support_email": "support@softaware.co.za",
      "from_email": "noreply@softaware.co.za"
    }
  }
}
```

---

### GET /admin/config/:category
**Purpose**: Get configuration for specific category

**Path Parameters**:
```
category: string (payment | ai_providers | system)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "stripe": {
      "enabled": true,
      "apiKeyPrefix": "sk_live_***",
      "configuredAt": "2025-06-01T08:00:00Z"
    },
    "paypal": {
      "enabled": false,
      "configuredAt": null
    }
  }
}
```

---

### PUT /admin/config/:category
**Purpose**: Update configuration for category

**Request Body** (example for payment):
```json
{
  "stripe": {
    "enabled": true,
    "apiKey": "sk_live_..."
  },
  "paypal": {
    "enabled": true,
    "clientId": "...",
    "secret": "..."
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "data": {
    "stripe": {
      "enabled": true,
      "apiKeyPrefix": "sk_live_***",
      "configuredAt": "2026-03-01T18:00:00Z"
    }
  }
}
```

**Errors**:
- 400: Invalid configuration
- 401: Unauthorized
- 403: Admin access required
- 422: Validation failed (e.g., invalid API key format)

---

## Error Codes

### HTTP Status Codes
- **200 OK** - Successful GET, PUT
- **201 Created** - Successful POST
- **400 Bad Request** - Invalid input or request
- **401 Unauthorized** - Missing/invalid token
- **403 Forbidden** - Admin access required
- **404 Not Found** - Resource not found
- **409 Conflict** - Duplicate or constraint violation
- **422 Unprocessable Entity** - Validation error
- **500 Internal Server Error** - Server error

### Error Response Examples

#### 400 Bad Request
```json
{
  "success": false,
  "error": "INVALID_INPUT",
  "message": "Missing required field: name",
  "details": {
    "field": "name",
    "reason": "required"
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid authorization token"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Admin access required"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Workspace not found",
  "details": {
    "resourceType": "workspace",
    "resourceId": "ws_123"
  }
}
```

#### 409 Conflict
```json
{
  "success": false,
  "error": "CONFLICT",
  "message": "Workspace name already exists",
  "details": {
    "conflictingField": "name",
    "value": "Duplicate Name"
  }
}
```

---

## Rate Limiting

All admin endpoints should implement rate limiting:

**Admin Endpoints**: 
- 1000 requests per hour per admin user
- 10 requests per second burst limit

**Response Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1646083200
```

**Rate Limit Exceeded** (429):
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

## Audit Logging

All admin operations should be logged:

**Logged Information**:
- Admin user ID
- Action type (CREATE, UPDATE, DELETE)
- Resource type and ID
- Timestamp
- IP address
- Request/response summary
- Status (success/failure)

**Log Entry Example**:
```json
{
  "timestamp": "2026-03-01T18:00:00Z",
  "adminId": "user_123",
  "action": "CREATE",
  "resourceType": "workspace",
  "resourceId": "ws_999",
  "status": "success",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

---

## API Versioning

Current API Version: **v1**  
Base URL: `https://api.softaware.co.za/v1`

Future versioning approach:
- Maintain backward compatibility where possible
- Version in URL path: `/v2/admin/...`
- Deprecation headers in responses

---

**Document prepared by**: Development Team  
**Last Updated**: March 1, 2026  
**Status**: Ready for Backend Development
