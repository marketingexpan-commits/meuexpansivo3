import React from 'react';
import { db } from '../../firebaseConfig';
import { calculateFinancials } from '../../utils/financialUtils';
import { Student, Mensalidade } from '../../types';
import { Button } from '../Button';
import { FileText, X } from 'lucide-react';

interface StudentFinancialModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    mensalidades: Mensalidade[];
    isGeneralAdmin: boolean;
    onSetSelectedManualFee: (fee: Mensalidade) => void;
    onSetManualPaymentMethod: (method: string) => void;
    onSetIsManualPaymentModalOpen: (isOpen: boolean) => void;
    onDeleteFee?: (id: string) => void;
}

const StudentFinancialModal: React.FC<StudentFinancialModalProps> = ({
    isOpen,
    onClose,
    student,
    mensalidades,
    isGeneralAdmin,
    onSetSelectedManualFee,
    onSetManualPaymentMethod,
    onSetIsManualPaymentModalOpen,
    onDeleteFee
}) => {
    if (!isOpen || !student) return null;

    const studentFees = mensalidades.filter(m => m.studentId === student.id);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in border border-slate-200">
                {/* HEADER */}
                <div className="bg-white p-6 border-b border-zinc-100 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="min-w-[50px] w-[50px] h-[50px] bg-blue-950/10 rounded-xl border border-blue-950/20 flex items-center justify-center shrink-0">
                                <FileText className="w-6 h-6 text-blue-950" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-xl md:text-2xl font-bold text-zinc-900 leading-tight">
                                    Gestão Financeira
                                </h2>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-zinc-600 font-bold text-sm md:text-base">{student.name}</span>
                                    <span className="hidden md:block w-1 h-1 bg-zinc-300 rounded-full" />
                                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                                        {student.gradeLevel} • {student.schoolClass} • {student.unit}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="absolute top-0 right-0 md:static p-2 hover:bg-blue-950/10 rounded-full transition-all text-blue-950/40 hover:text-blue-950 group -mr-2 md:mr-0 -mt-2 md:mt-0">
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {studentFees.sort((a, b) => {
                            if (a.dueDate && b.dueDate) {
                                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                            }
                            const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                            const aMonth = a.month.split('/')[0];
                            const bMonth = b.month.split('/')[0];
                            return months.indexOf(aMonth) - months.indexOf(bMonth);
                        }).map((fee) => {
                            const fin = calculateFinancials(fee);
                            const isPaid = fee.status === 'Pago';

                            return (
                                <div key={fee.id} className={`group p-5 rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-1 duration-300 ${isPaid ? 'border-emerald-100 bg-white shadow-emerald-100/20' : 'border-slate-200 bg-white shadow-slate-200/20'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex flex-col">
                                            <span className="font-black text-xl text-slate-800 tracking-tight">{fee.month}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Referência</span>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm border ${isPaid ? 'bg-blue-950/10 text-blue-950 border-blue-950/20' : 'bg-orange-600/10 text-orange-600 border-orange-600/20'}`}>
                                            {fee.status}
                                        </span>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-slate-900">R$ {fin.total.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                        {fin.total > fin.originalValue && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-slate-400 line-through">R$ {fin.originalValue.toFixed(2)}</span>
                                                <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded">+{((fin.total / fin.originalValue - 1) * 100).toFixed(0)}% juros/multa</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-slate-50">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                Vencimento: <span className="font-bold text-slate-700">{new Date(fee.dueDate).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            {fee.paymentDate && (
                                                <div className="flex items-center gap-2 text-xs text-blue-950 font-bold bg-blue-950/5 p-2 rounded-lg mt-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-950/40" />
                                                    Liquidado em: {new Date(fee.paymentDate).toLocaleDateString('pt-BR')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 mt-auto grid grid-cols-1 gap-3">
                                        {isPaid ? (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm("Admin: Desfazer pagamento e reverter para Pendente?")) return;
                                                    try {
                                                        await db.collection('mensalidades').doc(fee.id).update({
                                                            status: 'Pendente',
                                                            paymentDate: null,
                                                            receiptUrl: null,
                                                            lastUpdated: new Date().toISOString()
                                                        });
                                                    } catch (e) { alert("Erro ao processar."); }
                                                }}
                                                className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all border border-slate-100"
                                            >
                                                Desfazer Pagamento
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    onSetSelectedManualFee(fee);
                                                    onSetManualPaymentMethod('Pix');
                                                    onSetIsManualPaymentModalOpen(true);
                                                }}
                                                className="w-full py-3 text-xs font-black uppercase tracking-wider text-white bg-blue-950 hover:bg-black rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all text-center"
                                            >
                                                Receber Agora
                                            </button>
                                        )}
                                        {isGeneralAdmin && (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm("ATENÇÃO ADMIN: Esta cobrança será EXCLUÍDA permanentemente. Confirmar?")) return;
                                                    try {
                                                        await db.collection('mensalidades').doc(fee.id).delete();
                                                        if (onDeleteFee) onDeleteFee(fee.id);
                                                    } catch (e) { alert("Erro ao excluir."); console.error(e); }
                                                }}
                                                className="w-full py-2 text-[10px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-all text-center"
                                            >
                                                Excluir Registro
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {studentFees.length === 0 && (
                            <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FileText className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-slate-900 font-bold">Nenhum registro encontrado</h3>
                                <p className="text-slate-400 text-sm mt-1">Este aluno ainda não possui cobranças geradas para o ciclo atual.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} className="px-8 py-2.5 rounded-xl font-bold">
                        Fechar Painel
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default StudentFinancialModal;
