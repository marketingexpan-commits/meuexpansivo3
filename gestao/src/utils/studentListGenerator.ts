import type { Student, SchoolUnitDetail } from '../types';

export const generateStudentList = (students: Student[], groupTitle: string, type: 'simple' | 'complete', unitDetail: SchoolUnitDetail) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Use the unit detail provided
    const unitName = students.length > 0 ? students[0].unit : unitDetail.fullName;
    const unitInfo = unitDetail;

    // Assets from receiptGenerator
    const logoUrl = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
    const currentDate = new Date().toLocaleDateString('pt-BR');



    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relação de Alunos - ${groupTitle}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
                @page {
                    margin-top: 5mm;
                    margin-bottom: 5mm;
                    margin-left: 5mm;
                    margin-right: 5mm;
                }
                * {
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Inter', Arial, sans-serif;
                    background: #fff;
                    margin: 0;
                    padding: 0;
                    font-size: 10px;
                }
                
                .header {
                    display: flex;
                    align-items: center;
                    border-bottom: 2px solid #000;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                    width: 100%;
                }
                .logo-container { width: 60px; height: 60px; margin-right: 15px; }
                .logo-container img { width: 100%; height: 100%; object-fit: contain; }
                
                .school-text { flex: 1; }
                .school-text h1 { margin: 0; font-size: 16px; text-transform: uppercase; color: #000; }
                .school-text p { margin: 2px 0; font-size: 10px; color: #333; }
                
                .doc-title { text-align: right; }
                .doc-title h2 { margin: 0; font-size: 14px; text-transform: uppercase; border: 1px solid #000; padding: 5px 10px; display: inline-block; }
                .doc-meta { font-size: 9px; margin-top: 5px; text-align: right; }

                .group-title {
                    background-color: #f0f0f0;
                    padding: 5px;
                    font-weight: bold;
                    font-size: 11px;
                    text-transform: uppercase;
                    border: 1px solid #ccc;
                    margin-bottom: 10px;
                    text-align: center;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9px;
                }
                th {
                    background-color: #e0e0e0;
                    border: 1px solid #000;
                    padding: 4px;
                    text-align: left;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                td {
                    border: 1px solid #ccc;
                    padding: 4px;
                    vertical-align: middle;
                }
                tr:nth-child(even) { background-color: #f9f9f9; }

                .footer {
                    margin-top: 20px;
                    border-top: 1px solid #000;
                    padding-top: 5px;
                    font-size: 9px;
                    text-align: center;
                }
                .total-count {
                    font-weight: bold;
                    margin-top: 10px;
                    text-align: right;
                    font-size: 11px;
                }
            </style>
        </head>
        <body>


            <div class="header">
                <div class="logo-container">
                    <img src="${logoUrl}" alt="Logo">
                </div>
                <div class="school-text">
                    <h1>Expansivo Rede de Ensino</h1>
                    <p><strong>Unidade ${unitName}</strong></p>
                    <p>${unitInfo.address}</p>
                    <p>CNPJ: ${unitInfo.cnpj} | Tel: ${unitInfo.phone}</p>
                </div>
                <div class="doc-title">
                    <h2>Relação de Alunos</h2>
                    <div class="doc-meta">Emissão: ${currentDate}</div>
                </div>
            </div>

            <div class="group-title">
                ${groupTitle}
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th>Matrícula</th>
                        <th>Aluno</th>
                        <th>Série</th>
                        <th>Turma</th>
                        <th>Turno</th>
                        ${type === 'complete' ? `
                        <th>Responsável</th>
                        <th>Telefone</th>
                        <th style="width: 25%;">Endereço</th>
                        <th>Situação</th>
                        ` : ''}
                    </tr>
                </thead>
                <tbody>
                    ${students.sort((a, b) => a.name.localeCompare(b.name)).map((student, index) => {
        const address = student.endereco_logradouro
            ? `${student.endereco_logradouro}, ${student.endereco_numero || 'S/N'} - ${student.endereco_bairro || ''}`
            : '-';

        const rawPhone = student.telefone_responsavel || student.phone || student.contactPhone || '';
        let cleanPhone = rawPhone.replace(/\D/g, '');

        // Ensure it starts with 55 if it has enough digits (standardize)
        if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) {
            cleanPhone = `55${cleanPhone}`;
        }

        let formattedPhone = cleanPhone || '-';
        let whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '';
        return `
                        <tr>
                            <td style="text-align: center;">${index + 1}</td>
                            <td>${student.code || '-'}</td>
                            <td><strong>${student.name.toUpperCase()}</strong>${type === 'complete' && student.cpf_aluno ? `<br><span style="font-size:8px; color:#666">CPF: ${student.cpf_aluno}</span>` : ''}</td>
                            <td>${student.gradeLevel || '-'}</td>
                            <td style="text-align: center;">${student.schoolClass || '-'}</td>
                            <td style="text-align: center;">${student.shift || '-'}</td>
                            ${type === 'complete' ? `
                            <td>${student.financialResponsible || student.nome_responsavel || '-'}</td>
                            <td>
                                ${whatsappLink
                    ? `<a href="${whatsappLink}" target="_blank" style="text-decoration: none; color: inherit;">${formattedPhone}</a>`
                    : formattedPhone}
                            </td>
                            <td style="font-size: 8px;">${address}</td>
                            <td>${student.isBlocked ? 'Bloqueado' : 'Ativo'}</td>
                            ` : ''}
                        </tr>
                    `}).join('')}
                </tbody>
            </table>

            <div class="total-count">
                Total de Alunos: ${students.length}
            </div>

            <div class="footer">
                Relatório gerado pelo Sistema de Gestão Escolar - Meu Expansivo
            </div>

            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};
