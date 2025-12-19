import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}
if (typeof window === 'undefined') {
    global.window = {};
}

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi80cYUxj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = firebase.initializeApp(firebaseConfig);
const db = app.firestore();

const SUBJECTS = [
    'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Empreendedorismo',
    'Ensino Religioso', 'Espanhol', 'Filosofia', 'Física', 'Geografia',
    'História', 'Inglês', 'Literatura', 'Matemática', 'Musicalização',
    'Português', 'Projeto de Vida', 'Química', 'Redação', 'Sociologia'
];

const RAW_TEXT = `
456 24 ANA LYZ VERÍSSIMO DO VALE 01 N2 MANHA -
RUA NíSIAM FALOTURTEISNTOA , 3 2-REGOMOLEIRO/SãO GONçALO DO
AMARANTE
17/01/2025
A 21/06/2023
356 24 CLAUDIO JONES DE ALBUQUERQUE
ALVES
01 N2 TARDE -
RUA RIZOMVAESRP CEORRTIRNEOIA DOS SANTOS,168-NOSSA SENHORA DA
APRESENTAçãO/NATAL
25/11/2024
B 18/08/2022
418 24 JOSE RAVI SILVA DE LIMA 01 N2 TARDE -
TRAVESSAV SEASNPETRA TFIENRON ANDA,67-NOSSA SENHORA DA
APRESENTAçãO/NATAL
03/01/2025
B 05/08/2022
481 24 HEITOR HENRIQUE PAIVA
FERNANDES
01 N3 TARDE -
VESPERTINO
99616 4780
RUA LAGOA MUNDAU,1378-POTENGI/NATAL 28/01/2025
A 31/12/2021
543 24 LIZ AURORA ANDRADE DE PAIVA
CABRAL
01 N3 MANHA -
MATUTINO
84991209949
RUA VALENCIA,77-CONJUNTO ESPANHO/EXTREMOZ 01/04/2025
A 30/03/2022
434 24 MATHEUS LEVI DOS SANTOS
COSTA
01 N3 MANHA -
BR 101 RODMOAVTIUAT IMNAOR I O CORVAS,4224-MIRANTES GREEN BLOCO
/
10/01/2025
A 04/11/2025
357 24 MIGUEL INACIO LIMA 01 N3 MANHA -
MATUTINO
98731 9734
R MARIA PAULINO DOS SANTOS OLIVEIRA,578-NOSSA SENHORA
DA APRESENTAÇÃO/NATAL
27/11/2024
A 15/08/2021
389 24 THEO DOS SANTOS DE MELO 01 N3 MANHA -
MATUTINO
99957 5612
BR 101 KM 77,-JARDINS/EXTREMOZ 17/12/2024
A 22/11/2021
474 24 VALENTINA ALVES LIMA 01 N3 TARDE -
VESPERTINO
84991748588 VIVIANE
TRAVESSA SóCRATES,28-NOSSA SENHORA DA
APRESENTAçãO/NATAL
24/01/2025
A 27/10/2021
396 24 VICTOR OLIVEIRA DE MOURA SILVA 01 N3 MANHA -
MATUTINO
98701 8216
RUA TANGARA DA SERRA ,206-PQ DOS COQUEIROS/NATAL 26/12/2024
A 08/09/2021
20 24 WANESSA EMANUELE RODRIGUES
DA T SILVA
01 N3 MANHA -
MATUTINO
988985101/987775944
RUA SANTA MATILDE,169-NOSSA SENHORA DA
APRESENTAçãO/NATAL
31/01/2025
A 08/07/2021
98 24 ADRYAN LIMA DA SILVA 01 N3 TARDE -
VESPERTINO
986233539/21309906
RUA NILóPOLIS,2946-POTENGI/NATAL 07/01/2025
B 10/01/2022
516 24 ATHOS JUSTINO PORPINO
RODRIGUES
01 N3 TARDE -
RUA GRAVVAETSAPí,E2R7T2I5-POO TENGI/NATAL 07/02/2025
B 0
207 213 LEVY GIMINIANO RIBEIRO 01 N3 TARDE -
VESPERTINO
9866-3830
RUA ANTôNIO HENRIQUE DE BRITO,191-OLHO D'AGUA/SãO
GONçALO DO AMARANTE
06/02/2025
B 17/11/2021
353 24 LIZ SILVA DE SANTANA 01 N3 TARDE -
,-/ VESPERTINO 14/11/2024
B 25/06/2021
407 24 MARIA ALICE LIMA PEIXOTO 01 N3 TARDE -
,-/ VESPERTINO 27/12/2024
B 05/12/2021
444 24 MARIA VALENTINA NASCIMENTO
ALVES
01 N3 MANHA -
RUA SãO FMRAATNUCTISINCOO , 7 00-NOSSA SENHORA DA
APRESENTAçãO/NATAL
14/01/2025
B 19/03/2022
354 24 MIRELA LETICIA DANTAS
GAUDENCIO
01 N3 MANHA -
,-/ MATUTINO 25/11/2024
B 09/08/2021
275 24 NOAH NICOLAS OLIVEIRA
RODRIGUES
01 N3 TARDE -
VESPERTINO
988508454
RUA 15 MANOEL PATRICIO DE MEDEIROS ,2100-JARDINS/NATAL 29/01/2025
B 0
559 24 NOAH RAMALHO DA SILVA
NIEUWENHOOF
01 N3 TARDE -
,-/ VESPERTINO 01/08/2025
B 07/05/2021
`;

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');
    // Regex rigorosa: busca Código Ref Nome (01|02) Sigla Turno
    const studentRegex = /(\d{1,4})\s+(\d{1,3})\s+([A-Z\xC0-\xFF\s\n\-]{5,100}?)\s+(01|02)\s+(N[1-5]|[1-9][AB S]?|(?:\d+º\s+Ano))\s+(MANHA|TARDE|MATUTINO|VESPERTINO|TARDE-VESPE|TARDE-VESPERTINO|MANHÃ)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;
        const shift = (shiftRaw.includes('MANHA') || shiftRaw.includes('MATUTINO') || shiftRaw.includes('MANHÃ')) ? 'Matutino' : 'Vespertino';

        // Tentar capturar a turma (A ou B) na vizinhança
        const nextPart = content.substring(match.index + full.length, match.index + full.length + 300);
        const classMatch = nextPart.match(/\s+([AB])\s+\d{2}\/\d{2}\/\d{4}/);
        const schoolClass = classMatch ? classMatch[1] : 'A';

        students.push({
            code,
            name: name.trim().replace(/\s+/g, ' '),
            gradeSigla: grade.toUpperCase(),
            shift,
            schoolClass
        });
    }
    return students;
}

function translateGrade(sigla) {
    const infantilMap = {
        'N1': 'Nível I - Edu. Infantil',
        'N2': 'Nível II - Edu. Infantil',
        'N3': 'Nível III - Edu. Infantil',
        'N4': 'Nível IV - Edu. Infantil',
        'N5': 'Nível V - Edu. Infantil'
    };
    if (sigla.startsWith('N')) return infantilMap[sigla] || sigla;
    if (/^\d/.test(sigla)) {
        const num = parseInt(sigla.match(/^\d+/)[0]);
        if (sigla.includes('S')) return `${num}ª Série - Ens. Médio`;
        if (num >= 1 && num <= 5) return `${num}º Ano - Fundamental I`;
        return `${num}º Ano - Fundamental II`;
    }
    return sigla;
}

async function importStudents() {
    const parsed = parseStudents(RAW_TEXT);
    console.log(`Alunos parseados: ${parsed.length}`);

    for (const data of parsed) {
        const gradeLevel = translateGrade(data.gradeSigla);
        const studentId = `student_${data.code}`;

        const student = {
            id: studentId,
            code: data.code,
            name: data.name,
            password: '123',
            gradeLevel: gradeLevel,
            gradeLevelSigla: data.gradeSigla,
            shift: data.shift,
            schoolClass: data.schoolClass,
            unit: 'Boa Sorte',
            isBlocked: false,
            nome_responsavel: '',
            metodo_pagamento: 'Interno'
        };

        try {
            await db.collection('students').doc(studentId).set(student);
            console.log(`[OK] ${student.name} (${student.gradeLevel})`);

            const isInfantil = data.gradeSigla.startsWith('N') || gradeLevel.includes('Infantil');

            if (isInfantil) {
                // REGRA DE OURO: Remover notas para Infantil
                const gradesSnap = await db.collection('grades').where('studentId', '==', studentId).get();
                if (!gradesSnap.empty) {
                    console.log(`   -> [LIMPEZA] Removendo ${gradesSnap.size} matérias indevidas.`);
                    const batch = db.batch();
                    gradesSnap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } else {
                // Garantir 20 disciplinas para Fundamental/Médio
                const now = new Date().toISOString();
                for (const subject of SUBJECTS) {
                    const gradeId = `${studentId}_${subject.replace(/\s+/g, '_')}`;
                    await db.collection('grades').doc(gradeId).set({
                        id: gradeId,
                        studentId: studentId,
                        subject: subject,
                        bimesters: {
                            bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                            bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                            bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                            bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 }
                        },
                        mediaAnual: 0,
                        mediaFinal: 0,
                        situacaoFinal: 'Recuperação',
                        lastUpdated: now
                    }, { merge: true });
                }
                console.log(`   -> [GRADES] 20 matérias garantidas.`);
            }
        } catch (e) {
            console.error(`[ERRO] ${data.name}:`, e);
        }
    }
    console.log("Importação finalizada.");
    process.exit(0);
}

importStudents().catch(err => {
    console.error("ERRO FATAL:", err);
    process.exit(1);
});
