import React from 'react';
import { db } from '../../firebaseConfig';
import { calculateFinancials } from '../../utils/financialUtils';
import { Mensalidade } from '../../types';

interface ManualPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedManualFee: Mensalidade | null;
    manualPaymentMethod: string;
    setManualPaymentMethod: (method: string) => void;
    onSuccess?: () => void;
}

const ManualPaymentModal: React.FC<ManualPaymentModalProps> = ({
    isOpen,
    onClose,
    selectedManualFee,
    manualPaymentMethod,
    setManualPaymentMethod,
    onSuccess
}) => {
    if (!isOpen || !selectedManualFee) return null;

    const handleConfirmManualPayment = async () => {
        if (!selectedManualFee) return;
        try {
            const fin = calculateFinancials(selectedManualFee);
            await db.collection('mensalidades').doc(selectedManualFee.id).update({
                status: 'Pago',
                paymentDate: new Date().toISOString(),
                paymentMethod: manualPaymentMethod,
                value: fin.total,
                lastUpdated: new Date().toISOString()
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Erro ao processar pagamento.");
        }
    };

    const fin = calculateFinancials(selectedManualFee);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-slate-200">
                <div className="bg-white p-6 border-b border-zinc-100 relative overflow-hidden">
                    <div className="relative z-10 text-center">
                        <div className="w-14 h-14 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">💰</span>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 mb-1 leading-tight">Confirmar Recebimento</h3>
                        <p className="text-zinc-500 text-xs font-medium">Selecione a forma de pagamento abaixo</p>
                    </div>
                </div>

                <div className="p-8">
                    <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100 text-center shadow-inner relative group">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Valor Total a Receber</p>
                        <div className="flex flex-col items-center">
                            <span className="text-4xl font-black text-emerald-700 tracking-tighter">
                                R$ {fin.total.toFixed(2).replace('.', ',')}
                            </span>
                            {fin.total > fin.originalValue && (
                                <div className="flex items-center gap-2 mt-1.5 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                                    <span className="text-[10px] text-slate-400 line-through">R$ {fin.originalValue.toFixed(2)}</span>
                                    <span className="text-[10px] font-bold text-red-500">Com Juros/Multa</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200/50 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Vencimento Original</span>
                            <span className="text-slate-600">{new Date(selectedManualFee.dueDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        {[
                            { id: 'Pix', icon: '💠', label: 'Pix' },
                            { id: 'Dinheiro', icon: '💵', label: 'Dinheiro' },
                            { id: 'Cartão', icon: '💳', label: 'Cartão' }
                        ].map((method) => (
                            <button
                                key={method.id}
                                onClick={() => setManualPaymentMethod(method.id)}
                                className={`group p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all duration-300 ${manualPaymentMethod === method.id
                                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-lg shadow-emerald-100/50'
                                    : 'border-slate-100 hover:border-emerald-200 text-slate-400 hover:text-emerald-500 bg-white hover:bg-emerald-50/30'}`}
                            >
                                <span className={`text-3xl filter transition-all duration-300 ${manualPaymentMethod === method.id ? 'scale-110 drop-shadow-sm' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                                    {method.icon}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest">{method.label}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleConfirmManualPayment}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider py-4 rounded-2xl shadow-xl shadow-emerald-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                    >
                        <span className="group-hover:scale-125 transition-transform">✅</span>
                        Finalizar Recebimento
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full mt-4 text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors"
                    >
                        Cancelar e Voltar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualPaymentModal;
