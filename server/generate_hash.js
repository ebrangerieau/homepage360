
const bcrypt = require('bcrypt');

async function generateHash() {
    const password = 'test123';
    const hash = await bcrypt.hash(password, 12);
    console.log(`Hash for 'test123': ${hash}`);
}

generateHash().catch(console.error);
