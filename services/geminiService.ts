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

      // Se o backend retornar 429 explicitamente (como implementamos agora), usamos a mensagem dele
      if (response.status === 429) {
        throw new Error(errorData.error || 'O sistema está sobrecarregado. Tente novamente em instantes.');
      }

      throw new Error(errorData.details || errorData.error || 'Falha na requisição');
    }

    const data = await response.json();
    return data.text ?? "Não foi possível gerar dicas no momento. Tente novamente mais tarde.";

  } catch (error: any) {
    console.error("Erro ao consultar o Gemini via Backend:", error);
    // DEBUG: Retornar o erro real para o usuário ver
    const errorMessage = error.message || String(error);

    // Mensagens amigáveis para erros conhecidos
    if (errorMessage.includes('429') ||
      errorMessage.includes('overloaded') ||
      errorMessage.includes('competitors') ||
      errorMessage.includes('alta demanda') ||
      errorMessage.includes('quota')) {
      return "O Tutor Inteligente está recebendo muitos pedidos agora! 🚦\n\nPor favor, aguarde uns 10 segundos e tente novamente. Estamos processando as dúvidas de muitos alunos.";
    }

    // Se for erro técnico genérico, tenta suavizar
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      return "Parece que houve um problema de conexão. Verifique sua internet e tente novamente.";
    }

    return `Ops! Tivemos um problema técnico: ${errorMessage}. Tente novamente.`;
  }
};

