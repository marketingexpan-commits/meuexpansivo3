import https from 'https';

const apiKey = "AIzaSyDwzZFsf7P5-tE9Itqga0nuqre_EExmhwA";
const models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro"
];
const versions = ["v1", "v1beta"];

async function checkUrl(model, version) {
    return new Promise(resolve => {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            console.log(`[${version}] ${model}: ${res.statusCode}`);
            resolve();
        });

        req.on('error', e => {
            console.error(`Error ${model}: ${e.message}`);
            resolve();
        });

        req.write(JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] }));
        req.end();
    });
}

async function run() {
    console.log("Testing Stable Models on Standard/Paid Key...");
    for (const v of versions) {
        for (const m of models) {
            await checkUrl(m, v);
        }
    }
}

run();
