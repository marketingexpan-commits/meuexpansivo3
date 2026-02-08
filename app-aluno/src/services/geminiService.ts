import { Subject } from "../types";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize using the correct Vite env variable
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export const getStudyTips = async (subject: Subject, difficultyTopic: string, gradeLevel: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  try {
    console.log("🔑 [Gemini Service] Verificando chave de API:", apiKey ? "Definida" : "UNDEFINED");

    if (!apiKey || apiKey.includes('TOKEN_PENDENTE')) {
      throw new Error("Chave de API não configurada. Local: Verifique .env | Produção: Verifique Variáveis de Ambiente no Vercel");
    }

    // Using gemini-2.0-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log(`🤖 [Gemini Service] Solicitando dicas para: ${subject} - ${difficultyTopic} (Modelo: gemini-2.0-flash)`);

    const prompt = `
      Atue como um tutor escolar especialista e amigável.
      Aluno do: ${gradeLevel}
      Matéria: ${subject}
      Dificuldade específica: "${difficultyTopic}"

      Por favor, forneça:
      1. Uma explicação super simples e didática sobre esse tópico.
      2. Uma analogia do dia a dia para facilitar o entendimento.
      3. Três dicas práticas de como estudar isso melhor.
      
      Use emojis, seja encorajador e mantenha o texto formatado para fácil leitura.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error: any) {
    console.error("❌ [Gemini Service] Erro Detalhado:", error);

    const errorMessage = error.message || String(error);

    if (errorMessage.includes("API_KEY_INVALID")) return "Erro: A chave de API informada é inválida.";
    if (errorMessage.includes("BILLING_DISABLED")) return "Erro: A conta da API não tem faturamento ativado.";
    return `Erro: O modelo atual (gemini-2.0-flash) não está disponível. Verifique se o nome do modelo está correto ou se sua chave tem acesso a ele.`;

    return `Erro Técnico: ${errorMessage}`;
  }
};
