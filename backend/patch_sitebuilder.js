const fs = require('fs');
let code = fs.readFileSync('/var/opt/backend/src/routes/siteBuilder.ts', 'utf8');

const importStr = "import { getLimitsForTier } from '../config/tiers.js';\n\nasync function resolveUserTier(userId: string) {\n  const user = await db.queryOne<{ plan_type: string }>('SELECT plan_type FROM users WHERE id = ? LIMIT 1', [userId]);\n  const tier = user?.plan_type || 'free';\n  return { tier, maxPages: getLimitsForTier(tier).maxKnowledgePages };\n}\n\nconst router = express.Router();";

code = code.replace(/const router = express\.Router\(\);/, importStr);
fs.writeFileSync('/var/opt/backend/src/routes/siteBuilder.ts', code);
