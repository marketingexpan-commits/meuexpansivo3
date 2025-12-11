import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyCB-YNCrnUJE_W7l4hNcwlEmtpSoCjSJIw";

const genAI = new GoogleGenAI({ apiKey: apiKey });
const client = genAI.models;

async function listModels() {
    try {
        console.log("Listing models for key starting with AIzaSyCB...");
        const response = await client.list();
        // New SDK returns an async iterable or object depending on version.
        // Let's try to handle both.
        if (response.models) {
            // older google-generative-ai style
            for (const model of response.models) {
                console.log(`- ${model.name}`);
            }
        } else {
            // new @google/genai style might require iteration
            for await (const model of response) {
                console.log(`- ${model.name}`);
            }
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
