export default async function handler(request, response) {
    // Configuração de CORS
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { subject, difficultyTopic, gradeLevel } = request.body;
        // Prioriza a chave nova se não tiver no env
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "AIzaSyCB-YNCrnUJE_W7l4hNcwlEmtpSoCjSJIw";

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY não configurada no servidor.');
        }

        // Modelo verificado que funciona com a chave fornecida (Trusted Tester / Preview)
        const model = 'gemini-2.5-flash-preview-09-2025';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        const generateWithRetry = async (retries = 3, initialDelay = 1000) => {
            let delay = initialDelay;
            for (let i = 0; i < retries; i++) {
                try {
                    const fetchResponse = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (!fetchResponse.ok) {
                        // Se for erro de servidor ou rate limit, lança para o catch tratar o retry
                        if (fetchResponse.status === 429 || fetchResponse.status >= 500) {
                            const errorText = await fetchResponse.text();
                            throw new Error(`API Error ${fetchResponse.status}: ${errorText}`);
                        }
                        // Se for erro 4xx (exceto 429), não retenta
                        const errorData = await fetchResponse.json();
                        throw new Error(errorData.error?.message || 'Erro na requisição ao Gemini');
                    }

                    return await fetchResponse.json();

                } catch (err) {
                    const errorMessage = err.message || '';
                    const isRateLimit = errorMessage.includes('429') ||
                        errorMessage.includes('Too Many Requests') ||
                        errorMessage.includes('RESOURCE_EXHAUSTED');

                    const isOverloaded = errorMessage.includes('503') ||
                        errorMessage.includes('overloaded');

                    if (i === retries - 1) throw err;

                    if (isRateLimit || isOverloaded) {
                        console.warn(`Tentativa ${i + 1} falhou. Retentando em ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2;
                        continue;
                    }
                    throw err;
                }
            }
        };

        const result = await generateWithRetry();

        // Extrair texto da resposta do formato REST do Gemini
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Não foi possível processar a resposta da IA.";

        return response.status(200).json({ text: responseText });

    } catch (error) {
        console.error("Erro na Serverless Function (Fetch):", error);

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
