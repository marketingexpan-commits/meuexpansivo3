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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="bg-green-600 p-6 text-white text-center">
                    <h3 className="text-xl font-black mb-1">Confirmar Recebimento</h3>
                    <p className="text-green-100 text-sm">Selecione a forma de pagamento</p>
                </div>
                <div className="p-6">
                    <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100 text-center">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Valor a Receber</p>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-green-700">
                                R$ {fin.total.toFixed(2).replace('.', ',')}
                            </span>
                            {fin.total > fin.originalValue && (
                                <span className="text-xs text-gray-400 mt-1">
                                    (Valor Original: R$ {fin.originalValue.toFixed(2)})
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-2 italic">Referência: {selectedManualFee.month}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <button
                            onClick={() => setManualPaymentMethod('Pix')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${manualPaymentMethod === 'Pix' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-200 text-gray-500'}`}
                        >
                            <span className="text-2xl">💠</span>
                            <span className="text-xs font-bold">Pix</span>
                        </button>
                        <button
                            onClick={() => setManualPaymentMethod('Dinheiro')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${manualPaymentMethod === 'Dinheiro' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-200 text-gray-500'}`}
                        >
                            <span className="text-2xl">💵</span>
                            <span className="text-xs font-bold">Dinheiro</span>
                        </button>
                        <button
                            onClick={() => setManualPaymentMethod('Cartão')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${manualPaymentMethod === 'Cartão' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-200 text-gray-500'}`}
                        >
                            <span className="text-2xl">💳</span>
                            <span className="text-xs font-bold">Cartão</span>
                        </button>
                    </div>

                    <button
                        onClick={handleConfirmManualPayment}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <span>✅</span> Confirmar Recebimento Manual
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full mt-3 text-gray-400 hover:text-gray-600 font-bold text-sm py-2"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualPaymentModal;
