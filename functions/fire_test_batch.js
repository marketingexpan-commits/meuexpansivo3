// Native fetch in Node 18+


async function runtest() {
    const url = 'https://us-central1-meu-expansivo-app.cloudfunctions.net/sendTestBatch';
    const payload = { codes: ['54321'] };

    console.log("🔥 Firing Test to:", url);
    console.log("Payload:", JSON.stringify(payload));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);
        console.log("Body:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

runtest();
