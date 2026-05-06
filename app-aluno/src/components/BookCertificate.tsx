import React, { useRef } from 'react';
import { X, Printer, Download, Award, Calendar, BookOpen, User, CheckCircle2 } from 'lucide-react';
import { SCHOOL_LOGO_URL } from '../constants';

interface BookCertificateProps {
    studentName: string;
    gradeLevel: string;
    schoolClass: string;
    shift: string;
    unit: string;
    bookTitle: string;
    completionDate: Date;
    onClose: () => void;
}

const BookCertificate: React.FC<BookCertificateProps> = ({ 
    studentName, 
    gradeLevel, 
    schoolClass, 
    shift, 
    unit, 
    bookTitle, 
    completionDate, 
    onClose 
}) => {
    const certificateRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = certificateRef.current;
        if (!printContent) return;

        const windowUrl = 'about:blank';
        const uniqueName = new Date();
        const windowName = 'Print' + uniqueName.getTime();
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        printWindow?.document.write(`
            <html>
                <head>
                    <title>Certificado de Leitura - ${studentName}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            @page { size: 21cm 15cm; margin: 0; }
                            body { margin: 0; -webkit-print-color-adjust: exact; }
                            .no-print { display: none; }
                        }
                        .certificate-container {
                            width: 21cm;
                            height: 15cm;
                            margin: 0 auto;
                        }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);

        printWindow?.document.close();
        printWindow?.focus();
        setTimeout(() => {
            printWindow?.print();
            printWindow?.close();
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] animate-zoom-in relative">
                
                {/* Header Controls */}
                <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
                    <button 
                        onClick={handlePrint}
                        className="p-3 bg-blue-900 text-white rounded-full shadow-lg hover:bg-black transition-all transform hover:scale-110 active:scale-95 flex items-center gap-2 px-5 font-bold text-sm"
                    >
                        <Printer size={18} /> Imprimir Certificado
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-3 bg-white/90 text-gray-400 hover:text-red-500 rounded-full shadow-lg transition-all transform hover:rotate-90"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Certificate Content (Printable Area) */}
                <div 
                    ref={certificateRef}
                    className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-4 sm:p-0"
                >
                    <div className="certificate-container relative border-[12px] border-double border-blue-900/20 p-6 sm:p-10 flex flex-col items-center justify-center text-center bg-white shadow-inner overflow-hidden shrink-0">
                        
                        {/* Background Decorations */}
                        <div className="absolute top-0 left-0 w-24 h-24 bg-blue-900/5 rounded-br-full -translate-x-6 -translate-y-6" />
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-blue-900/5 rounded-tl-full translate-x-6 translate-y-6" />
                        
                        {/* School Logo */}
                        <div className="mb-6">
                            <img src={SCHOOL_LOGO_URL} alt="Logo Escola" className="h-16 w-auto mx-auto mb-2 object-contain" />
                            <h2 className="text-blue-900 font-black tracking-[0.2em] uppercase text-xs text-center">Expansivo Rede de Ensino</h2>
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl sm:text-4xl font-serif text-slate-800 mb-4 italic">Certificado de Leitura</h1>
                        
                        <p className="text-slate-500 font-medium text-sm mb-6 max-w-lg leading-relaxed">
                            Certificamos com imensa alegria e orgulho que o(a) aluno(a)
                        </p>

                        {/* Student Name */}
                        <div className="relative mb-6 w-full">
                            <h3 className="text-3xl sm:text-4xl font-black text-blue-950 truncate px-4">
                                {studentName}
                            </h3>
                            <div className="h-0.5 w-48 bg-gradient-to-r from-transparent via-blue-900/30 to-transparent absolute -bottom-2 left-1/2 -translate-x-1/2" />
                        </div>

                        <p className="text-slate-500 font-medium text-[10px] mb-8 max-w-lg leading-relaxed uppercase tracking-wider">
                            {gradeLevel.split(' - ')[0]} • Unidade {unit}
                        </p>

                        <p className="text-slate-500 font-medium text-sm mb-6 max-w-lg leading-relaxed">
                            concluiu com sucesso a leitura e as atividades do e-livro digital:
                        </p>

                        {/* Book Title */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 px-8 mb-8 shadow-sm flex items-center gap-3">
                            <BookOpen size={24} className="text-blue-900" />
                            <span className="text-xl font-bold text-slate-800 italic">
                                "{bookTitle}"
                            </span>
                        </div>

                        {/* Footer Info */}
                        <div className="grid grid-cols-3 gap-6 w-full max-w-3xl mt-4 pt-6 border-t border-slate-100">
                            <div className="flex flex-col items-center">
                                <Calendar size={18} className="text-blue-900 mb-1" />
                                <span className="text-[8px] uppercase font-black text-slate-400 tracking-widest mb-0.5">Data</span>
                                <span className="text-slate-700 font-bold text-xs">{completionDate.toLocaleDateString('pt-BR')}</span>
                            </div>

                            <div className="flex flex-col items-center justify-center -mt-4">
                                <div className="relative w-14 h-14 flex items-center justify-center">
                                    {/* Professional Seal Design */}
                                    <div className="absolute inset-0 bg-[#D4AF37] rounded-full rotate-45 shadow-md opacity-20 scale-110" />
                                    <div className="absolute inset-0 bg-[#D4AF37] rounded-full -rotate-45 shadow-md opacity-20 scale-110" />
                                    
                                    <div className="absolute inset-0 bg-blue-950 rounded-full shadow-lg flex items-center justify-center border-2 border-[#D4AF37]">
                                        <div className="absolute inset-0.5 border border-white/20 rounded-full" />
                                        <Award size={20} className="text-[#D4AF37] drop-shadow-sm" />
                                    </div>
                                    
                                    {/* Ribbons */}
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5 z-0">
                                        <div className="w-3 h-5 bg-blue-900/30 rounded-b-sm -rotate-12" />
                                        <div className="w-3 h-5 bg-blue-900/30 rounded-b-sm rotate-12" />
                                    </div>
                                </div>
                                <span className="text-[7px] uppercase font-black text-blue-900 tracking-[0.3em] mt-4 text-center leading-none">Mérito de Leitura</span>
                            </div>

                            <div className="flex flex-col items-center">
                                <User size={18} className="text-blue-900 mb-1" />
                                <span className="text-[8px] uppercase font-black text-slate-400 tracking-widest mb-0.5">Plataforma</span>
                                <span className="text-slate-700 font-bold text-xs">Meu Expansivo</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Mobile Hint */}
                <div className="p-4 bg-blue-50 text-center sm:hidden">
                    <p className="text-[10px] text-blue-900 font-bold uppercase tracking-wider">
                        Recomendamos imprimir em modo paisagem para melhor resultado.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default BookCertificate;
