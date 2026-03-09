/**
 * Seed Silulumanzi Enterprise Endpoint
 *
 * Migrates the hardcoded /silulumanzi endpoint to the dynamic enterprise webhook system.
 * Run once: node dist/scripts/seedSilulumanzi.js
 */

import { createEndpoint, getEndpointsByClient } from '../services/enterpriseEndpoints.js';
import fs from 'fs';
import path from 'path';

// Load the knowledge base (same as the hardcoded endpoint used)
const knowledgeBasePath = path.resolve('/var/opt/backend/images/extracted/_knowledge_base.txt');
let knowledgeBase = '';

try {
  if (fs.existsSync(knowledgeBasePath)) {
    knowledgeBase = fs.readFileSync(knowledgeBasePath, 'utf-8');
    console.log(`[Seed] Loaded knowledge base: ${knowledgeBase.length} chars`);
  } else {
    console.warn('[Seed] Knowledge base file not found, using empty knowledge');
  }
} catch (err) {
  console.error('[Seed] Failed to load knowledge base:', err);
}

// Tool definitions (from the hardcoded chat.ts route)
const tools = [
  {
    type: 'function',
    function: {
      name: 'getCustomerContext',
      description: 'Fetch customer account information by phone number',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'Customer phone number' }
        },
        required: ['phone_number']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'checkAreaOutages',
      description: 'Check for water outages in a specific area',
      parameters: {
        type: 'object',
        properties: {
          area: { type: 'string', description: 'Area or suburb name' }
        },
        required: ['area']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reportFault',
      description: 'Report a water fault (leak, no water, low pressure, burst pipe)',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string' },
          description: { type: 'string', description: 'Fault description' },
          faultType: { type: 'string', enum: ['leak', 'no_water', 'low_pressure', 'burst_pipe', 'other'] },
          address: { type: 'string', description: 'Property address' },
          property_id: { type: 'number', description: 'Property ID if at registered property' }
        },
        required: ['phone_number', 'description', 'faultType', 'address']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getFaultStatus',
      description: 'Check the status of a reported fault by reference number',
      parameters: {
        type: 'object',
        properties: {
          faultReference: { type: 'string', description: 'Fault reference number' }
        },
        required: ['faultReference']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getFinancials',
      description: 'Get account balance and payment history',
      parameters: {
        type: 'object',
        properties: {
          accountNumber: { type: 'string', description: 'Customer account number' }
        },
        required: ['accountNumber']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getStatements',
      description: 'Get recent account statements',
      parameters: {
        type: 'object',
        properties: {
          accountNumber: { type: 'string' }
        },
        required: ['accountNumber']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getMaintenanceActivities',
      description: 'Get scheduled maintenance activities in an area',
      parameters: {
        type: 'object',
        properties: {
          area: { type: 'string' }
        },
        required: ['area']
      }
    }
  }
];

// System prompt (from the hardcoded endpoint)
const systemPrompt = `You are the Silulumanzi customer service assistant, helping customers with water services in Mpumalanga, South Africa.

CUSTOMER DATA: Will be injected by the AiClient.php getCustomerContext tool call.

KNOWLEDGE BASE:
${knowledgeBase}

RULES:
- Be concise, professional, and empathetic
- Always address customers by name if available
- Match the customer's language (isiZulu, English, Afrikaans, isiXhosa)
- Never share internal IDs (property_id, CUSTOMER_ID, CUSTKEY)
- Never share system field names (CONN_DTL, OPER_APPLICATIONS)
- You MAY share fault reference numbers returned from reportFault
- For fault reporting at registered properties, confirm the address first
- If no registered property, ask for the address

FAULT REPORTING PROCEDURE:
1. If customer has a registered property, ask: "Is this issue at [registered address]?"
2. If YES → call reportFault with property_id
3. If NO or no registered property → ask for the address, then call reportFault without property_id`;

// Check if endpoint already exists
const existing = getEndpointsByClient('silulumanzi');
if (existing.length > 0) {
  console.log(`[Seed] Silulumanzi endpoint already exists: ${existing[0].id}`);
  console.log(`  URL: POST /api/v1/webhook/${existing[0].id}`);
  process.exit(0);
}

// Create the endpoint
const endpoint = createEndpoint({
  client_id: 'silulumanzi',
  client_name: 'Silulumanzi Water Services',
  inbound_provider: 'custom_rest',  // Supports WhatsApp, web, SMS via payload normalization
  llm_provider: 'ollama',  // Using local Ollama instead of OpenRouter (API key expired)
  llm_model: 'qwen2.5:3b-instruct',
  llm_system_prompt: systemPrompt,
  llm_tools_config: JSON.stringify(tools),
  target_api_url: 'https://softaware.net.za/AiClient.php',
  target_api_auth_type: 'custom',  // Uses SHA-256 daily rotating token in the PHP API
  target_api_auth_value: ''  // The AiClient.php validates via shared secret + date hash
});

console.log('[Seed] ✅ Silulumanzi endpoint created successfully!');
console.log(`  Endpoint ID: ${endpoint.id}`);
console.log(`  Webhook URL: POST https://mcp.softaware.net.za/api/v1/webhook/${endpoint.id}`);
console.log(`  Status: ${endpoint.status}`);
console.log(`  LLM: ${endpoint.llm_provider} (${endpoint.llm_model})`);
console.log(`  Tools: ${tools.length} configured`);
console.log('\nUpdate your WhatsApp/web chat client to use the new webhook URL.');
