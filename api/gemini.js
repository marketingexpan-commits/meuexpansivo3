import { GoogleGenAI } from "@google/genai";

export default async function handler(request, response) {
    // Configuração de CORS para permitir chamadas do seu front-end
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*'); // Em produção, substitua '*' pelo seu domínio real se quiser mais segurança
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Trata requisição OPTIONS (pre-flight do CORS)
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { subject, difficultyTopic, gradeLevel } = request.body;

        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY (ou VITE_GEMINI_API_KEY) não configurada no servidor.');
        }

        const genAI = new GoogleGenAI({ apiKey: apiKey });
        const model = 'gemini-2.5-flash';

        const prompt = `
      Atue como um tutor escolar especializado e motivador.
      O aluno está no ${gradeLevel}.
      Matéria: ${subject}.
      O professor identificou uma dificuldade específica em: "${difficultyTopic}".

      Por favor, forneça:
      1. Uma explicação simples e didática sobre o conceito de "${difficultyTopic}".
      2. 3 dicas práticas de estudo para melhorar nessa área específica.
      3. Uma mensagem de incentivo curta no final.

      Use formatação Markdown simples (negrito, listas). Seja direto e encorajador.
    `;

        // Instancia o cliente especificando o modelo corretamente
        // Nota: A SDK mudou recentemente, vamos usar a forma mais compatível
        // Se a versão do @google/genai for a mais recente, usamos assim:
        const client = genAI.models;

        // Mas para garantir compatibilidade com o código anterior que usava generateContent direto:
        const result = await client.generateContent({
            model: model,
            contents: prompt,
        });

        const responseText = result.text;

        return response.status(200).json({ text: responseText });

    } catch (error) {
        console.error("Erro na Serverless Function:", error);
        return response.status(500).json({
            error: 'Erro interno ao processar a solicitação de IA.',
            details: error.message
        });
    }
}
