/**
 * @deprecated This file is for backward compatibility only.
 * All new code should import from './mysql.js' directly.
 *
 * TODO: Migrate remaining MCP server code to use mysql.ts
 */
// Stub that logs deprecation warning
const handler = {
    get(_target, prop) {
        console.warn(`[DEPRECATED] Prisma called: prisma.${prop} - please migrate to mysql.js`);
        return () => {
            throw new Error(`Prisma has been removed. Please use mysql.js instead for: ${prop}`);
        };
    }
};
// Proxy that will throw helpful errors when Prisma methods are called
export const prisma = new Proxy({}, handler);
