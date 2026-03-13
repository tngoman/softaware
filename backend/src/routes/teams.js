import { Router } from 'express';
import { z } from 'zod';
import { db, generateId, toMySQLDate } from '../db/mysql.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { forbidden, notFound } from '../utils/httpErrors.js';
export const teamsRouter = Router();
teamsRouter.use(requireAuth);
async function requireTeamMember(teamId, userId) {
    const member = await db.queryOne('SELECT * FROM team_members WHERE teamId = ? AND userId = ?', [teamId, userId]);
    if (!member)
        throw forbidden('Not a member of this team');
    return member;
}
teamsRouter.get('/:id', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        await requireTeamMember(teamId, userId);
        const team = await db.queryOne('SELECT * FROM teams WHERE id = ?', [teamId]);
        if (!team)
            throw notFound('Team not found');
        const members = await db.query(`SELECT tm.*, u.id as usrId, u.email as userEmail 
       FROM team_members tm 
       JOIN users u ON tm.userId = u.id 
       WHERE tm.teamId = ?`, [teamId]);
        res.json({
            team,
            members: members.map((m) => ({
                user: { id: m.usrId, email: m.userEmail },
                role: m.role
            }))
        });
    }
    catch (err) {
        next(err);
    }
});
const InviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['ARCHITECT', 'OPERATOR', 'AUDITOR']).default('OPERATOR'),
});
teamsRouter.post('/:id/invite', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const member = await requireTeamMember(teamId, userId);
        if (member.role !== 'ADMIN')
            throw forbidden('Only ADMIN can invite');
        const input = InviteSchema.parse(req.body);
        const inviteId = generateId();
        const now = toMySQLDate(new Date());
        await db.execute('INSERT INTO team_invites (id, teamId, email, role, createdAt) VALUES (?, ?, ?, ?, ?)', [inviteId, teamId, input.email, input.role, now]);
        const invite = await db.queryOne('SELECT * FROM team_invites WHERE id = ?', [inviteId]);
        res.status(201).json({ invite });
    }
    catch (err) {
        next(err);
    }
});
const UpdateMemberSchema = z.object({
    role: z.enum(['ADMIN', 'ARCHITECT', 'OPERATOR', 'AUDITOR']),
});
teamsRouter.put('/:id/members/:uid', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const targetUserId = req.params.uid;
        const member = await requireTeamMember(teamId, userId);
        if (member.role !== 'ADMIN')
            throw forbidden('Only ADMIN can update roles');
        const input = UpdateMemberSchema.parse(req.body);
        await db.execute('UPDATE team_members SET role = ? WHERE teamId = ? AND userId = ?', [input.role, teamId, targetUserId]);
        const updated = await db.queryOne('SELECT * FROM team_members WHERE teamId = ? AND userId = ?', [teamId, targetUserId]);
        res.json({ member: updated });
    }
    catch (err) {
        next(err);
    }
});
teamsRouter.delete('/:id/members/:uid', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const targetUserId = req.params.uid;
        const member = await requireTeamMember(teamId, userId);
        if (member.role !== 'ADMIN')
            throw forbidden('Only ADMIN can remove members');
        await db.execute('DELETE FROM team_members WHERE teamId = ? AND userId = ?', [teamId, targetUserId]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
