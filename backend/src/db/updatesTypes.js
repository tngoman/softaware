/**
 * TypeScript interfaces for the Updates system tables (upd_* prefix).
 * These tables power software update distribution, client heartbeats,
 * module tracking, and remote control functionality.
 */
export function computeClientStatus(secondsSinceHeartbeat) {
    if (secondsSinceHeartbeat < 300)
        return 'online'; // < 5 min
    if (secondsSinceHeartbeat < 86400)
        return 'recent'; // < 24 hr
    if (secondsSinceHeartbeat < 604800)
        return 'inactive'; // < 7 days
    return 'offline';
}
