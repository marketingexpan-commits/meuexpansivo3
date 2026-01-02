
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { Mensalidade, Student } from '../types';

const MENSALIDADES_COLLECTION = 'mensalidades';

export const financialService = {
    // Buscar mensalidades com filtros
    async getMensalidades(filters: { unit?: string | null, month?: string, status?: string, studentId?: string }) {
        try {
            let q = query(collection(db, MENSALIDADES_COLLECTION));

            if (filters.status && filters.status !== 'Todos') {
                q = query(q, where('status', '==', filters.status));
            }

            if (filters.month) {
                q = query(q, where('month', '==', filters.month));
            }

            if (filters.studentId) {
                q = query(q, where('studentId', '==', filters.studentId));
            }

            const snap = await getDocs(q);
            let results = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Mensalidade[];

            // O Firestore não permite filtros complexos em coleções diferentes facilmente.
            if (filters.unit && !filters.studentId) {
                const studentsRef = collection(db, 'students');
                const qStudents = query(studentsRef, where('unit', '==', filters.unit));
                const studentSnap = await getDocs(qStudents);
                const unitStudentIds = new Set(studentSnap.docs.map(d => d.id));

                results = results.filter(m => unitStudentIds.has(m.studentId));
            }

            return results;
        } catch (error) {
            console.error("Erro ao buscar mensalidades:", error);
            throw error;
        }
    },

    // Buscar resumo financeiro consolidado
    async getFinancialSummary(unit?: string | null) {
        const mensalidades = await this.getMensalidades({ unit });

        const totalValue = mensalidades.reduce((acc, curr) => acc + (curr.value || 0), 0);
        const paidValue = mensalidades.filter(m => m.status === 'Pago').reduce((acc, curr) => acc + (curr.value || 0), 0);

        return {
            total: mensalidades.length,
            paid: mensalidades.filter(m => m.status === 'Pago').length,
            pending: mensalidades.filter(m => m.status !== 'Pago').length,
            overdue: mensalidades.filter(m => m.status === 'Atrasado').length,
            totalValue,
            paidValue,
            delinquencyRate: mensalidades.length > 0 ? (mensalidades.filter(m => m.status !== 'Pago').length / mensalidades.length) * 100 : 0
        };
    },

    // Registrar pagamento manual
    async markAsPaid(mensalidadeId: string, details: { method: string, paidValue: number, interest: number, penalty: number, paymentDate: string }) {
        try {
            const docRef = doc(db, MENSALIDADES_COLLECTION, mensalidadeId);
            await updateDoc(docRef, {
                status: 'Pago',
                paymentDate: details.paymentDate,
                paymentMethod: details.method,
                paidValue: details.paidValue,
                interestValue: details.interest,
                penaltyValue: details.penalty,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erro ao atualizar pagamento:", error);
            throw error;
        }
    },

    // Atualizar dados arbitrários de uma parcela
    async updateInstallment(id: string, data: any) {
        try {
            const docRef = doc(db, MENSALIDADES_COLLECTION, id);
            await updateDoc(docRef, {
                ...data,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erro ao atualizar parcela:", error);
            throw error;
        }
    },


    // Gerar mensalidades em lote para todos os alunos de uma unidade
    async generateBatchFees(unit: string, month: string, year: number, defaultValue: number) {
        try {
            const studentsRef = collection(db, 'students');
            const q = query(studentsRef, where('unit', '==', unit), where('isBlocked', '==', false));
            const snap = await getDocs(q);
            const students = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];

            const batch = writeBatch(db);
            const refMonth = `${month}/${year}`;
            let createdCount = 0;

            for (const student of students) {
                // Verificar se já existe mensalidade para este mês/aluno
                const existingQuery = query(
                    collection(db, MENSALIDADES_COLLECTION),
                    where('studentId', '==', student.id),
                    where('month', '==', refMonth)
                );
                const existingSnap = await getDocs(existingQuery);

                if (existingSnap.empty) {
                    const newDocRef = doc(collection(db, MENSALIDADES_COLLECTION));
                    batch.set(newDocRef, {
                        studentId: student.id,
                        month: refMonth,
                        value: student.valor_mensalidade || defaultValue,
                        status: 'Pendente',
                        dueDate: `${year}-${this._getMonthNumber(month)}-05`,
                        lastUpdated: new Date().toISOString()
                    });
                    createdCount++;
                }
            }

            if (createdCount > 0) {
                await batch.commit();
            }
            return createdCount;
        } catch (error) {
            console.error("Erro na geração em lote:", error);
            throw error;
        }
    },

    // Gerar parcelamento anual (Carnê) para um aluno específico
    async generateInstallments(studentId: string, startMonth: number, endMonth: number, year: number, value?: number, withBoletos: boolean = false) {
        try {
            const batch = writeBatch(db);
            const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            let createdCount = 0;

            // Buscar dados do aluno para valor padrão e para gerar boleto
            let studentData: any = null;
            const studentDoc = await getDocs(query(collection(db, 'students'), where('__name__', '==', studentId)));

            if (!studentDoc.empty) {
                studentData = { id: studentDoc.docs[0].id, ...studentDoc.docs[0].data() };
            }

            let installmentValue = value;
            if (!installmentValue && studentData) {
                installmentValue = studentData.valor_mensalidade || 0;
            }

            for (let i = startMonth - 1; i < endMonth; i++) {
                const monthName = months[i];
                const refMonth = `${monthName}/${year}`;
                const monthNum = (i + 1).toString().padStart(2, '0');
                const dueDate = `${year}-${monthNum}-05`;

                // Verificar duplicidade
                const existingQuery = query(
                    collection(db, MENSALIDADES_COLLECTION),
                    where('studentId', '==', studentId),
                    where('month', '==', refMonth)
                );
                const existingSnap = await getDocs(existingQuery);

                if (existingSnap.empty) {
                    const newDocRef = doc(collection(db, MENSALIDADES_COLLECTION));

                    let boletoData = {};
                    if (withBoletos && studentData) {
                        try {
                            const payer = {
                                email: studentData.email || 'email@padrao.com',
                                firstName: studentData.name.split(' ')[0],
                                lastName: studentData.name.split(' ').slice(1).join(' '),
                                cpf: studentData.cpf || studentData.responsibleCpf || '00000000000',
                                address: {
                                    zipCode: studentData.zipCode || '59000000',
                                    streetName: studentData.address || 'Endereço não informado',
                                    streetNumber: 'S/N',
                                    neighborhood: studentData.neighborhood || 'Bairro',
                                    city: studentData.city || 'Natal',
                                    state: 'RN'
                                }
                            };

                            const boletoResult = await this.generateBoleto({
                                studentId,
                                amount: installmentValue || 0,
                                dueDate: new Date(dueDate).toISOString(),
                                description: `Mensalidade ${refMonth} - ${studentData.name}`,
                                payer
                            });

                            if (boletoResult.barcode) {
                                boletoData = {
                                    barcode: boletoResult.barcode,
                                    ticketUrl: boletoResult.ticketUrl,
                                    qrCode: boletoResult.qrCode,
                                    qrCodeBase64: boletoResult.qrCodeBase64
                                };
                            }
                        } catch (err) {
                            console.error(`Erro ao gerar boleto para ${refMonth}:`, err);
                        }
                    }

                    batch.set(newDocRef, {
                        studentId: studentId,
                        month: refMonth,
                        value: installmentValue,
                        status: 'Pendente',
                        dueDate: dueDate,
                        lastUpdated: new Date().toISOString(),
                        documentNumber: Math.floor(100000 + Math.random() * 900000).toString(), // Gerar Cód Baixa
                        ...boletoData
                    });
                    createdCount++;
                }
            }

            if (createdCount > 0) {
                await batch.commit();
            }
            return createdCount;
        } catch (error) {
            console.error("Erro ao gerar parcelamento:", error);
            throw error;
        }
    },

    // Buscar parcelas para impressão (Carnê)
    async getInstallmentsForPrint(studentId: string, year: number) {
        try {
            // Busca todas as mensalidades do ano para este aluno
            // Filtro por string 'mes/ano' requer cuidado, vamos buscar todas do aluno e filtrar no js ou usar range
            // Como formato é MM/YYYY, melhor buscar todas 'Pendente' do aluno e filtrar o ano

            const q = query(
                collection(db, MENSALIDADES_COLLECTION),
                where('studentId', '==', studentId),
                where('status', '==', 'Pendente') // Apenas pendentes vão pro carnê
            );

            const snap = await getDocs(q);
            const allInstallments = snap.docs.map(d => d.data());

            // Filtrar pelo ano
            return allInstallments.filter(i => i.month.endsWith(`/${year}`));
        } catch (error) {
            console.error("Erro ao buscar parcelas para impressão:", error);
            throw error;
        }
    },

    // Buscar parcela pelo Código de Baixa
    async findInstallmentByDocumentNumber(code: string) {
        try {
            const q = query(
                collection(db, MENSALIDADES_COLLECTION),
                where('documentNumber', '==', code)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const doc = snap.docs[0];
                return { id: doc.id, ...doc.data() } as Mensalidade;
            }
            return null;
        } catch (error) {
            console.error("Erro ao buscar por código de baixa:", error);
            throw error;
        }
    },

    // Auxiliar para pegar número do mês
    // Auxiliar para pegar número do mês
    _getMonthNumber(monthLabel: string): string {
        const mapping: Record<string, string> = {
            "Janeiro": "01", "Fevereiro": "02", "Março": "03", "Abril": "04", "Maio": "05", "Junho": "06",
            "Julho": "07", "Agosto": "08", "Setembro": "09", "Outubro": "10", "Novembro": "11", "Dezembro": "12"
        };
        return mapping[monthLabel] || "05";
    },

    // Deletar uma mensalidade
    async deleteFee(id: string) {
        try {
            const docRef = doc(db, MENSALIDADES_COLLECTION, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erro ao deletar mensalidade:", error);
            throw error;
        }
    },

    // Atualizar valor ou status de uma mensalidade
    async updateFee(id: string, updates: Partial<Mensalidade>) {
        try {
            const docRef = doc(db, MENSALIDADES_COLLECTION, id);
            await updateDoc(docRef, {
                ...updates,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erro ao atualizar mensalidade:", error);
            throw error;
        }
    },

    // --- MÉTODOS DE DESPESAS (CONTAS A PAGAR) ---

    async getExpenses(filters: { unit?: string | null, status?: string }) {
        try {
            let q = query(collection(db, 'despesas'));

            if (filters.unit) {
                q = query(q, where('unit', '==', filters.unit));
            }

            if (filters.status && filters.status !== 'Todos') {
                q = query(q, where('status', '==', filters.status));
            }

            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        } catch (error) {
            console.error("Erro ao buscar despesas:", error);
            throw error;
        }
    },

    async addExpense(expense: any) {
        try {
            const batch = writeBatch(db);
            const newDocRef = doc(collection(db, 'despesas'));
            batch.set(newDocRef, {
                ...expense,
                createdAt: new Date().toISOString()
            });
            await batch.commit();
            return newDocRef.id;
        } catch (error) {
            console.error("Erro ao adicionar despesa:", error);
            throw error;
        }
    },

    async deleteExpense(id: string) {
        try {
            const docRef = doc(db, 'despesas', id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erro ao deletar despesa:", error);
            throw error;
        }
    },

    async updateExpense(id: string, updates: any) {
        try {
            const docRef = doc(db, 'despesas', id);
            await updateDoc(docRef, {
                ...updates,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erro ao atualizar despesa:", error);
            throw error;
        }
    },

    // --- MANUTENÇÃO ---
    async fixMissingDocumentNumbers() {
        try {
            const q = query(collection(db, MENSALIDADES_COLLECTION), where('status', '==', 'Pendente'));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            let updateCount = 0;

            snap.docs.forEach(doc => {
                const data = doc.data();
                if (!data.documentNumber) {
                    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                    batch.update(doc.ref, { documentNumber: newCode });
                    updateCount++;
                }
            });

            if (updateCount > 0) {
                await batch.commit();
            }
            return updateCount;
        } catch (error) {
            console.error("Erro ao corrigir códigos:", error);
            throw error;
        }
    },

    // GERAR BOLETO (Backend Function)
    async generateBoleto(data: any) {
        try {
            const response = await fetch('https://us-central1-meuexpansivo-v2.cloudfunctions.net/generateBoleto', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao gerar boleto');
            }

            return result;
        } catch (error) {
            console.error("Erro na service generateBoleto:", error);
            throw error;
        }
    }
};
