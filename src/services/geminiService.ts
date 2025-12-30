
import { Subject } from '../types';

export const getStudyTips = async (subject: Subject, topic: string): Promise<{ title: string; tip: string }> => {
    // Mock implementation or basic AI call structure
    // For now, returning a static response to fix the build
    return {
        title: `Dicas de estudo para ${topic}`,
        tip: `Aqui estão algumas dicas para melhorar em ${subject}: \n\n1. Revise os conceitos básicos de ${topic}.\n2. Faça exercícios práticos.\n3. Procure vídeos explicativos.`
    };
};
