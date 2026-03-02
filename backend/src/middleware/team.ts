import { Request, Response, NextFunction } from 'express';
import { db, type team_members } from '../db/mysql.js';

export interface TeamRequest extends Request {
  userId?: string;
  teamId?: string;
}

/**
 * Middleware to attach teamId to request based on user's primary team
 * This should be used AFTER requireAuth middleware
 */
export async function requireTeam(req: TeamRequest, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get user's primary team (first team they're a member of)
    const membership = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
      [userId]
    );

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'No team found for user. Please create a team first.',
      });
    }

    // Attach teamId to request
    req.teamId = membership.teamId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to validate teamId from request params
 * Checks if user is a member of the specified team
 */
export async function validateTeamMembership(req: TeamRequest, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;
    const teamId = req.params.teamId || req.body.teamId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'teamId is required',
      });
    }

    // Verify user is a member of this team
    const membership = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE teamId = ? AND userId = ?',
      [teamId, userId]
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
      });
    }

    // Attach teamId to request
    req.teamId = teamId;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to check if user is admin of the team
 */
export async function requireTeamAdmin(req: TeamRequest, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;
    const teamId = req.teamId || req.params.teamId || req.body.teamId;

    if (!userId || !teamId) {
      return res.status(400).json({
        success: false,
        error: 'User and team context required',
      });
    }

    const membership = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE teamId = ? AND userId = ?',
      [teamId, userId]
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this team',
      });
    }

    if (membership.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Only team admins can perform this action',
      });
    }

    req.teamId = teamId;

    next();
  } catch (error) {
    next(error);
  }
}
