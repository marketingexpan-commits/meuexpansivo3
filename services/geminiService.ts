import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Subject } from "../types";

const FALLBACK_KEY = "AIzaSyD-vPAZZ4F8CRuVds5det4d4CGp6DwnTug";
const API_KEY = process.env.API_KEY || FALLBACK_KEY;

let ai: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

export const getStudyTips = async (subject: Subject, difficultyTopic: string, gradeLevel: string): Promise<string> => {
  try {
    const client = getAiClient();
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

    const response: GenerateContentResponse = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text ?? "Não foi possível gerar dicas no momento. Tente novamente mais tarde.";
  } catch (error) {
    console.error("Erro ao consultar o Gemini:", error);
    return "Ocorreu um erro ao tentar obter as dicas de estudo. Verifique sua conexão e tente novamente.";
  }
};
