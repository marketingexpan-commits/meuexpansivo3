const fs = require('fs');
const https = require('https');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let token = '';

try {
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/ZENVIA_API_TOKEN=(.+)/);
        if (match && match[1]) {
            token = match[1].trim();
            if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
                token = token.substring(1, token.length - 1);
            }
        }
    }
} catch (e) { }

if (!token) { console.error("Token fail"); process.exit(1); }

const options = {
    hostname: 'api.zenvia.com',
    path: '/v2/channels/sms/senders',
    method: 'GET',
    headers: { 'X-API-TOKEN': token }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Body:", body);
    });
});
req.on('error', console.error);
req.end();
