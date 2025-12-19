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
223 24 ANTHONY MIGUEL GOMES BESSA 02 1A TARDE -
RUA PROFEVSESSOPERR MTIANNOO EL VILAR,197-NOSSA SENHORA DA
APRESENTAçãO/NATAL
07/01/2025
A 24/03/2019
6 24 ANTONIO MIGUEL DA SILVA
ANDRADE
02 1A MANHA -
MATUTINO
98836-9059/988155561
RUA GERMINO BENIGNO,798-NOSSA SENHORA DA
APRESENTAçãO/NATAL
14/01/2025
A 10/05/2019
486 24 BEATRIZ MENDONÇA GOMES 02 1A MANHA -
MATUTINO
84987194414- WILMA
RUA LUIZ MOURA,700-LAGOA AZUL/NATAL 29/01/2025
A 14/07/2018
520 24 BENICIO JOSE ANDRADE PESSOA
RIBEIRO
02 1A MANHA -
MATUTINO
99490 6547
RUA MARIA QUERINA,194 B-JARDINS SÃO GONÇALO/NATAL 08/02/2025
A 0
501 24 BERNARDO MOURA DE AZEVEDO 02 1A MANHA -
RUA GARIBMAALTDUIT RINOOM A N O,538-NOSSA SENHORA DA
APRESENTAçãO/NATAL
06/02/2025
A 02/11/2018
552 24 HEITOR MIGUEL DA SILVA
TAVARES
02 1A MANHA -
,-/ MATUTINO 21/05/2025
A 20/10/2018
296 24 JOÃO VICTOR PINHEIRO DE LIMA 02 1A MANHA -
MATUTINO
84 991295959
RUA MANOEL PATRICIO DE MEDEIROS ,2100-JARDINS/SÃO
GONÇALO DO AMARANTE
08/02/2025
A 22/08/2018
102 24 LUCAS GABRIEL BARROS DA
FRANÇA LIMA
02 1A MANHA -
MATUTINO
999223315/991240746
RUA DOM PEDRO II,405-JARDINS/SãO GONçALO DO AMARANTE 08/02/2025
A 30/01/2019
538 24 MALU AGATHA ALVES CRUZ 02 1A MANHA -
MATUTINO
98796 1389
RUA SANTA INACIO DE LOWOLA,94-IGAPO/NATAL 07/03/2025
A 28/01/2019
50 24 MARIA ALICE DE SOUSA E LIMA 02 1A MANHA -
MATUTINO
8499915-2501 MAE
TRAVESSA MARANGUAPE,411-NOSSA SENHORA DA
APRESENTAçãO/NATAL
15/01/2025
A 02/08/2018
469 24 MARIANA FERREIRA DE OLIVEIRA 02 1A MANHA -
RUA SANTAM LAUTZUITAI N,1O0 4 6 -IGAPO /NATAL 22/01/2025
A 17/09/2018
316 348 PEDRO RIBEIRO DA SILVA NETO 02 1A MANHA -
TRAVESSAM SAATNUTTAIRNéOM , 1 6-NOSSA SENHORA DA
APRESENTAçãO/NATAL
21/03/2025
A 05/10/2018
339 24 RICKSON GUILHERME PIRES DE
OLIVEIRA
02 1A MANHA -
RUA COUTMOA MTAUGTIANLOH ã E S,195-NOSSA SENHORA DA
APRESENTAçãO/NATAL
05/02/2025
A 28/08/2018
29 24 SASHA SUYANNE SIQUEIRA
FERNANDES
02 1A MANHÃ -
MATUTINO
988102375
RUA DAS PETúNIAS,61A-NOSSA SENHORA DA
APRESENTAçãO/NATAL
10/01/2025
A 22/06/2018
374 24 CHRISTIAAN GAEL DE SOUZA
DANTAS
02 1A MANHA -
MATUTINO
84 98631 6698
RUA DA LIBERDADE,185-NOSSA SENHORA DA
APRESENTAçãO/NATAL
09/12/2024
B 01/03/2019
461 24 ENZO CAUA ARAUJO DE ANDRADE 02 1A TARDE -
VESPERTINO
99217 1198
RUA JOSE SOBRINHO ,10-NSA DA APRESENTAÇÃO/NATAL 20/01/2025
B 14/04/2018
555 24 ENZO GABRIEL DA SILVA COSTA 02 1A TARDE -
RODOVIA BVRES-1P0E1R,T4I2N2O4 -JARDINS/SãO GONçALO DO AMARANTE 10/06/2025
B 28/09/2017
51 24 JOSÉ RICARDO FERNANDES DA S. E
MEDEIROS
02 1A TARDE -
VESPERTINO
84 98864-7165
AVENIDA MARANGUAPE,4963-NOSSA SENHORA DA
APRESENTAçãO/NATAL
26/12/2024
B 07/11/2018
88 24 LIVIA VENANCIO DE OLIVEIRA 02 1A TARDE -
VESPERTINO
9843-2946/9831-0569
RUA MANOEL PATRíCIO DE MEDEIROS,2100-JARDINS/SãO
GONçALO DO AMARANTE
21/02/2025
B 22/11/2018
460 24 LUNNA SOPHIE DE ALMEIDA
RODRIGUES
02 1A TARDE -
VESPERTINO
91 980246048
AV BAHIA,2022-POTENGI/NATAL 17/01/2025
B 04/03/2019
554 24 MARIA SOFIA CAVALCANTE ALVES 02 1A TARDE -
RUA FLOR VDEES JPúEPRITTIENRO,1 05-NOSSA SENHORA DA
APRESENTAçãO/NATAL
09/06/2025
B 13/03/2019
103 24 MIGUEL BRYAN PEREIRA ROCHA 02 1A TARDE -
VESPERTINO
987317979/986330330
TRAVESSA JOSé LUIZ DA SILVA,6-NOSSA SENHORA DA
APRESENTAçãO/NATAL
07/02/2025
B 30/07/2018
`;

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    // Pattern: Code Ref Name (01|02) (Grade|1A) Shift
    const studentRegex = /(\d{1,4})\s+(\d{1,3})\s+([A-Z\xC0-\xFF\s]{5,100}?)\s+(01|02)\s+(N[2345]|1A|(?:\d+º\s+Ano))\s+(MANHA|TARDE|MATUTINO|VESPERTINO|TARDE-VESPE|TARDE-VESPERTINO|MANHÃ)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;

        name = name.trim();
        const shift = (shiftRaw.includes('MANHA') || shiftRaw.includes('MATUTINO') || shiftRaw.includes('MANHÃ')) ? 'Matutino' : 'Vespertino';

        const nextPart = content.substring(match.index + full.length, match.index + full.length + 300);
        const classMatch = nextPart.match(/\s+([AB])\s+\d{2}\/\d{2}\/\d{4}/);
        const schoolClass = classMatch ? classMatch[1] : 'A';

        students.push({
            code,
            name: name,
            gradeLevelRaw: grade.toUpperCase(),
            shift: shift,
            schoolClass: schoolClass,
            unit: 'Boa Sorte'
        });
    }
    return students;
}

function translateGrade(grade) {
    const map = {
        'N2': 'Nível II - Edu. Infantil',
        'N3': 'Nível III - Edu. Infantil',
        'N4': 'Nível IV - Edu. Infantil',
        'N5': 'Nível V - Edu. Infantil',
        '1A': '1º Ano'
    };
    return map[grade] || grade;
}

function translateShift(shift) {
    if (shift === 'MANHA' || shift === 'MATUTINO' || shift === 'MANHÃ') return 'Matutino';
    if (shift === 'TARDE' || shift === 'VESPERTINO') return 'Vespertino';
    return shift;
}

function createEmptyBimester() {
    return { nota: null, recuperacao: null, media: 0, faltas: 0 };
}

async function importStudents() {
    const parsed = parseStudents(RAW_TEXT);
    console.log(`Parsed ${parsed.length} students. Starting import...`);

    for (const data of parsed) {
        const student = {
            id: `student_${data.code}`,
            code: data.code,
            name: data.name,
            password: '123',
            gradeLevel: translateGrade(data.gradeLevelRaw),
            shift: data.shift,
            schoolClass: data.schoolClass,
            unit: 'Boa Sorte',
            isBlocked: false,
            nome_responsavel: '',
            metodo_pagamento: 'Interno'
        };

        try {
            await db.collection('students').doc(student.id).set(student);
            console.log(`[OK] Student: ${student.name} (${student.gradeLevel})`);

            // If not Early Childhood, create grades
            const isInfantil = student.gradeLevel.includes('Nível') || student.gradeLevel.includes('Infantil');
            if (!isInfantil) {
                for (const subject of SUBJECTS) {
                    const gradeId = `${student.id}_${subject.replace(/\s+/g, '_')}`;
                    const gradeEntry = {
                        id: gradeId,
                        studentId: student.id,
                        subject: subject,
                        bimesters: {
                            bimester1: createEmptyBimester(),
                            bimester2: createEmptyBimester(),
                            bimester3: createEmptyBimester(),
                            bimester4: createEmptyBimester()
                        },
                        mediaAnual: 0,
                        mediaFinal: 0,
                        situacaoFinal: 'Recuperação', // Initial state
                        lastUpdated: new Date().toISOString()
                    };
                    await db.collection('grades').doc(gradeId).set(gradeEntry);
                }
                console.log(`     -> Generated 20 subjects for ${student.name}`);
            }
        } catch (e) {
            console.error(`[ERROR] Failed to import ${student.name}:`, e);
        }
    }

    console.log('Import finished!');
    process.exit(0);
}

importStudents();
