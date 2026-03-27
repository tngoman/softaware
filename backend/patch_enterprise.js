const fs = require('fs');
let code = fs.readFileSync('/var/opt/backend/src/routes/enterpriseWebhook.ts', 'utf8');

code = code.replace(/import \* as packageService from '\.\.\/services\/packages\.js';\n/g, '');

code = code.replace(/\/\/ 2b\. Package enforcement[\s\S]*?\/\/ 3\. Normalize the inbound payload/g, '// 3. Normalize the inbound payload');

code = code.replace(/\/\/ Deduct Kone-specific credits \([^)]+\)[\s\S]*?logAnonymizedChat\(/g, 'logAnonymizedChat(');

code = code.replace(/\/\/ 8b\. Deduct credits[\s\S]*?\/\/ 9\. Anonymized telemetry/g, '// 9. Anonymized telemetry');

fs.writeFileSync('/var/opt/backend/src/routes/enterpriseWebhook.ts', code);
