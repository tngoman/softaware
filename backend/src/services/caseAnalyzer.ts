/**
 * Case Analyzer Service
 * 
 * Uses Ollama + Gemma 2 to analyze user-reported issues and identify
 * the specific component or code area related to the problem.
 */

import { Ollama } from 'ollama';
import { logAnonymizedChat } from '../utils/analyticsLogger.js';

const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

interface AnalysisContext {
  url?: string;
  page_path?: string;
  component_name?: string;
  description?: string;
  user_agent?: string;
}

interface ComponentAnalysis {
  likely_component: string;
  confidence: number;
  suggested_file_path?: string;
  related_components?: string[];
  analysis: string;
  troubleshooting_steps?: string[];
}

// Frontend component mapping based on routes
const COMPONENT_MAP: Record<string, string[]> = {
  '/dashboard': ['Dashboard.tsx', 'DashboardStats.tsx', 'RecentActivity.tsx'],
  '/admin': ['AdminDashboard.tsx', 'AIOverview.tsx', 'ClientManager.tsx', 'AIPackages.tsx', 'EnterpriseEndpoints.tsx'],
  '/admin/ai-overview': ['AIOverview.tsx', 'StatCard.tsx', 'StatusBadge.tsx'],
  '/admin/client-manager': ['ClientManager.tsx', 'StatusBadge.tsx'],
  '/admin/packages': ['AIPackages.tsx', 'Card.tsx'],
  '/admin/enterprise-endpoints': ['EnterpriseEndpoints.tsx', 'StatusBadge.tsx'],
  '/assistants': ['Dashboard.tsx', 'KnowledgeHealthBadge.tsx'],
  '/contacts': ['Contacts.tsx', 'ContactDetails.tsx'],
  '/invoices': ['Invoices.tsx', 'PaymentStatusBadge.tsx', 'EmailModal.tsx', 'PaymentModal.tsx'],
  '/quotations': ['Quotations.tsx', 'QuotationStatusBadge.tsx'],
  '/transactions': ['Transactions.tsx', 'DataTable.tsx'],
  '/expenses': ['AddExpense.tsx', 'ExpenseCategoryManager.tsx'],
  '/vat-reports': ['VatReports.tsx'],
  '/pricing': ['Pricing.tsx'],
  '/categories': ['Categories.tsx', 'ExpenseCategoryManager.tsx'],
  '/settings': ['Settings.tsx'],
  '/profile': ['Profile.tsx'],
  '/tasks': ['TasksPage.tsx', 'ExcalidrawDrawer.tsx'],
  '/login': ['Login.tsx'],
  '/register': ['Register.tsx'],
};

/**
 * Analyze component context using Gemma 2
 */
export async function analyzeComponentFromContext(context: AnalysisContext): Promise<ComponentAnalysis | null> {
  try {
    // Find likely components based on path
    let likelyComponents: string[] = [];
    if (context.page_path) {
      for (const [path, components] of Object.entries(COMPONENT_MAP)) {
        if (context.page_path.startsWith(path)) {
          likelyComponents = components;
          break;
        }
      }
    }
    
    const prompt = `You are a senior developer analyzing a bug report. Based on the following context, identify the likely React component and provide troubleshooting guidance.

Context:
- URL: ${context.url || 'N/A'}
- Page Path: ${context.page_path || 'N/A'}
- Reported Component: ${context.component_name || 'N/A'}
- Issue Description: ${context.description || 'N/A'}
- User Agent: ${context.user_agent || 'N/A'}
- Known components for this route: ${likelyComponents.join(', ') || 'Unknown'}

Provide a JSON response with:
1. likely_component: The most probable React component file name
2. confidence: Confidence score 0-100
3. suggested_file_path: Likely file path in the codebase
4. related_components: Array of other components that might be involved
5. analysis: Brief analysis of the issue
6. troubleshooting_steps: Array of suggested troubleshooting steps

Respond ONLY with valid JSON, no markdown formatting.`;

    const response = await ollama.chat({
      model: 'gemma2',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 500,
      },
    });
    
    const content = response.message.content.trim();

    logAnonymizedChat('case-analyzer', prompt.slice(0, 200), content.slice(0, 200), {
      source: 'case-analyzer', model: 'gemma2', provider: 'ollama',
    });
    
    // Try to extract JSON from response
    let jsonStr = content;
    if (content.includes('```json')) {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    } else if (content.includes('```')) {
      const match = content.match(/```\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }
    
    const analysis: ComponentAnalysis = JSON.parse(jsonStr);
    
    // Validate and enhance
    if (!analysis.likely_component && likelyComponents.length > 0) {
      analysis.likely_component = likelyComponents[0];
    }
    
    if (!analysis.confidence) {
      analysis.confidence = likelyComponents.length > 0 ? 70 : 40;
    }
    
    return analysis;
  } catch (err) {
    console.error('[CaseAnalyzer] Analysis failed:', err);
    
    // Fallback: use basic path matching
    if (context.page_path) {
      for (const [path, components] of Object.entries(COMPONENT_MAP)) {
        if (context.page_path.startsWith(path)) {
          return {
            likely_component: components[0],
            confidence: 60,
            suggested_file_path: `/var/opt/frontend/src/pages/${context.page_path.split('/')[1]}/${components[0]}`,
            related_components: components.slice(1),
            analysis: 'Component identified based on route matching (AI analysis unavailable)',
            troubleshooting_steps: [
              'Check browser console for errors',
              'Verify component props and state',
              'Test with different browsers',
              'Check API endpoint responses',
            ],
          };
        }
      }
    }
    
    return null;
  }
}

/**
 * Analyze error stack trace to pinpoint component
 */
export async function analyzeErrorStack(errorStack: string): Promise<ComponentAnalysis | null> {
  try {
    const prompt = `Analyze this JavaScript error stack trace and identify the component and issue:

\`\`\`
${errorStack}
\`\`\`

Provide JSON response with:
- likely_component: Component file name
- confidence: 0-100
- suggested_file_path: File path
- analysis: What the error means
- troubleshooting_steps: How to fix it

Respond with ONLY valid JSON.`;

    const response = await ollama.chat({
      model: 'gemma2',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.2 },
    });

    logAnonymizedChat('case-analyzer', prompt.slice(0, 200), response.message.content.slice(0, 200), {
      source: 'case-analyzer', model: 'gemma2', provider: 'ollama',
    });
    
    let jsonStr = response.message.content.trim();
    if (jsonStr.includes('```json')) {
      const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }
    
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[CaseAnalyzer] Stack analysis failed:', err);
    return null;
  }
}
