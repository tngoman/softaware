import { db, toMySQLDate } from '../db/mysql.js';
export async function requireApiKey(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            return res.status(401).json({ error: 'API key required. Provide X-API-Key header.' });
        }
        // Lookup API key in database
        const keyRecord = await db.queryOne(`SELECT ak.*, u.email as userEmail 
       FROM api_keys ak 
       JOIN users u ON ak.userId = u.id 
       WHERE ak.\`key\` = ?`, [apiKey]);
        if (!keyRecord) {
            return res.status(401).json({ error: 'Invalid API key' });
        }
        if (!keyRecord.isActive) {
            return res.status(403).json({ error: 'API key is inactive' });
        }
        if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
            return res.status(403).json({ error: 'API key has expired' });
        }
        // Update last used timestamp
        const now = toMySQLDate(new Date());
        await db.execute('UPDATE api_keys SET lastUsedAt = ? WHERE id = ?', [now, keyRecord.id]);
        // Attach API key info to request
        req.apiKey = {
            id: keyRecord.id,
            userId: keyRecord.userId,
            name: keyRecord.name
        };
        next();
    }
    catch (error) {
        next(error);
    }
}
