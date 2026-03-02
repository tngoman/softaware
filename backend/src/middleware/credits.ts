import { Request, Response, NextFunction } from 'express';
import type { RequestType } from '../config/credits.js';
import { deductCredits } from '../services/credits.js';

/**
 * Extended Request interface with team information
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  teamId?: string;
  apiKey?: {
    id: string;
    userId: string;
  };
  id?: string;
}

/**
 * Middleware to deduct credits for API requests
 *
 * This middleware should be used AFTER authentication middleware
 * to ensure teamId is available on the request object.
 *
 * Usage:
 *   router.post('/endpoint', requireTeam, deductCreditsMiddleware(RequestType.TEXT_CHAT), handler)
 */
export function deductCreditsMiddleware(requestType: RequestType) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Ensure teamId is present (should be set by auth middleware)
      const teamId = req.teamId || (req as any).teamId;

      if (!teamId) {
        return res.status(401).json({
          success: false,
          error: 'Team ID not found. Please authenticate first.',
        });
      }

      // Store original response.json to intercept after handler
      const originalJson = res.json.bind(res);
      let responseSent = false;

      // Override res.json to capture response data
      res.json = function (data: any) {
        if (!responseSent) {
          responseSent = true;

          // Only deduct credits if request was successful
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Calculate metadata for cost calculation
            const metadata = {
              userId: req.user?.id || req.apiKey?.userId,
              requestId: req.id,
              endpoint: req.path,
              method: req.method,
            };

            // For AI requests, try to extract token usage from response
            if (data && typeof data === 'object') {
              if ('usage' in data) {
                (metadata as any).tokens =
                  (data as any).usage?.total_tokens ||
                  (data as any).usage?.totalTokens;
              }
            }

            // Deduct credits asynchronously (don't block response)
            deductCredits(teamId, requestType, metadata).catch((error) => {
              console.error(
                `[Credits] Failed to deduct credits for team ${teamId}:`,
                error
              );
            });

            // Add credit balance info to response headers
            // This allows clients to display remaining balance
            res.setHeader('X-Credit-Deducted', 'true');
          }

          // Call original json
          return originalJson(data);
        }
        return res;
      };

      // Also handle res.send for non-JSON responses
      const originalSend = res.send.bind(res);
      res.send = function (data: any) {
        if (!responseSent) {
          responseSent = true;

          // Only deduct credits if request was successful
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const metadata = {
              userId: req.user?.id || req.apiKey?.userId,
              requestId: req.id,
              endpoint: req.path,
              method: req.method,
            };

            deductCredits(teamId, requestType, metadata).catch((error) => {
              console.error(
                `[Credits] Failed to deduct credits for team ${teamId}:`,
                error
              );
            });

            res.setHeader('X-Credit-Deducted', 'true');
          }
        }
        return originalSend(data);
      };

      next();
    } catch (error) {
      console.error('[Credits] Middleware error:', error);
      next(error);
    }
  };
}

/**
 * Middleware to check if team has sufficient credits before processing
 * This blocks requests that would fail due to insufficient credits
 *
 * Use this BEFORE the main handler to fail fast
 */
export function requireCredits(requestType: RequestType, estimatedCost?: number) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { getTeamCreditBalance } = await import('../services/credits.js');
      const teamId = req.teamId || (req as any).teamId;

      if (!teamId) {
        return res.status(401).json({
          success: false,
          error: 'Team ID not found. Please authenticate first.',
        });
      }

      const balance = await getTeamCreditBalance(teamId);

      if (!balance) {
        return res.status(403).json({
          success: false,
          error: 'No credit balance found. Please contact support.',
        });
      }

      // Check if balance is critically low
      if (balance.balance <= 0) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits. Please top up your account to continue using the service.',
          balance: balance.formattedBalance,
          balanceRaw: balance.balance,
        });
      }

      // Add balance info to headers for client display
      res.setHeader('X-Credit-Balance', balance.formattedBalance);
      res.setHeader('X-Credit-Balance-Raw', balance.balance.toString());

      // Warn if low balance
      if (balance.balance < 1000) {
        // Less than R10
        res.setHeader('X-Credit-Low-Balance', 'true');
        res.setHeader(
          'X-Credit-Low-Balance-Message',
          'Your credit balance is low. Please top up soon to avoid service interruption.'
        );
      }

      next();
    } catch (error) {
      console.error('[Credits] Credit check error:', error);
      next(error);
    }
  };
}

/**
 * Combined middleware: Check credits AND deduct after successful request
 *
 * This is the recommended middleware to use for most endpoints
 */
export function withCreditDeduction(requestType: RequestType) {
  return [
    requireCredits(requestType),
    deductCreditsMiddleware(requestType),
  ];
}
