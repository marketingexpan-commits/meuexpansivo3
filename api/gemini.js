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
        // MUDANÇA: Usando modelo estável e específico para evitar erro 404 em v1beta
        const model = 'gemini-1.5-flash-001';

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

        const client = genAI.models;

        // Função de retry robusta
        const generateWithRetry = async (retries = 3, initialDelay = 1000) => {
            let delay = initialDelay;
            for (let i = 0; i < retries; i++) {
                try {
                    return await client.generateContent({
                        model: model,
                        contents: prompt,
                    });
                } catch (err) {
                    const errorMessage = err.message || '';
                    const isRateLimit = errorMessage.includes('429') ||
                        errorMessage.includes('limit') ||
                        errorMessage.includes('quota') ||
                        errorMessage.includes('RESOURCE_EXHAUSTED');

                    const isOverloaded = errorMessage.includes('503') ||
                        errorMessage.includes('overloaded');

                    // Se for a última tentativa, lança o erro independente do tipo
                    if (i === retries - 1) throw err;

                    if (isRateLimit || isOverloaded) {
                        console.warn(`Tentativa ${i + 1} falhou (${isRateLimit ? 'Rate Limit' : 'Overloaded'}). Tentando novamente em ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Backoff exponencial
                        continue;
                    }

                    // Se for outro tipo de erro (ex: 400 Bad Request), não adianta retentar
                    throw err;
                }
            }
        };

        const result = await generateWithRetry();

        const responseText = result.text;

        return response.status(200).json({ text: responseText });

    } catch (error) {
        console.error("Erro na Serverless Function:", error);

        // Verifica se o erro original foi por rate limit e retorna status apropriado
        const errorMessage = error.message || '';
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
            return response.status(429).json({
                error: 'O sistema de IA está com alta demanda. Por favor, aguarde alguns segundos e tente novamente.',
                details: errorMessage
            });
        }

        return response.status(500).json({
            error: 'Erro interno ao processar a solicitação de IA.',
            details: errorMessage
        });
    }
}
