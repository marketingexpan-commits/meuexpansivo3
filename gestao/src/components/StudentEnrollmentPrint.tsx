import type { Student } from '../types';
import { UNIT_DETAILS } from '../utils/receiptGenerator';

interface StudentEnrollmentPrintProps {
    student: Partial<Student>;
    isBlank?: boolean;
}

export function StudentEnrollmentPrint({ student, isBlank = false }: StudentEnrollmentPrintProps) {
    const today = new Date().toLocaleDateString('pt-BR');
    const unitInfo = UNIT_DETAILS[student.unit as string] || UNIT_DETAILS['Zona Norte'];
    const logoUrl = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
    const watermarkUrl = 'https://i.postimg.cc/hjLxrMdc/brasao-da-republica-do-brasil-seeklogo.png';

    // Helper to render value or a wider blank area for manual filling
    const val = (value: any, length: 'sm' | 'md' | 'lg' | 'full' | 'flex' = 'md', textColor: string = 'text-black') => {
        if (isBlank) {
            const widths = {
                'sm': '60px',
                'md': '120px',
                'lg': '200px',
                'full': '100%',
                'flex': '100%'
            };

            return (
                <span
                    className={`inline-block border-b-[0.5px] border-current pb-0.5 ${length === 'flex' ? 'flex-grow mx-1' : ''}`}
                    style={{ width: length === 'flex' ? 'auto' : widths[length], minHeight: '1em' }}
                />
            );
        }
        return <span className={`${textColor} font-bold`}>{value || '__________'}</span>;
    };

    return (
        <div className="print-document bg-white p-6 text-black font-sans leading-relaxed relative flex flex-col justify-between" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>

            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                <img src={watermarkUrl} alt="Brasão" className="w-[450px] grayscale" />
            </div>

            <div className="relative z-10 flex-grow basis-0">
                {/* Header Standardized */}
                <div className="flex justify-between items-center border-b-[0.5px] border-black pb-2 mb-3">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 flex items-center justify-center">
                            <img src={logoUrl} alt="Logo Expansivo" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase text-black leading-tight">Expansivo Rede de Ensino</h1>
                            <p className="text-[9px] font-bold text-black/70 uppercase tracking-wider">Unidade {student.unit || 'Zona Norte'}</p>
                            <p className="text-[8px] text-gray-700 leading-tight max-w-xs">{unitInfo.address}</p>
                            <p className="text-[8px] text-gray-700 font-semibold italic">CNPJ: {unitInfo.cnpj} | Tel: {unitInfo.phone}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="bg-black text-white px-3 py-1 text-[9px] font-bold uppercase rounded mb-1 inline-block">
                            {isBlank ? 'Ficha de Matrícula (Cópia Manual)' : 'Ficha de Matrícula'}
                        </div>
                        <div className="text-sm font-bold text-black">Ano Letivo: 2026</div>
                        <div className="text-[9px] text-gray-600 font-medium">{isBlank ? 'Espaço reservado para escrita à mão' : `Emitido em: ${today}`}</div>
                    </div>
                </div>

                {/* I. Identificação do Aluno */}
                <section className="mb-3">
                    <h3 className="text-[9px] font-black uppercase text-black border-l-[3px] border-black pl-2 mb-1 tracking-widest bg-gray-50 py-1">I. Identificação do Aluno</h3>
                    <div className="grid grid-cols-6 gap-x-4 gap-y-2 text-[9px] p-3 border-[0.5px] border-black rounded-lg">
                        <div className="col-span-4 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Nome Completo do Aluno</span>
                            <div className="uppercase flex items-baseline">{val(student.name, 'full')}</div>
                        </div>
                        <div className="col-span-2 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Código SGA / Matrícula</span>
                            <div className="flex items-baseline">{val(student.code, 'full')}</div>
                        </div>

                        <div className="col-span-1.5 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Data Nasc.</span>
                            <div className="flex items-baseline">{val(student.data_nascimento, 'full')}</div>
                        </div>
                        <div className="col-span-1 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Sexo</span>
                            <div className="capitalize flex items-baseline">{val(student.sexo, 'full')}</div>
                        </div>
                        <div className="col-span-1.5 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">RG do Aluno</span>
                            <div className="flex items-baseline">{val(student.identidade_rg, 'full')}</div>
                        </div>
                        <div className="col-span-2 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">CPF do Aluno</span>
                            <div className="flex items-baseline">{val(student.cpf_aluno, 'full')}</div>
                        </div>

                        <div className="col-span-2 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Nacionalidade</span>
                            <div className="uppercase flex items-baseline">{val(student.nacionalidade, 'full')}</div>
                        </div>
                        <div className="col-span-3 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Naturalidade (Cidade/UF)</span>
                            <div className="uppercase flex items-baseline">{val(`${student.naturalidade || ''}${student.uf_naturalidade ? ` - ${student.uf_naturalidade}` : ''}`, 'full')}</div>
                        </div>
                        <div className="col-span-1 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Turno</span>
                            <div className="uppercase flex items-baseline">{val(student.shift, 'full')}</div>
                        </div>

                        <div className="col-span-2 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Série / Ano</span>
                            <div className="text-blue-900 uppercase font-bold flex items-baseline">{val(student.gradeLevel, 'full')}</div>
                        </div>
                        <div className="col-span-1 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Turma</span>
                            <div className="uppercase flex items-baseline">{val(student.schoolClass, 'full')}</div>
                        </div>
                        <div className="col-span-3 flex flex-col">
                            <span className="text-gray-500 uppercase font-black text-[7px] block leading-none mb-1">Unidade de Ensino</span>
                            <div className="uppercase flex items-baseline">{val(student.unit, 'full')}</div>
                        </div>
                    </div>
                </section>

                {/* II. Filiação e Responsáveis */}
                <section className="mb-3">
                    <h3 className="text-[9px] font-black uppercase text-black border-l-[3px] border-black pl-2 mb-1 tracking-widest bg-gray-50 py-1">II. Filiação e Responsáveis</h3>
                    <div className="grid grid-cols-2 gap-3 text-[9px]">
                        <div className="p-3 border-[0.5px] border-black rounded-lg space-y-2">
                            <span className="text-gray-500 uppercase font-black text-[7px] block border-b-[0.5px] border-black/10 pb-0.5 mb-1">Mãe / Progenitora</span>
                            <div className="flex gap-1 items-baseline"><strong>Nome:</strong> {val(student.nome_mae, 'flex')}</div>
                            <div className="flex gap-1 items-baseline"><strong>Telefone:</strong> {val(student.mae_telefone, 'flex')}</div>
                            <div className="flex gap-1 items-baseline"><strong>Profissão:</strong> {val(student.mae_profissao, 'flex')}</div>
                        </div>
                        <div className="p-3 border-[0.5px] border-black rounded-lg space-y-2">
                            <span className="text-gray-500 uppercase font-black text-[7px] block border-b-[0.5px] border-black/10 pb-0.5 mb-1">Pai / Progenitor</span>
                            <div className="flex gap-1 items-baseline"><strong>Nome:</strong> {val(student.nome_pai, 'flex')}</div>
                            <div className="flex gap-1 items-baseline"><strong>Telefone:</strong> {val(student.pai_telefone, 'flex')}</div>
                            <div className="flex gap-1 items-baseline"><strong>Profissão:</strong> {val(student.pai_profissao, 'flex')}</div>
                        </div>

                        <div className={`col-span-2 p-3 ${isBlank ? 'bg-white border-[0.5px] border-black' : 'bg-black text-white'} rounded-lg`}>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex-grow">
                                    <span className={`${isBlank ? 'text-gray-500' : 'text-gray-400'} uppercase font-black text-[6px] block`}>Responsável Financeiro (Quem assina o contrato)</span>
                                    <div className={`text-[11px] font-black uppercase tracking-tight flex items-baseline ${isBlank ? 'text-gray-300' : ''}`}>
                                        {val(student.nome_responsavel, 'full', isBlank ? 'text-black' : 'text-white')}
                                    </div>
                                </div>
                                <div className="text-right ml-8">
                                    <span className={`${isBlank ? 'text-gray-500' : 'text-gray-400'} uppercase font-black text-[6px] block`}>Telefone de Contato</span>
                                    <div className={`text-[11px] font-bold flex items-baseline justify-end ${isBlank ? 'text-gray-300' : ''}`}>
                                        {val(student.telefone_responsavel, 'md', isBlank ? 'text-black' : 'text-white')}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8 border-t-[0.5px] border-white/20 pt-2">
                                <div>
                                    <span className={`${isBlank ? 'text-gray-500' : 'text-gray-400'} uppercase font-black text-[6px] block`}>CPF do Responsável</span>
                                    <div className={`text-[9px] font-bold flex items-baseline ${isBlank ? 'text-gray-300' : ''}`}>
                                        {val(student.cpf_responsavel, 'full', isBlank ? 'text-black' : 'text-white')}
                                    </div>
                                </div>
                                <div>
                                    <span className={`${isBlank ? 'text-gray-500' : 'text-gray-400'} uppercase font-black text-[6px] block`}>RG do Responsável</span>
                                    <div className={`text-[9px] font-bold flex items-baseline ${isBlank ? 'text-gray-300' : ''}`}>
                                        {val(student.rg_responsavel, 'full', isBlank ? 'text-black' : 'text-white')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* III. Endereço e Localização */}
                <section className="mb-4">
                    <h3 className="text-[9px] font-black uppercase text-black border-l-[3px] border-black pl-2 mb-1 tracking-widest bg-gray-50 py-1">III. Endereço e Localização</h3>
                    <div className="text-[9px] space-y-3 p-3 border-[0.5px] border-black rounded-lg">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3 flex items-baseline"><strong>Logradouro:</strong> {val(student.endereco_logradouro, 'flex')}</div>
                            <div className="flex items-baseline whitespace-nowrap"><strong>Nº:</strong> {val(student.endereco_numero, 'sm')}</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-2 flex items-baseline"><strong>Bairro:</strong> {val(student.endereco_bairro, 'flex')}</div>
                            <div className="flex items-baseline"><strong>Cidade:</strong> {val(student.endereco_cidade, 'flex')}</div>
                            <div className="flex items-baseline whitespace-nowrap"><strong>UF:</strong> {val(student.endereco_uf, 'sm')}</div>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <div className="flex items-baseline whitespace-nowrap"><strong>CEP:</strong> {val(student.cep, 'md')}</div>
                            <div className="flex-grow flex items-baseline"><strong>Complemento:</strong> {val(student.endereco_complemento, 'flex')}</div>
                        </div>
                    </div>
                </section>

                {/* IV. Saúde e Emergência */}
                <section className="mb-4">
                    <h3 className="text-[9px] font-black uppercase text-black border-l-[3px] border-black pl-2 mb-1 tracking-widest bg-gray-50 py-1">IV. Informações de Saúde Importantes</h3>
                    <div className="grid grid-cols-2 gap-4 text-[8px]">
                        <div className="space-y-2 p-1">
                            <div className="flex gap-1 items-baseline"><strong>Alergias:</strong> {val(student.ficha_saude?.alergias, 'flex')}</div>
                            <div className="flex gap-1 items-baseline"><strong>Doenças Crônicas:</strong> {val(student.ficha_saude?.doencas_cronicas?.join(', '), 'flex')}</div>
                            <div className="flex gap-1 items-baseline"><strong>Deficiências / Restrições:</strong> {val(student.ficha_saude?.deficiencias?.join(', '), 'flex')}</div>
                        </div>
                        <div className="p-3 bg-red-50 text-red-950 rounded-lg border-[0.5px] border-red-200 flex flex-col justify-center gap-2">
                            <span className="uppercase font-black text-[7px] block border-b-[0.5px] border-red-300 pb-0.5 mb-1">🚨 EM CASO DE EMERGÊNCIA</span>
                            <div className="flex gap-2 items-baseline">
                                <span className="min-w-[45px] font-bold">Contato:</span>
                                <div className="flex-grow items-baseline flex font-bold uppercase">{val(student.ficha_saude?.contato_emergencia_nome, 'flex')}</div>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <span className="min-w-[45px] font-bold">Telefone:</span>
                                <div className="flex-grow items-baseline flex font-black text-sm">{val(student.ficha_saude?.contato_emergencia_fone, 'flex')}</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* V. Checklist de Documentos */}
                <section className="mb-4">
                    <h3 className="text-[9px] font-black uppercase text-black border-l-[3px] border-black pl-2 mb-1 tracking-widest bg-gray-50 py-1">V. Documentação (Controle Secretaria)</h3>
                    <div className="grid grid-cols-4 gap-2 text-[7px] border-[0.5px] border-black p-3 rounded-lg italic text-gray-500">
                        {[
                            'Certidão Nasc.', 'RG do Aluno', 'CPF do Aluno', 'RG Responsável',
                            'CPF Responsável', 'Residência', 'Foto 3x4', 'Histórico Esc.',
                            'Declaração Transf.', 'Cartão Vacina', 'Plano Saúde', 'Contrato Serviço'
                        ].map(doc => (
                            <div key={doc} className="flex items-center gap-2">
                                <div className="w-4 h-4 border-[0.5px] border-black rounded-sm flex items-center justify-center font-bold text-black text-[10px] bg-white">
                                    {!isBlank && (student.documentos_entregues?.includes(doc) || student.documentos_entregues?.some((d: string) => d.startsWith(doc))) ? '✓' : ''}
                                </div>
                                <span className="truncate">{doc}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Bottom Content (Signatures and Footer) */}
            <div className="relative z-10 pt-4">
                {/* Signatures */}
                <div className="grid grid-cols-2 gap-16 mb-8">
                    <div className="text-center">
                        <div className="border-t-[0.5px] border-black pt-1 text-[9px] font-black uppercase">Responsável Legal</div>
                        <div className="text-[7px] text-gray-600 font-bold italic">Assinatura por Extenso</div>
                    </div>
                    <div className="text-center">
                        <div className="border-t-[0.5px] border-black pt-1 text-[9px] font-black uppercase">Secretaria Escolar</div>
                        <div className="text-[7px] text-gray-600 font-bold italic">Unidade {student.unit || 'Zona Norte'}</div>
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="text-center border-t-[0.5px] border-gray-200 pt-2 pb-2">
                    <p className="text-[6px] text-gray-500 leading-tight uppercase font-bold tracking-tighter">
                        O Colégio Expansivo declara que as informações acima são de caráter confidencial.
                        A assinatura do responsável confirma a adesão às normas escolares do ano letivo de 2026.
                        Emitido pelo Sistema SGA - {new Date().getFullYear()}
                    </p>
                </div>
            </div>

            {/* Global Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
                
                @media print {
                    body { background: white !important; margin: 0 !important; padding: 0 !important; }
                    .print-document { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%;
                        height: 297mm;
                        padding: 10mm 12mm !important;
                        margin: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    .bg-black { background-color: #000000 !important; color: white !important; }
                    .bg-gray-50 { background-color: #f9fafb !important; }
                    .bg-red-50 { background-color: #fef2f2 !important; }
                    .text-blue-900 { color: #1e3a8a !important; }
                    .border-black { border-color: #000000 !important; }
                    .border-gray-200 { border-color: #e5e7eb !important; }
                }
            `}} />
        </div>
    );
}
