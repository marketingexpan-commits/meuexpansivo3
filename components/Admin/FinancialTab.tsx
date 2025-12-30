import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
    SchoolUnit,
    Student,
    Mensalidade,
    UnitContact,
    ContactRole
} from '../../types';
import { SCHOOL_UNITS_LIST } from '../../constants';
import { Button } from '../Button';
import { db } from '../../firebaseConfig';
import { calculateFinancials } from '../../utils/financialUtils';
import { sanitizePhone } from '../../utils/formattingUtils';

interface FinancialTabProps {
    isGeneralAdmin: boolean;
    adminUnit?: SchoolUnit;
    unitContacts: UnitContact[];
    students: Student[];
    onAddUnitContact?: (contact: UnitContact) => void;
    onEditUnitContact?: (contact: UnitContact) => void;
    onGenerateFees?: () => Promise<void>;
    onFixDuplicates?: () => Promise<void>;
    setSelectedStudentForFinancial: (student: Student) => void;
    setIsFinancialModalOpen: (open: boolean) => void;
    setSelectedReceiptForModal: (receipt: Mensalidade) => void;
}

export const FinancialTab: React.FC<FinancialTabProps> = ({
    isGeneralAdmin,
    adminUnit,
    unitContacts,
    students,
    onAddUnitContact,
    onEditUnitContact,
    onGenerateFees,
    onFixDuplicates,
    setSelectedStudentForFinancial,
    setIsFinancialModalOpen,
    setSelectedReceiptForModal
}) => {
    // --- LOCAL STATES ---
    const [financialRecords, setFinancialRecords] = useState<Mensalidade[]>([]);
    const [loadingFinancial, setLoadingFinancial] = useState(false);

    const [historyFilterUnit, setHistoryFilterUnit] = useState<string>(!isGeneralAdmin && adminUnit ? adminUnit : '');
    const [historyFilterMonth, setHistoryFilterMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [showFinancialTools, setShowFinancialTools] = useState(false);
    const [showDelinquencyList, setShowDelinquencyList] = useState(false);

    const [contactUnit, setContactUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('+55');
    const [editingContactId, setEditingContactId] = useState<string | null>(null);

    const [isBulkSendingModalOpen, setIsBulkSendingModalOpen] = useState(false);
    const [bulkCurrentIndex, setBulkCurrentIndex] = useState(0);

    // --- FETCH DATA ---
    useEffect(() => {
        const fetchFinancial = async () => {
            setLoadingFinancial(true);
            try {
                const snapshot = await db.collection('mensalidades').get();
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mensalidade));
                setFinancialRecords(data);
            } catch (error) {
                console.error("Error fetching financial records:", error);
            } finally {
                setLoadingFinancial(false);
            }
        };
        fetchFinancial();
    }, []);

    // --- AUTO-FILL CONTACT ---
    useEffect(() => {
        const existing = unitContacts.find(c => c.unit === contactUnit && c.role === ContactRole.FINANCIAL);
        if (existing) {
            setEditingContactId(existing.id);
            setContactName(existing.name);
            setContactPhone(existing.phoneNumber);
        } else {
            setEditingContactId(null);
            setContactName('');
            setContactPhone('+55');
        }
    }, [contactUnit, unitContacts]);

    // --- HANDLERS ---
    const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setContactPhone(e.target.value.replace(/\D/g, ''));
    };

    const handleSaveContact = () => {
        if (!contactName || !contactPhone) return alert("Preencha nome e telefone.");

        const newContact: UnitContact = {
            id: editingContactId || `contact-${Date.now()}`,
            name: contactName,
            phoneNumber: contactPhone,
            role: ContactRole.FINANCIAL,
            unit: contactUnit,
        };

        if (editingContactId && onEditUnitContact) {
            onEditUnitContact(newContact);
            alert('Contato atualizado com sucesso!');
        } else if (onAddUnitContact) {
            onAddUnitContact(newContact);
            alert('Contato adicionado com sucesso!');
        }

        if (!editingContactId) {
            setContactName('');
            setContactPhone('+55');
        }
    };

    // --- CALCULATIONS ---
    const { totalExpected, totalPending, delinquentStudents, progress, totalReceived, receivedRecordsLength } = useMemo(() => {
        if (!historyFilterMonth) return { totalExpected: 0, totalPending: 0, delinquentStudents: [], progress: 0, totalReceived: 0, receivedRecordsLength: 0 };

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const [fYear, fMonth] = historyFilterMonth.split('-');
        const fMonthName = monthNames[parseInt(fMonth) - 1];
        const targetReference = `${fMonthName}/${fYear}`;

        let totalExpected = 0;
        let totalPending = 0;
        const delinquentStudents: any[] = [];

        const competencyRecords = financialRecords.filter(rec => {
            const s = students.find(st => st.id === rec.studentId);
            if (!s || (historyFilterUnit && s.unit !== historyFilterUnit)) return false;
            return rec.month === targetReference;
        });

        competencyRecords.forEach(rec => {
            const s = students.find(st => st.id === rec.studentId);
            const fin = calculateFinancials(rec);
            totalExpected += fin.total;

            if (rec.status !== 'Pago') {
                totalPending += fin.total;
                delinquentStudents.push({
                    ...rec,
                    value: fin.total,
                    originalValue: fin.originalValue,
                    fine: fin.fine,
                    interest: fin.interest,
                    studentName: s?.name,
                    studentPhone: (s?.telefone_responsavel || s?.telefone || s?.phone || s?.contactPhone),
                    studentShift: s?.shift,
                    studentClass: s?.schoolClass,
                    studentUnit: s?.unit
                });
            }
        });

        const receivedRecords = financialRecords.filter(rec => {
            const s = students.find(st => st.id === rec.studentId);
            if (!s || (historyFilterUnit && s.unit !== historyFilterUnit)) return false;
            if (rec.status === 'Pago' && rec.paymentDate) {
                return rec.paymentDate.substring(0, 7) === historyFilterMonth;
            }
            return false;
        });

        const totalReceived = receivedRecords.reduce((acc, rec) => {
            const fin = calculateFinancials(rec);
            return acc + fin.total;
        }, 0);
        const progress = totalExpected > 0 ? (totalReceived / totalExpected) * 100 : 0;

        return { totalExpected, totalPending, delinquentStudents, progress, totalReceived, receivedRecordsLength: receivedRecords.length };
    }, [financialRecords, students, historyFilterUnit, historyFilterMonth]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* CONFIGURAÇÃO DO SETOR FINANCEIRO */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <span>⚙️</span> Configuração de Contato (WhatsApp)
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    Defina aqui o número de WhatsApp que receberá os comprovantes de pagamento desta unidade.
                    Este número será acionado automaticamente pelo App do Aluno.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Unidade</label>
                        {isGeneralAdmin ? (
                            <select
                                value={contactUnit}
                                onChange={e => setContactUnit(e.target.value as SchoolUnit)}
                                className="w-full p-2.5 border rounded-lg bg-gray-50"
                            >
                                {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        ) : (
                            <div className="p-2.5 bg-gray-100 rounded-lg text-gray-600 font-medium border border-gray-200">{adminUnit}</div>
                        )}
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Nome do Responsável</label>
                        <input
                            type="text"
                            value={contactName}
                            onChange={e => setContactName(e.target.value)}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Financeiro Central"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">WhatsApp (Com DDD)</label>
                        <input
                            type="text"
                            value={contactPhone}
                            onChange={handleContactPhoneChange}
                            className="w-full p-2.5 border rounded-lg font-mono text-gray-700"
                            placeholder="5584999999999"
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <Button
                        onClick={handleSaveContact}
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg shadow-sm flex items-center gap-2"
                    >
                        <span>💾</span> {editingContactId ? 'Atualizar Contato' : 'Salvar Contato'}
                    </Button>
                </div>
            </div>

            {/* FINANCIAL DASHBOARD */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span>💲</span> Resumo Financeiro
                        </h2>
                        <p className="text-sm text-gray-500">Acompanhamento de receitas via Mensalidades, por Unidade</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* 1. FILTER & ACTION TOOLBAR */}
                    <div className="flex flex-col xl:flex-row gap-4 justify-between items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
                            <div className="w-full md:w-64">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unidade</label>
                                {isGeneralAdmin ? (
                                    <select
                                        value={historyFilterUnit}
                                        onChange={e => setHistoryFilterUnit(e.target.value)}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                                    >
                                        <option value="">Selecione...</option>
                                        {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                ) : (
                                    <div className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-700 font-bold">
                                        {adminUnit}
                                    </div>
                                )}
                            </div>
                            <div className="w-full md:w-48">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referência</label>
                                <input
                                    type="month"
                                    value={historyFilterMonth}
                                    onChange={e => setHistoryFilterMonth(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 w-full xl:w-auto justify-end items-center">
                            <button
                                onClick={() => setShowFinancialTools(!showFinancialTools)}
                                className={`py-2.5 px-3 rounded-lg border transition-all ${showFinancialTools ? 'bg-gray-200 border-gray-300 text-gray-800' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                title="Ferramentas Avançadas"
                            >
                                <span>⚙️</span>
                            </button>

                            <button
                                onClick={() => {
                                    const exportData = financialRecords.filter(rec => {
                                        const s = students.find(st => st.id === rec.studentId);
                                        if (!s || (historyFilterUnit && s.unit !== historyFilterUnit)) return false;
                                        const [fYear, fMonth] = historyFilterMonth.split('-');
                                        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                                        const fMonthName = monthNames[parseInt(fMonth) - 1];
                                        const targetReference = `${fMonthName}/${fYear}`;
                                        return rec.month === targetReference;
                                    }).map(rec => {
                                        const s = students.find(st => st.id === rec.studentId);
                                        return {
                                            Data: rec.paymentDate ? new Date(rec.paymentDate).toLocaleDateString() : 'Pendente',
                                            Aluno: s?.name || 'Desconhecido',
                                            Unidade: s?.unit,
                                            Referencia: rec.month,
                                            Valor: rec.value,
                                            Status: rec.status,
                                            Recibo: rec.receiptUrl || '-'
                                        };
                                    });

                                    const ws = XLSX.utils.json_to_sheet(exportData);
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
                                    XLSX.writeFile(wb, `Financeiro_${historyFilterUnit}_${historyFilterMonth}.xlsx`);
                                }}
                                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-2.5 px-4 rounded-lg shadow-sm flex items-center gap-2 text-sm transition-all"
                            >
                                <span>📊</span> Exportar Excel
                            </button>
                        </div>
                    </div>

                    {/* ADVANCED TOOLS SECTION */}
                    {showFinancialTools && (
                        <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 animate-fade-in">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-3">Ferramentas de Manutenção</p>
                            <div className="flex gap-3 flex-wrap">
                                <button
                                    onClick={onGenerateFees}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center gap-2 text-sm"
                                >
                                    <span>⚙️</span> Gerar Carnês (Lote)
                                </button>
                                {onFixDuplicates && (
                                    <button
                                        onClick={onFixDuplicates}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center gap-2 text-sm"
                                    >
                                        <span>🧹</span> Corrigir Duplicidades
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 2. KPI CARDS */}
                    {(!historyFilterUnit || !historyFilterMonth) ? (
                        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            Selecione uma Unidade e Mês de Referência para ver os indicadores.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-5 rounded-xl border-l-4 border-l-green-500 shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Recebido (Realizado)</p>
                                        <h3 className="text-2xl font-black text-green-700">R$ {totalReceived.toFixed(2).replace('.', ',')}</h3>
                                    </div>
                                    <div className="mt-4 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                                        {receivedRecordsLength} pagamentos confirmados
                                    </div>
                                </div>

                                <div className={`bg-white p-5 rounded-xl border-l-4 border-l-red-500 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer hover:bg-red-50 transition-colors ${showDelinquencyList ? 'ring-2 ring-red-500' : ''}`}
                                    onClick={() => setShowDelinquencyList(!showDelinquencyList)}>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pendente (Inadimplência)</p>
                                        <h3 className="text-2xl font-black text-red-600">R$ {totalPending.toFixed(2).replace('.', ',')}</h3>
                                    </div>
                                    <div className="mt-4 flex justify-between items-center">
                                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded flex items-center gap-1">
                                            <span>⚠️</span> {delinquentStudents.length} Alunos
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium">Clique para ver lista</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border-l-4 border-l-blue-500 shadow-sm border border-gray-100 flex flex-col justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Potencial (Previsto)</p>
                                        <h3 className="text-2xl font-black text-blue-900">R$ {totalExpected.toFixed(2).replace('.', ',')}</h3>
                                    </div>
                                    <div className="mt-4 w-full">
                                        <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                            <span>Progresso da Meta</span>
                                            <span>{progress.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DELINQUENCY LIST */}
                            {showDelinquencyList && delinquentStudents.length > 0 && (
                                <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden animate-fade-in">
                                    <div className="bg-red-100 px-6 py-3 border-b border-red-200 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <h4 className="font-bold text-red-800 flex items-center gap-2">
                                                <span>📋</span> Lista de Pendências ({delinquentStudents.length})
                                            </h4>
                                            {delinquentStudents.some(s => s.studentPhone) && (
                                                <button
                                                    onClick={() => {
                                                        setBulkCurrentIndex(0);
                                                        setIsBulkSendingModalOpen(true);
                                                    }}
                                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 animate-pulse"
                                                >
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                    Cobrar Todos ({delinquentStudents.filter(s => s.studentPhone).length})
                                                </button>
                                            )}
                                        </div>
                                        <button onClick={() => setShowDelinquencyList(false)} className="text-red-600 hover:text-red-800 text-sm font-bold">Fechar</button>
                                    </div>
                                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                        <table className="w-full text-left bg-white">
                                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0">
                                                <tr>
                                                    <th className="px-6 py-3">Aluno</th>
                                                    <th className="px-6 py-3">Turma</th>
                                                    <th className="px-6 py-3 text-right">Valor</th>
                                                    <th className="px-6 py-3 text-center">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {delinquentStudents.map((st, idx) => (
                                                    <tr key={idx} className="hover:bg-red-50/30">
                                                        <td className="px-6 py-3 text-sm font-bold text-gray-800">{st.studentName}</td>
                                                        <td className="px-6 py-3 text-sm text-gray-600">{st.studentClass} ({st.studentShift})</td>
                                                        <td className="px-6 py-3 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-sm font-bold text-red-600">R$ {st.value.toFixed(2)}</span>
                                                                {st.value > st.originalValue && (
                                                                    <span className="text-[10px] text-gray-400">
                                                                        (Orig: R$ {st.originalValue.toFixed(2)})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            {st.studentPhone ? (
                                                                <a
                                                                    href={`https://wa.me/${st.studentPhone ? sanitizePhone(st.studentPhone) : ''}?text=Prezado responsável, informamos que consta uma pendência financeira referente ao aluno(a) *${st.studentName}* relativa ao mês de *${st.month}*. Valor atualizado (com juros/multa): *R$ ${st.value.toFixed(2)}*. Para regularizar, acesse a área financeira do nosso aplicativo: https://meuexpansivo.vercel.app/ . Caso já tenha efetuado o pagamento, por favor, desconsidere esta mensagem.`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold hover:bg-green-600"
                                                                >
                                                                    Cobrar
                                                                </a>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold cursor-not-allowed">
                                                                    <span>📵</span> Sem Tel
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Transações (Filtradas)</h3>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Exibindo apenas Pagos</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Data Pagto</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Aluno / Mãe</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Unidade</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Referência</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Recibo</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {financialRecords.length > 0 ? (
                                financialRecords
                                    .filter(rec => {
                                        const s = students.find(st => st.id === rec.studentId);
                                        if (rec.status !== 'Pago') return false;
                                        let unitMatch = true;
                                        if (isGeneralAdmin) {
                                            unitMatch = historyFilterUnit ? s?.unit === historyFilterUnit : true;
                                        } else {
                                            unitMatch = s?.unit === adminUnit;
                                        }
                                        let dateMatch = true;
                                        if (historyFilterMonth) {
                                            if (!rec.paymentDate) {
                                                dateMatch = false;
                                            } else {
                                                const pDate = rec.paymentDate.substring(0, 7);
                                                dateMatch = pDate === historyFilterMonth;
                                            }
                                        }
                                        return unitMatch && dateMatch;
                                    })
                                    .sort((a, b) => new Date(b.lastUpdated || b.createdAt).getTime() - new Date(a.lastUpdated || a.createdAt).getTime())
                                    .slice(0, 50)
                                    .map(rec => {
                                        const s = students.find(st => st.id === rec.studentId);
                                        return (
                                            <tr key={rec.id} className="hover:bg-gray-50/50">
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {new Date(rec.lastUpdated || rec.createdAt).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <button onClick={() => { if (s) { setSelectedStudentForFinancial(s); setIsFinancialModalOpen(true); } }} className="font-bold text-gray-800 text-sm hover:text-blue-600 hover:underline text-left">
                                                            {s?.name || 'Aluno Excluído'}
                                                        </button>
                                                        <span className="text-xs text-gray-500">{s?.nome_responsavel || 'Resp. N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className="bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded font-medium">
                                                        {s?.unit || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {rec.month}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {rec.status === 'Pago' || rec.receiptUrl ? (
                                                        <button
                                                            onClick={() => {
                                                                if (s) {
                                                                    setSelectedStudentForFinancial(s);
                                                                    setSelectedReceiptForModal(rec as Mensalidade);
                                                                } else {
                                                                    alert("Erro: Aluno não encontrado para este recibo.");
                                                                }
                                                            }}
                                                            title="Ver Comprovante Oficial"
                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors"
                                                        >
                                                            📄
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs" title="Sem recibo disponível">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-green-700 text-right">
                                                    {(() => {
                                                        const fin = calculateFinancials(rec);
                                                        return (
                                                            <div className="flex flex-col items-end">
                                                                <span>R$ {fin.total.toFixed(2).replace('.', ',')}</span>
                                                                {fin.total > fin.originalValue && (
                                                                    <span className="text-[10px] text-gray-400 font-normal">
                                                                        (Orig: R$ {fin.originalValue.toFixed(2)})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        );
                                    })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                                        {loadingFinancial ? "Carregando transações..." : "Nenhum pagamento registrado encontrado."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE ENVIO EM MASSA (SEQUENCIAL) */}
            {isBulkSendingModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-gray-900 bg-opacity-80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
                        {(() => {
                            const validList = delinquentStudents.filter(s => s.studentPhone);
                            const currentStudent = validList[bulkCurrentIndex];

                            if (!currentStudent) {
                                return (
                                    <div className="p-8 text-center flex flex-col items-center">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                            <span className="text-3xl">✅</span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Envio Concluído!</h2>
                                        <p className="text-gray-600 mb-6">Todas as cobranças possíveis foram processadas.</p>
                                        <Button onClick={() => { setIsBulkSendingModalOpen(false); setBulkCurrentIndex(0); }}>
                                            Fechar Janela
                                        </Button>
                                    </div>
                                );
                            }

                            const progressPercent = ((bulkCurrentIndex) / validList.length) * 100;
                            const messageText = `Prezado responsável, informamos que consta uma pendência financeira referente ao aluno(a) *${currentStudent.studentName}* relativa ao mês de *${currentStudent.month}*. Valor atualizado (com juros/multa): *R$ ${currentStudent.value.toFixed(2)}*. Para regularizar, acesse a área financeira do nosso aplicativo: https://meuexpansivo.vercel.app/ . Caso já tenha efetuado o pagamento, por favor, desconsidere esta mensagem.`;
                            const waLink = `https://wa.me/${currentStudent.studentPhone ? sanitizePhone(currentStudent.studentPhone) : ''}?text=${encodeURIComponent(messageText)}`;

                            return (
                                <div className="flex flex-col h-full">
                                    <div className="bg-gradient-to-r from-blue-950 to-blue-900 p-4 text-white">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-lg">Enviando Cobranças 🚀</h3>
                                            <span className="text-xs bg-white/20 px-2 py-1 rounded font-mono">
                                                {bulkCurrentIndex + 1} / {validList.length}
                                            </span>
                                        </div>
                                        <div className="w-full bg-blue-950/50 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-green-400 h-full transition-all duration-300"
                                                style={{ width: `${progressPercent}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="p-6 flex flex-col items-center text-center flex-1">
                                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-lg -mt-14">
                                            <span className="text-4xl">👨‍🎓</span>
                                        </div>
                                        <h2 className="text-xl font-bold text-gray-800 mb-1">{currentStudent.studentName}</h2>
                                        <p className="text-sm text-gray-500 mb-4">{currentStudent.studentClass} ({currentStudent.studentShift})</p>
                                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl w-full mb-6 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl">Atrasado</div>
                                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Valor Atualizado</p>
                                            <p className="text-3xl font-black text-red-600">R$ {currentStudent.value.toFixed(2)}</p>
                                            <p className="text-xs text-gray-400 mt-1">Ref: {currentStudent.month}</p>
                                        </div>
                                        <p className="text-xs text-gray-400 mb-2">Telefone: <span className="font-mono text-gray-600">{currentStudent.studentPhone}</span></p>
                                    </div>

                                    <div className="p-4 bg-gray-50 border-t flex flex-col gap-3">
                                        <a
                                            href={waLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={() => {
                                                setTimeout(() => {
                                                    setBulkCurrentIndex(prev => prev + 1);
                                                }, 1000);
                                            }}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                                        >
                                            Próximo Aluno ➡️
                                        </a>
                                        <button
                                            onClick={() => { setIsBulkSendingModalOpen(false); setBulkCurrentIndex(0); }}
                                            className="text-gray-400 hover:text-gray-600 font-bold text-sm py-2"
                                        >
                                            Parar Envio
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};
