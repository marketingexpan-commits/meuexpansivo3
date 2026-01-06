
import { UNIT_DETAILS } from '../constants';
import type { Student } from '../types';


export type DeclarationType = 'MATRICULA_FREQUENCIA' | 'BOLSA_FAMILIA' | 'TRANSFERENCIA' | 'CONCLUSAO' | 'QUITACAO';

interface DeclarationData {
    student: Student;
    frequency?: number;
    hasDebts?: boolean;
    year?: number;
}

export function generateSchoolDeclaration(type: DeclarationType, data: DeclarationData) {
    const { student, frequency, hasDebts } = data;
    const unitInfo = UNIT_DETAILS[student.unit || 'Zona Norte'] || UNIT_DETAILS['Zona Norte'];
    const logoUrl = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
    const today = new Date();
    const formattedDate = today.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const city = student.unit === 'Extremoz' ? 'Extremoz' : 'Natal';
    const currentYear = data.year || new Date().getFullYear();

    let title = '';
    let content = '';

    switch (type) {
        case 'MATRICULA_FREQUENCIA':
            title = 'DECLARAÇÃO DE MATRÍCULA E FREQUÊNCIA';
            content = `
                Declaramos, para os devidos fins, que o(a) aluno(a) <strong>${student.name.toUpperCase()}</strong>, 
                inscrito(a) sob a matrícula nº <strong>${student.code || 'N/A'}</strong> e portador(a) do 
                CPF <strong>${student.cpf_aluno || 'Não informado'}</strong>, encontra-se devidamente matriculado(a) 
                e frequentando regularmente as aulas nesta instituição de ensino, no ano letivo de <strong>${currentYear}</strong>, 
                cursando o(a) <strong>${student.gradeLevel || 'Não informado'}</strong>, na Turma <strong>${student.schoolClass || '-'}</strong>, 
                turno <strong>${student.shift || '-'}</strong>.
            `;
            break;
        case 'BOLSA_FAMILIA':
            title = 'DECLARAÇÃO PARA FINS DE BOLSA FAMÍLIA';
            const freqValue = frequency !== undefined ? frequency.toFixed(1) : '---';
            content = `
                Declaramos, para fins de comprovação junto ao Programa Bolsa Família, que o(a) aluno(a) 
                <strong>${student.name.toUpperCase()}</strong>, matrícula nº <strong>${student.code || 'N/A'}</strong>, 
                NIS <strong>${student.nis || '---'}</strong>, está matriculado(a) no 
                <strong>${student.gradeLevel}</strong> desta instituição.
                <br><br>
                Informamos que, no presente período, o referido aluno apresenta uma 
                <strong>frequência escolar de ${freqValue}%</strong>, cumprindo com os requisitos mínimos 
                exigidos pelo programa.
            `;
            break;
        case 'TRANSFERENCIA':
            title = 'DECLARAÇÃO PROVISÓRIA DE TRANSFERÊNCIA';
            content = `
                Declaramos que o(a) aluno(a) <strong>${student.name.toUpperCase()}</strong>, 
                matrícula nº <strong>${student.code || 'N/A'}</strong>, cursou nesta instituição o 
                <strong>${student.gradeLevel}</strong> no ano letivo de <strong>${currentYear}</strong>.
                <br><br>
                Atestamos que o referido aluno encontra-se apto para prosseguimento de seus estudos em outra 
                instituição de ensino, estando a documentação definitiva (Histórico Escolar) em fase de 
                processamento, com prazo de entrega de até 30 dias.
            `;
            break;
        case 'CONCLUSAO':
            title = 'DECLARAÇÃO DE CONCLUSÃO DE CURSO';
            content = `
                Declaramos que o(a) aluno(a) <strong>${student.name.toUpperCase()}</strong>, 
                portador(a) do CPF <strong>${student.cpf_aluno || '---'}</strong> e RG <strong>${student.identidade_rg || '---'}</strong>, 
                <strong>CONCLUIU</strong> com aproveitamento o 
                <strong>${student.gradeLevel?.includes('Médio') ? 'Ensino Médio' : 'Ensino Fundamental'}</strong> 
                nesta instituição de ensino no ano letivo de <strong>${currentYear - 1}</strong>.
                <br><br>
                A presente declaração é válida para fins de matrícula em cursos técnicos ou superiores, 
                enquanto o Diploma/Certificado oficial encontra-se em fase de registro nos órgãos competentes.
            `;
            break;
        case 'QUITACAO':
            title = 'DECLARAÇÃO DE QUITAÇÃO DE DÉBITOS';
            if (hasDebts) {
                content = `
                    <div style="color: #ef4444; border: 2px solid #ef4444; padding: 20px; text-align: center; font-weight: bold;">
                        ATENÇÃO: ESTA DECLARAÇÃO NÃO PODE SER EMITIDA DEVIDO A PENDÊNCIAS FINANCEIRAS.
                    </div>
                `;
            } else {
                content = `
                    Declaramos para os devidos fins que o(a) aluno(a) <strong>${student.name.toUpperCase()}</strong>, 
                    responsável financeiro <strong>${student.nome_responsavel || student.name}</strong>, 
                    encontra-se em dia com suas obrigações financeiras relativas às mensalidades escolares 
                    até a presente data, ano letivo de <strong>${currentYear}</strong>.
                    <br><br>
                    Nada mais havendo a declarar, firmamos o presente documento.
                `;
            }
            break;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
        <html>
        <head>
            <title>${title} - ${student.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                @page { size: A4 portrait; margin: 0; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', sans-serif;
                    color: #1e293b;
                    line-height: 1.6;
                    background: #f1f5f9;
                    display: flex;
                    justify-content: center;
                    padding: 40px 0;
                }
                .container {
                    width: 210mm;
                    min-height: 297mm;
                    background: white;
                    padding: 2.5cm;
                    box-shadow: 0 0 40px rgba(0,0,0,0.1);
                    position: relative;
                }
                .header {
                    display: flex;
                    align-items: center;
                    gap: 25px;
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 25px;
                    margin-bottom: 60px;
                }
                .logo-container img { height: 65px; width: auto; }
                .school-text h1 {
                    font-size: 22px;
                    font-weight: 800;
                    color: #1e3a8a;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }
                .school-text p { font-size: 12px; color: #64748b; font-weight: 500; }
                
                .title-container { text-align: center; margin-bottom: 80px; }
                .title-container h2 {
                    font-size: 22px;
                    font-weight: 800;
                    color: #0f172a;
                    text-decoration: underline;
                    text-underline-offset: 8px;
                }
                
                .content {
                    font-size: 16px;
                    text-align: justify;
                    margin-bottom: 100px;
                    line-height: 2.2;
                    color: #334155;
                }
                .content strong { color: #0f172a; font-weight: 700; }
                
                .date-location { text-align: right; margin-bottom: 120px; font-weight: 600; font-size: 16px; }
                
                .signature-section {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-top: auto;
                }
                .signature-line { width: 300px; border-top: 1.5px solid #0f172a; margin-bottom: 8px; }
                .signature-section p { font-size: 14px; font-weight: 700; color: #0f172a; }
                .signature-section span { font-size: 12px; color: #64748b; }

                @media print {
                    body { background: white; padding: 0; }
                    .container { box-shadow: none; width: 100%; border: none; padding: 2cm; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo-container">
                        <img src="${logoUrl}" alt="Logo">
                    </div>
                    <div class="school-text">
                        <h1>Expansivo Rede de Ensino</h1>
                        <p style="color: #1e3a8a; font-weight: 700;">Unidade ${student.unit}</p>
                        <p>${unitInfo.address}</p>
                        <p>CNPJ: ${unitInfo.cnpj} | Tel: ${unitInfo.phone}</p>
                    </div>
                </div>

                <div class="title-container">
                    <h2>${title}</h2>
                </div>

                <div class="content">
                    ${content}
                    <br><br>
                    Por ser verdade, firmamos a presente declaração.
                </div>

                <div class="date-location">
                    ${city}, ${formattedDate}.
                </div>

                <div class="signature-section">
                    <div class="signature-line"></div>
                    <p>Secretaria Escolar</p>
                    <span>Expansivo Rede de Ensino</span>
                </div>
            </div>
            <script>
                window.onload = () => {
                    window.print();
                    // window.close();
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

