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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                {/* HEADER */}
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 text-white border-b border-blue-900">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                                <FileText className="w-8 h-8 text-blue-200" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    Gestão Financeira: {student.name}
                                </h2>
                                <p className="text-blue-200/80 text-sm mt-1">
                                    {student.gradeLevel} - {student.schoolClass} • {student.unit}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {studentFees.sort((a, b) => {
                            if (a.dueDate && b.dueDate) {
                                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                            }
                            // Fallback logic if dueDate is missing (unlikely)
                            const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                            const aMonth = a.month.split('/')[0];
                            const bMonth = b.month.split('/')[0];
                            return months.indexOf(aMonth) - months.indexOf(bMonth);
                        }).map((fee) => {
                            const fin = calculateFinancials(fee);
                            return (
                                <div key={fee.id} className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${fee.status === 'Pago' ? 'border-green-100 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="font-black text-lg text-gray-800">{fee.month}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${fee.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {fee.status}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xl font-black text-blue-900">R$ {fin.total.toFixed(2).replace('.', ',')}</p>
                                        {fin.total > fin.originalValue && (
                                            <p className="text-[10px] text-gray-400 line-through">R$ {fin.originalValue.toFixed(2)}</p>
                                        )}
                                        <p className="text-xs text-gray-500">Venc: {new Date(fee.dueDate).toLocaleDateString('pt-BR')}</p>
                                        {fee.paymentDate && <p className="text-xs text-green-700 font-bold">Pago: {new Date(fee.paymentDate).toLocaleDateString('pt-BR')}</p>}
                                    </div>

                                    <div className="pt-3 mt-3 border-t border-gray-100 grid grid-cols-1 gap-2">
                                        {fee.status === 'Pago' ? (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm("Admin: Desfazer pagamento?")) return;
                                                    try {
                                                        await db.collection('mensalidades').doc(fee.id).update({
                                                            status: 'Pendente',
                                                            paymentDate: null,
                                                            receiptUrl: null,
                                                            lastUpdated: new Date().toISOString()
                                                        });
                                                    } catch (e) { alert("Erro ao processar."); }
                                                }}
                                                className="py-1 text-xs font-bold text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                                            >
                                                Desfazer
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    onSetSelectedManualFee(fee);
                                                    onSetManualPaymentMethod('Pix');
                                                    onSetIsManualPaymentModalOpen(true);
                                                }}
                                                className="py-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded shadow-sm transition-colors"
                                            >
                                                Receber Manual (Opções)
                                            </button>
                                        )}
                                        {isGeneralAdmin && (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm("Admin: Tem certeza que deseja EXCLUIR permanentemente esta cobrança?")) return;
                                                    try {
                                                        await db.collection('mensalidades').doc(fee.id).delete();
                                                        if (onDeleteFee) onDeleteFee(fee.id);
                                                    } catch (e) { alert("Erro ao excluir."); console.error(e); }
                                                }}
                                                className="py-1 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                            >
                                                🗑️ Excluir
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {studentFees.length === 0 && (
                            <div className="col-span-full text-center py-10 text-gray-400">
                                Nenhum registro financeiro para este ano.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-gray-100 text-right">
                    <Button variant="secondary" onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </div>
    );
};

export default StudentFinancialModal;
