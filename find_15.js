import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyCB-YNCrnUJE_W7l4hNcwlEmtpSoCjSJIw";
const genAI = new GoogleGenAI({ apiKey: apiKey });
const client = genAI.models;

async function findStableModels() {
    console.log("Searching for 1.5 models...");
    try {
        const listResp = await client.list();
        let models = [];
        if (listResp.models) {
            models = listResp.models;
        } else {
            for await (const m of listResp) models.push(m);
        }

        const stableModels = models
            .map(m => m.name.replace('models/', ''))
            .filter(name => name.includes('1.5'));

        console.log("Found 1.5 models:", stableModels);

        // Test the first one found
        if (stableModels.length > 0) {
            const target = stableModels[0];
            console.log(`Testing ${target}...`);
            try {
                const resp = await client.generateContent({
                    model: target,
                    contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
                });
                console.log(`SUCCESS: ${target} works!`);
            } catch (e) {
                console.log(`Failed ${target}: ${e.message}`);
            }
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

findStableModels();
