const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Load Environment Variables (ZENVIA_API_TOKEN)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/ZENVIA_API_TOKEN=(.+)/);
    if (match && match[1]) {
        let token = match[1].trim();
        if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
            token = token.substring(1, token.length - 1);
        }
        process.env.ZENVIA_API_TOKEN = token;
        console.log("Loaded ZENVIA_API_TOKEN from .env");
    }
} else {
    console.warn("Warning: .env file not found.");
}

// Import sendZenviaSMS from smsScheduler
let sendZenviaSMS;
try {
    const scheduler = require('./smsScheduler');
    sendZenviaSMS = scheduler.sendZenviaSMS;
} catch (e) {
    console.error("Error importing smsScheduler:", e.message);
    process.exit(1);
}

// 2. Test Config (Manual Data provided by User)
const TARGETS = [
    { code: '54321', name: 'Vivianny', phone: '5584988739180' },
    { code: '11111', name: 'Thiago', phone: '5584988277188' },
    { code: '88888', name: 'Humberto Júnior', phone: '5584988903108' },
    { code: '54321', name: 'Kátia Campos', phone: '5584998087988' },
    { code: '77777', name: 'Waltemberg', phone: '5584994316099' },
    { code: '00000', name: 'Humberto Campos', phone: '5584988777361' },
    { code: '33333', name: 'Jameson', phone: '5584994105100' },
    { code: '1256', name: 'Valentina Maria', phone: '5584994412960' }
];

const MSG = 'EXPANSIVO: Teste de sistema. Acesse seu portal em: https://meuexpansivo.app';

async function runBatch() {
    console.log(`\n🚀 Starting Batch for ${TARGETS.length} targets...`);
    console.log(`Message: "${MSG}"`);
    console.log("---------------------------------------------------");

    const results = [];

    for (const target of TARGETS) {
        try {
            console.log(`📨 Sending to ${target.name} (${target.code}) - ${target.phone}...`);

            // Send SMS
            const msgId = await sendZenviaSMS(target.phone, MSG);

            if (msgId) {
                console.log(`   ✅ Success! ID: ${msgId}`);
                results.push({ code: target.code, name: target.name, phone: target.phone, msgId, status: 'Success' });
            } else {
                console.log(`   ❌ Failed to send.`);
                results.push({ code: target.code, name: target.name, status: 'Failed' });
            }

        } catch (e) {
            console.error(`Error processing ${target.name}:`, e.message);
            results.push({ code: target.code, error: e.message });
        }
    }

    console.log("\n---------------------------------------------------");
    console.log("📊 Final Report (JSON):");
    const jsonOutput = JSON.stringify(results, null, 2);
    console.log(jsonOutput);
    fs.writeFileSync('test_result.json', jsonOutput);
    console.log("Saved to test_result.json");
}

runBatch();
