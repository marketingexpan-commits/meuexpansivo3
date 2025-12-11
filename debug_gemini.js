import { GoogleGenAI } from "@google/genai";

// Hardcoded key for debug only
const apiKey = "AIzaSyD-vPAZZ4F8CRuVds5det4d4CGp6DwnTug";

console.log("Using API Key (last 4):", apiKey.slice(-4));

const genAI = new GoogleGenAI({ apiKey: apiKey });
const client = genAI.models;

async function listModels() {
    try {
        console.log("Listing models...");
        const response = await client.list();
        for await (const model of response) {
            console.log(`- ${model.name} (${model.displayName})`);
        }
    } catch (error) {
        console.error("Error listing models:", error);
        if (error.response) {
            try {
                console.error("Response:", await error.response.text());
            } catch (e) {
                console.error("Could not read response text");
            }
        }
    }
}

listModels();
