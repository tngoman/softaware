import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { env } from '../config/env.js';

export const adminConfigRouter = Router();

// All routes require admin authentication
adminConfigRouter.use(requireAuth, requireAdmin);

// ============================================
// Payment Gateway Configuration
// ============================================

/**
 * GET /admin/config/payment-gateways
 * Get payment gateway configuration status
 */
adminConfigRouter.get('/payment-gateways', async (req, res, next) => {
  try {
    const gateways = [
      {
        provider: 'PAYFAST',
        name: 'PayFast',
        enabled: !!(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY),
        configured: !!(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY),
        settings: {
          merchantId: process.env.PAYFAST_MERCHANT_ID ? '***' + process.env.PAYFAST_MERCHANT_ID.slice(-4) : null,
          hasMerchantKey: !!process.env.PAYFAST_MERCHANT_KEY,
          hasPassphrase: !!process.env.PAYFAST_PASSPHRASE,
          testMode: process.env.PAYFAST_TEST_MODE === 'true',
        },
      },
      {
        provider: 'YOCO',
        name: 'Yoco',
        enabled: !!process.env.YOCO_SECRET_KEY,
        configured: !!process.env.YOCO_SECRET_KEY,
        settings: {
          hasSecretKey: !!process.env.YOCO_SECRET_KEY,
          hasPublicKey: !!process.env.YOCO_PUBLIC_KEY,
          hasWebhookSecret: !!process.env.YOCO_WEBHOOK_SECRET,
          testMode: process.env.YOCO_TEST_MODE === 'true',
        },
      },
      {
        provider: 'MANUAL',
        name: 'Manual Payment',
        enabled: true,
        configured: true,
        settings: {
          note: 'Always available for manual admin processing',
        },
      },
    ];

    res.json({
      success: true,
      gateways,
      note: 'Payment gateway credentials are configured via environment variables. Update .env file to change settings.',
    });
  } catch (error) {
    next(error);
  }
});

const TestGatewaySchema = z.object({
  provider: z.enum(['PAYFAST', 'YOCO']),
});

/**
 * POST /admin/config/payment-gateways/test
 * Test payment gateway connection
 */
adminConfigRouter.post('/payment-gateways/test', async (req, res, next) => {
  try {
    const { provider } = TestGatewaySchema.parse(req.body);

    let testResult = { success: false, message: '', error: '' };

    if (provider === 'YOCO') {
      const secretKey = process.env.YOCO_SECRET_KEY;
      if (!secretKey) {
        return res.json({
          success: false,
          error: 'Yoco secret key not configured',
        });
      }

      try {
        // Test Yoco API with a simple request
        const response = await fetch('https://payments.yoco.com/api/checkouts', {
          method: 'OPTIONS',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
          },
        });

        testResult = {
          success: response.ok || response.status === 405, // OPTIONS might return 405 but connection is valid
          message: response.ok ? 'Yoco API connection successful' : 'Yoco API reachable',
          error: '',
        };
      } catch (error: any) {
        testResult = {
          success: false,
          message: '',
          error: error.message || 'Failed to connect to Yoco API',
        };
      }
    } else if (provider === 'PAYFAST') {
      const merchantId = process.env.PAYFAST_MERCHANT_ID;
      const merchantKey = process.env.PAYFAST_MERCHANT_KEY;

      if (!merchantId || !merchantKey) {
        return res.json({
          success: false,
          error: 'PayFast credentials not configured',
        });
      }

      testResult = {
        success: true,
        message: 'PayFast credentials are configured. Live connection test not available.',
        error: '',
      };
    }

    res.json({
      success: testResult.success,
      provider,
      message: testResult.message,
      error: testResult.error,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// AI Provider Configuration
// ============================================

/**
 * GET /admin/config/ai-providers
 * Get AI provider configuration
 */
adminConfigRouter.get('/ai-providers', async (req, res, next) => {
  try {
    const providers = [
      {
        provider: 'glm',
        name: 'GLM (ZhipuAI)',
        enabled: !!env.GLM,
        configured: !!env.GLM,
        settings: {
          hasApiKey: !!env.GLM,
          apiKeyPreview: env.GLM ? '***' + env.GLM.slice(-4) : null,
          defaultTextModel: 'glm-4-plus',
          defaultVisionModel: env.GLM_VISION_MODEL || 'glm-4v-plus',
          baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        },
        isDefault: env.DEFAULT_AI_PROVIDER === 'glm',
      },
      {
        provider: 'ollama',
        name: 'Ollama (Local)',
        enabled: true,
        configured: true,
        settings: {
          baseUrl: env.OLLAMA_BASE_URL,
          defaultTextModel: env.OLLAMA_MODEL,
          defaultVisionModel: env.OLLAMA_VISION_MODEL,
        },
        isDefault: env.DEFAULT_AI_PROVIDER === 'ollama',
      },
    ];

    res.json({
      success: true,
      providers,
      defaultProvider: env.DEFAULT_AI_PROVIDER,
      visionProvider: env.SOFTAWARE_VISION_PROVIDER,
      note: 'AI provider settings are configured via environment variables. Update .env file to change settings.',
    });
  } catch (error) {
    next(error);
  }
});

const TestAIProviderSchema = z.object({
  provider: z.enum(['glm', 'ollama']),
});

/**
 * POST /admin/config/ai-providers/test
 * Test AI provider connection
 */
adminConfigRouter.post('/ai-providers/test', async (req, res, next) => {
  try {
    const { provider } = TestAIProviderSchema.parse(req.body);

    let testResult = { success: false, message: '', error: '', models: [] as string[] };

    if (provider === 'ollama') {
      try {
        // Test Ollama connection
        const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`);
        if (response.ok) {
          const data = await response.json() as any;
          testResult = {
            success: true,
            message: `Ollama connected successfully at ${env.OLLAMA_BASE_URL}`,
            error: '',
            models: data.models?.map((m: any) => m.name) || [],
          };
        } else {
          testResult = {
            success: false,
            message: '',
            error: `Ollama returned status ${response.status}`,
            models: [],
          };
        }
      } catch (error: any) {
        testResult = {
          success: false,
          message: '',
          error: error.message || 'Failed to connect to Ollama',
          models: [],
        };
      }
    } else if (provider === 'glm') {
      if (!env.GLM) {
        return res.json({
          success: false,
          error: 'GLM API key not configured',
        });
      }

      try {
        // Test GLM API with a minimal request
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GLM}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'glm-4-flash',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5,
          }),
        });

        if (response.ok) {
          testResult = {
            success: true,
            message: 'GLM API connection successful',
            error: '',
            models: ['glm-4-plus', 'glm-4-flash', 'glm-4v-plus'],
          };
        } else {
          const errorData = await response.json().catch(() => ({})) as any;
          testResult = {
            success: false,
            message: '',
            error: errorData.error?.message || `GLM API returned status ${response.status}`,
            models: [],
          };
        }
      } catch (error: any) {
        testResult = {
          success: false,
          message: '',
          error: error.message || 'Failed to connect to GLM API',
          models: [],
        };
      }
    }

    res.json({
      success: testResult.success,
      provider,
      message: testResult.message,
      error: testResult.error,
      models: testResult.models,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/config/system
 * Get general system configuration
 */
adminConfigRouter.get('/system', async (req, res, next) => {
  try {
    res.json({
      success: true,
      config: {
        nodeEnv: env.NODE_ENV,
        port: env.PORT,
        corsOrigin: env.CORS_ORIGIN,
        jwtExpiresIn: env.JWT_EXPIRES_IN,
        mcpEnabled: env.MCP_ENABLED,
        codeAgentEnabled: env.CODE_AGENT_ENABLED,
        defaultAIProvider: env.DEFAULT_AI_PROVIDER,
        smtp: {
          configured: !!(env.SMTP_HOST && env.SMTP_USER),
          host: env.SMTP_HOST || null,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          from: env.SMTP_FROM,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});
