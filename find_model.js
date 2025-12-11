import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyCB-YNCrnUJE_W7l4hNcwlEmtpSoCjSJIw";
const genAI = new GoogleGenAI({ apiKey: apiKey });
const client = genAI.models;

async function findWorkingModel() {
    console.log("Fetching model list...");
    try {
        const listResp = await client.list();
        let models = [];
        if (listResp.models) {
            models = listResp.models;
        } else {
            for await (const m of listResp) models.push(m);
        }

        const flashModels = models
            .map(m => m.name.replace('models/', ''))
            .filter(name => name.includes('flash') || name.includes('1.5'));

        console.log("Found relevant models:", flashModels);

        for (const model of flashModels) {
            console.log(`Testing ${model}...`);
            try {
                const resp = await client.generateContent({
                    model: model,
                    contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
                });
                console.log(`SUCCESS: ${model} works!`);
                console.log(resp.response.text());
                return; // Found one!
            } catch (e) {
                console.log(`Failed ${model}: ${e.message.split('\n')[0]}`);
            }
        }
    } catch (e) {
        console.error("Fatal:", e);
    }
}

findWorkingModel();
