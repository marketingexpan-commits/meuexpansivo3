
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { studentService } from './studentService';

export const statsService = {
    async getDashboardStats(unitFilter?: string | null) {
        try {
            // 1. Total de Alunos
            const allStudents = await studentService.getStudents(unitFilter);
            const totalStudents = allStudents.length;

            // 2. Novos Alunos (últimos 30 dias)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const newStudents = allStudents.filter(s => {
                if (!s.createdAt) return false;
                return new Date(s.createdAt) >= thirtyDaysAgo;
            }).length;

            // 3. Inadimplência (Baseado na coleção 'mensalidades')
            // Nota: Para um sistema grande, isso seria via Cloud Function ou campo agregado.
            // Aqui faremos uma estimativa baseada nos documentos carregados da unidade.
            let delinquencyRate = 0;
            try {
                const mensalidadesRef = collection(db, 'mensalidades');
                let qMensalidades;

                // Se houver filtro de unidade, teríamos que filtrar mensalidades por aluno da unidade.
                // Como não há 'unit' direto na mensalidade (geralmente), vamos pegar todas ou 
                // otimizar no futuro. Para o Dashboard, vamos tentar pegar o contexto da unidade.
                if (unitFilter) {
                    // Filtrar mensalidades apenas dos alunos da unidade
                    // Para o MVP, vamos pegar as pendentes do mês atual de todos e filtrar via JS.
                    qMensalidades = query(mensalidadesRef, where('status', '!=', 'Pago'));
                } else {
                    qMensalidades = query(mensalidadesRef);
                }

                const snap = await getDocs(qMensalidades);
                const allMensalidades = snap.docs.map(d => d.data());

                let pendingCount = 0;
                let totalCount = allMensalidades.length;

                if (unitFilter) {
                    const studentIds = new Set(allStudents.map(s => s.id));
                    const unitMensalidades = allMensalidades.filter(m => studentIds.has(m.studentId));
                    totalCount = unitMensalidades.length;
                    pendingCount = unitMensalidades.filter(m => m.status === 'Pendente').length;
                } else {
                    pendingCount = allMensalidades.filter(m => m.status === 'Pendente').length;
                }

                delinquencyRate = totalCount > 0 ? (pendingCount / totalCount) * 100 : 0;
            } catch (feeError) {
                console.error("Erro ao calcular inadimplência:", feeError);
            }

            return {
                totalStudents,
                newStudents,
                delinquencyRate: parseFloat(delinquencyRate.toFixed(1))
            };
        } catch (error) {
            console.error("Erro ao buscar estatísticas:", error);
            throw error;
        }
    }
};
