import { Subject } from "../types";

export const getStudyTips = async (subject: Subject, difficultyTopic: string, gradeLevel: string): Promise<string> => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        difficultyTopic,
        gradeLevel,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || 'Falha na requisição');
    }

    const data = await response.json();
    return data.text ?? "Não foi possível gerar dicas no momento. Tente novamente mais tarde.";

  } catch (error) {
    console.error("Erro ao consultar o Gemini via Backend:", error);
    return "Ocorreu um erro ao tentar obter as dicas de estudo. Verifique sua conexão e tente novamente.";
  }
};

