import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { Mensalidade, Student } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { SCHOOL_LOGO_URL } from '../constants';

export const ValidateReceipt: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [receipt, setReceipt] = useState<Mensalidade | null>(null);
    const [student, setStudent] = useState<Student | null>(null);

    useEffect(() => {
        const fetchReceipt = async () => {
            if (!id) {
                setError('Código de recibo inválido.');
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch Mensalidade (Receipt)
                // Try fetching by doc ID first (most likely scenario for QR)
                let doc = await db.collection('mensalidades').doc(id).get();

                if (!doc.exists) {
                    // Fallback: Try searching by a custom field if we used a custom receipt ID in the future
                    // For now, we assume ID is the Firestore Doc ID
                    setError('Recibo não encontrado. Verifique o código e tente novamente.');
                    setLoading(false);
                    return;
                }

                const receiptData = { id: doc.id, ...doc.data() } as Mensalidade;
                setReceipt(receiptData);

                // 2. Fetch Student Data for context
                if (receiptData.studentId) {
                    const studentDoc = await db.collection('students').doc(receiptData.studentId).get();
                    if (studentDoc.exists) {
                        setStudent({ id: studentDoc.id, ...studentDoc.data() } as Student);
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error("Erro ao validar recibo:", err);
                setError('Erro ao processar validação. Tente novamente mais tarde.');
                setLoading(false);
            }
        };

        fetchReceipt();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
            </div>
        );
    }

    if (error || !receipt) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Validação Falhou</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <a href="/" className="text-blue-600 hover:text-blue-800 font-medium">Voltar ao Início</a>
                </div>
            </div>
        );
    }

    const isValid = receipt.status === 'Pago';

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col relative overflow-hidden font-sans">

            {/* App Download Banner */}
            <div className="bg-blue-900 text-white p-3 shadow-md z-20 relative">
                <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-1.5 rounded-lg">
                            <SchoolLogo variant="white" className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">Experiência Completa</p>
                            <p className="text-sm font-bold leading-tight">Baixe o App Meu Expansivo</p>
                        </div>
                    </div>
                    <button className="bg-white text-blue-900 text-xs font-bold px-4 py-2 rounded-full shadow hover:bg-gray-100 transition whitespace-nowrap">
                        BAIXAR AGORA
                    </button>
                </div>
            </div>

            {/* Validation Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 my-4">

                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative border border-gray-200">

                    {/* Header with Visual Status */}
                    <div className={`p-6 text-center text-white ${isValid ? 'bg-green-600' : 'bg-orange-500'}`}>
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                            {isValid ? (
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            ) : (
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            )}
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-wide">
                            {isValid ? 'Recibo Autêntico' : 'Status: ' + receipt.status}
                        </h1>
                        <p className="opacity-90 text-sm mt-1 font-medium">
                            {isValid ? 'Pagamento confirmado e verificado.' : 'Este pagamento ainda não foi confirmado.'}
                        </p>
                    </div>

                    {/* Receipt Data */}
                    <div className="p-8 space-y-6 relative">
                        {/* Authentic Watermark */}
                        {isValid && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                                <img src={SCHOOL_LOGO_URL} className="w-48 grayscale" alt="" />
                            </div>
                        )}

                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Referência</span>
                                <span className="text-gray-800 font-bold text-lg">{receipt.month}</span>
                            </div>

                            <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Aluno(a)</span>
                                <div className="text-right">
                                    <span className="text-gray-900 font-bold block">{student?.name}</span>
                                    <span className="text-gray-500 text-xs block">Matrícula: {student?.code}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Valor Pago</span>
                                <span className="text-green-700 font-black text-2xl">R$ {receipt.value.toFixed(2).replace('.', ',')}</span>
                            </div>

                            <div className="flex justify-between items-end pb-2">
                                <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Data do Pagamento</span>
                                <span className="text-gray-800 font-medium">
                                    {receipt.paymentDate ? new Date(receipt.paymentDate).toLocaleString('pt-BR') : '-'}
                                </span>
                            </div>
                        </div>

                        {/* ID Verification */}
                        <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 mt-6">
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">ID da Transação</p>
                            <p className="font-mono text-xs text-gray-500 break-all">{receipt.id}</p>
                        </div>
                    </div>

                    {/* Authenticity Seal Footer */}
                    <div className="bg-gray-50 border-t border-gray-100 p-4 flex items-center justify-center gap-2 text-gray-400 text-xs uppercase font-bold tracking-widest">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                        Verificado por Expansivo
                    </div>
                </div>

                <p className="text-gray-400 text-xs mt-8 text-center max-w-xs">
                    Este documento foi emitido digitalmente e sua autenticidade foi confirmada através do nosso banco de dados seguro.
                </p>

            </div>
        </div>
    );
};
