
import { Subject } from '../types';

export const getStudyTips = async (subject: Subject, topic: string, gradeLevel: string): Promise<{ title: string; tip: string }> => {
    // Mock implementation or basic AI call structure
    // For now, returning a static response to fix the build
    return {
        title: `Tutor IA: ${subject} (${gradeLevel})`,
        tip: `Aqui estão algumas dicas para melhorar em **${topic}** no **${gradeLevel}**: \n\n1. Revise os conceitos básicos de ${topic}.\n2. Faça exercícios práticos voltados para sua série.\n3. Procure vídeos explicativos de ${subject}.`
    };
};
