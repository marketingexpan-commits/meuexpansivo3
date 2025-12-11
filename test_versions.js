import https from 'https';

const apiKey = "AIzaSyCB-YNCrnUJE_W7l4hNcwlEmtpSoCjSJIw";
const tests = [
    { model: "gemini-1.5-flash-001", version: "v1beta" },
    { model: "gemini-1.5-flash", version: "v1beta" }
];

const runTest = (model, version) => {
    return new Promise((resolve) => {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
        console.log(`Testing: ${model} (${version})`);

        const data = JSON.stringify({
            contents: [{ parts: [{ text: "Hello" }] }]
        });

        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(url, options, (res) => {
            console.log(`[${model}] Status: ${res.statusCode}`);
            resolve();
        });

        req.on('error', (e) => {
            console.error(`[${model}] Error:`, e.message);
            resolve();
        });

        req.write(data);
        req.end();
    });
};

async function runAll() {
    for (const t of tests) {
        await runTest(t.model, t.version);
    }
}

runAll();
