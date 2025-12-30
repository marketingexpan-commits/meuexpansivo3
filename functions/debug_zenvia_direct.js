const fs = require('fs');
const https = require('https');
const path = require('path');

// 1. Read .env manually
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

if (!token) {
    console.error("❌ Token not found.");
    process.exit(1);
}

// 2. Prepare Request
// Fire Test Configuration
const phoneNumber = '5584994105100';
const messageText = 'Debug Test Alias marketing.expan - VALIDATION';

const data = JSON.stringify({
    from: 'marketing.expan',
    to: phoneNumber,
    contents: [{ type: 'text', text: messageText }]
});

const options = {
    hostname: 'api.zenvia.com',
    path: '/v2/channels/sms/messages',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-TOKEN': token,
        'Content-Length': Buffer.byteLength(data)
    }
};

// 3. Send Request
const req = https.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        fs.writeFileSync('zenvia_response.json', responseBody);
        console.log("Response saved to zenvia_response.json");
    });
});

req.on('error', (error) => {
    console.error("❌ Network Error:", error);
});

req.write(data);
req.end();
