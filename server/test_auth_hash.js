
const bcrypt = require('bcrypt');
const { verifyPassword } = require('./auth');
const fs = require('fs');
const path = require('path');

async function test() {
    console.log('Testing password verification...');
    const usersFile = path.join(__dirname, 'users.json');
    const data = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const admin = data.users.find(u => u.username === 'admin');

    if (!admin) {
        console.error('User admin not found');
        return;
    }

    console.log('Hash from file:', admin.passwordHash);
    const password = 'admin123';

    // Test using direct bcrypt comparison
    const match1 = await bcrypt.compare(password, admin.passwordHash);
    console.log(`bcrypt.compare('${password}', hash) = ${match1}`);

    // Test using auth module
    const match2 = await verifyPassword(password, admin.passwordHash);
    console.log(`verifyPassword('${password}', hash) = ${match2}`);

    // Generate a new hash for comparison
    const newHash = await bcrypt.hash(password, 12);
    console.log('New hash for admin123:', newHash);
    const match3 = await bcrypt.compare(password, newHash);
    console.log(`bcrypt.compare('${password}', newHash) = ${match3}`);
}

test().catch(console.error);
