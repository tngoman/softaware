const fs = require('fs');
let code = fs.readFileSync('/var/opt/backend/src/routes/stripe.ts', 'utf8');

code = code.replace(/import \* as packageService from '\.\.\/services\/packages\.js';/, '');
// ... we will completely rewrite it with a simplified version.
