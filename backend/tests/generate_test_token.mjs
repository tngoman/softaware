import jwt from 'jsonwebtoken';

const JWT_SECRET = 'change_me_to_a_long_random_string_please';
const token = jwt.sign({ userId: 'test-user-1' }, JWT_SECRET, { expiresIn: '24h' });

console.log('Test JWT Token:');
console.log(token);
console.log('\nUse in Authorization header as:');
console.log(`Bearer ${token}`);
