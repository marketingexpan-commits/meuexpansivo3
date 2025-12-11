import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Subject } from "../types";

// FIX: Initialize the GoogleGenAI client directly using the API key from environment variables
// as per the coding guidelines. This avoids complex and conditional key retrieval.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });


export const getStudyTips = async (subject: Subject, difficultyTopic: string, gradeLevel: string): Promise<string> => {
  try {
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

    // FIX: Correctly typed the API call and response, removing the need for @ts-ignore.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    // FIX: Access the 'text' property directly on the response object as per guidelines.
    return response.text ?? "Não foi possível gerar dicas no momento. Tente novamente mais tarde.";
  } catch (error) {
    console.error("Erro ao consultar o Gemini:", error);
    return "Ocorreu um erro ao tentar obter as dicas de estudo. Verifique se a chave da API está configurada no servidor.";
  }
};
