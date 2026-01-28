
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { studentService } from './studentService';
import { getCurrentSchoolYear, isHistoricalYear } from '../utils/academicUtils';

export const statsService = {
    async getDashboardStats(unitFilter?: string | null) {
        try {
            // 1. Total de Alunos
            // O unitFilter já deve ser o ID (ex: unit_bs) ou nulo/admin_geral
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
                const currentYear = getCurrentSchoolYear();
                const allMensalidades = snap.docs
                    .map(d => d.data())
                    .filter(m => {
                        if (!m.month) return true;
                        const yearPart = m.month.split('/')[1];
                        if (isHistoricalYear(currentYear)) {
                            return parseInt(yearPart) < 2024;
                        }
                        return yearPart === currentYear;
                    });

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
    },

    async getLoginStats() {
        const today = new Date().toISOString().split('T')[0];
        try {
            // Acessos Hoje
            const dailyStatsRef = doc(db, 'daily_stats', today);
            const dailyStatsSnap = await getDoc(dailyStatsRef);
            const totalLogins = dailyStatsSnap.exists() ? dailyStatsSnap.data()?.total_logins || 0 : 0;

            // Total Visitas (Global)
            const siteStatsRef = doc(db, 'site_stats', 'general');
            const siteStatsSnap = await getDoc(siteStatsRef);
            const loginPageViews = siteStatsSnap.exists() ? siteStatsSnap.data()?.login_page_views || 0 : 0;

            // Visitas Hoje
            const dailyViewsRef = doc(db, 'daily_login_page_views', today);
            const dailyViewsSnap = await getDoc(dailyViewsRef);
            const loginPageViewsToday = dailyViewsSnap.exists() ? dailyViewsSnap.data()?.count || 0 : 0;

            return {
                totalLogins,
                loginPageViews,
                loginPageViewsToday
            };
        } catch (error) {
            console.error("Erro ao buscar estatísticas de login:", error);
            return {
                totalLogins: 0,
                loginPageViews: 0,
                loginPageViewsToday: 0
            };
        }
    },

    async getAccessLogs(filter: 'today' | 'week' | 'month') {
        let startDate = new Date();
        if (filter === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (filter === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (filter === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
        }

        try {
            const isoCheck = startDate.toISOString();
            const logsRef = collection(db, 'access_logs');
            const q = query(
                logsRef,
                where('date', '>=', isoCheck),
                orderBy('date', 'desc'),
                limit(200)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Erro ao buscar logs de acesso:", error);
            // Fallback: buscar últimos 50 sem filtro de data complexo para evitar erro de index se não houver
            try {
                const logsRef = collection(db, 'access_logs');
                const qFallback = query(
                    logsRef,
                    orderBy('date', 'desc'),
                    limit(50)
                );
                const snapshot = await getDocs(qFallback);
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (e) {
                console.error("Erro fatal ao buscar logs:", e);
                return [];
            }
        }
    }
};
