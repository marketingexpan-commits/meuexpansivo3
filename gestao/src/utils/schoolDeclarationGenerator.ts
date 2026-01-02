
import { UNIT_DETAILS } from './receiptGenerator';
import type { Student } from '../types';

export function generateSchoolDeclaration(student: Student) {
    const unitInfo = UNIT_DETAILS[student.unit || 'Zona Norte'] || UNIT_DETAILS['Zona Norte'];
    const logoUrl = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
    const today = new Date();
    const formattedDate = today.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    const city = student.unit === 'Extremoz' ? 'Extremoz' : 'Natal';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
        <html>
        <head>
            <title>Declaração de Matrícula - ${student.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                @page {
                    size: A4 portrait;
                    margin: 5mm;
                }

                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', sans-serif;
                    color: #1e293b;
                    line-height: 1.6;
                    background: #f8fafc; /* Gray background for browser viewing */
                    padding: 20px;
                }

                .container {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                    background: white;
                    padding: 2cm; /* Internal padding for content */
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                }

                /* Header (Same as receipt) */
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 20px;
                    margin-bottom: 50px;
                }

                .school-branding {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .logo-container img {
                    height: 50px;
                    width: auto;
                    object-contain;
                }

                .school-text h1 {
                    font-size: 18px;
                    font-weight: 800;
                    color: #1e3a8a;
                    text-transform: uppercase;
                    letter-spacing: -0.5px;
                }

                .school-text p {
                    font-size: 11px;
                    color: #64748b;
                }

                /* Body Title */
                .title-container {
                    text-align: center;
                    margin-bottom: 60px;
                }

                .title-container h2 {
                    font-size: 24px;
                    font-weight: 800;
                    text-decoration: underline;
                    color: #0f172a;
                }

                /* Content */
                .content {
                    font-size: 15px;
                    text-align: justify;
                    margin-bottom: 80px;
                    line-height: 2;
                }

                .content strong {
                    color: #0f172a;
                }

                /* Footer */
                .date-location {
                    text-align: right;
                    margin-bottom: 100px;
                    font-weight: 500;
                }

                .signature-section {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                }

                .signature-line {
                    width: 250px;
                    border-top: 1px solid #1e293b;
                    margin-bottom: 5px;
                }

                .signature-section p {
                    font-size: 13px;
                    font-weight: 600;
                }

                @media print {
                    body { background: white; padding: 0; }
                    .container { 
                        width: 100%; 
                        box-shadow: none; 
                        margin: 0;
                        padding: 1.5cm; /* Adjust internal content padding for print */
                    }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Header -->
                <div class="header">
                    <div class="school-branding">
                        <div class="logo-container">
                            <img src="${logoUrl}" alt="Logo">
                        </div>
                        <div class="school-text">
                            <h1>Expansivo Rede de Ensino</h1>
                            <p style="font-weight: 700; color: #0f172a;">Unidade ${student.unit}</p>
                            <p>${unitInfo.address}</p>
                            <p>CNPJ: ${unitInfo.cnpj} | Tel: ${unitInfo.phone}</p>
                        </div>
                    </div>
                </div>

                <!-- Title -->
                <div class="title-container">
                    <h2>DECLARAÇÃO DE MATRÍCULA</h2>
                </div>

                <!-- Text Content -->
                <div class="content">
                    Declaramos, para os devidos fins, que o(a) aluno(a) <strong>${student.name.toUpperCase()}</strong>, 
                    inscrito(a) sob a matrícula nº <strong>${student.code || 'N/A'}</strong> e portador(a) do 
                    CPF <strong>${student.cpf_aluno || 'Não informado'}</strong>, encontra-se devidamente matriculado(a) 
                    e frequentando regularmente as aulas nesta instituição de ensino, no ano letivo de <strong>${new Date().getFullYear()}</strong>, 
                    cursando o(a) <strong>${student.gradeLevel || 'Não informado'}</strong>, na Turma <strong>${student.schoolClass || '-'}</strong>, 
                    turno <strong>${student.shift || '-'}</strong>.
                    <br><br>
                    Por ser verdade, firmamos a presente declaração.
                </div>

                <!-- Date and Location -->
                <div class="date-location">
                    ${city}, ${formattedDate}.
                </div>

                <!-- Signature Footer -->
                <div class="signature-section">
                    <div class="signature-line"></div>
                    <p>Secretaria Escolar</p>
                    <p style="font-size: 11px; font-weight: 400; color: #64748b;">Expansivo Rede de Ensino</p>
                </div>
            </div>

            <script>
                window.onload = () => {
                    window.print();
                    // window.close(); // Optional: close tab after print dialog
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}
