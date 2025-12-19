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
99 24 ALICE MARIA FERREIRA MARREIRO 01 N4 TARDE -
VESPERTINO
988310224/998538389
RUA TUPITINGA,-NOSSA SENHORA DA APRESENTAçãO/NATAL 27/12/2024
A 29/04/2021
342 24 DOMINIC BEZERRA MAURICIO
SILVA
01 N4 MANHA -
RUA PADREM AJOTUãOTI NMOA R I A,55-NOSSA SENHORA DA
APRESENTAçãO/NATAL
08/02/2025
A 06/10/2020
536 24 RYAN LUCCA DOS SANTOS
BARBOSA
01 N4 MANHA -
MATUTINO
98833 0451/987525589
RUA IGUAPE ,107-LAGOA AZUL/NATAL 28/02/2025
A 21/05/2020
517 24 ALICIA DE PAIVA CARVALHO 01 N4 TARDE -
RUA FRANCVIESSCPAE RFTEIRNROE IRA DE SOUZA,05-NOSSA SENHORA DA
APRESENTAçãO/NATAL
07/02/2025
B 27/09/2020
100 24 AYLA MIRELLA ALVES BEZERRA 01 N4 TARDE -
RUA MANOVEELS FPREARNTICNISOC O DE ALBUQUERQUE,1239-NOSSA
SENHORA DA APRESENTAçãO/NATAL
08/01/2025
B 19/11/2020
44 24 BERNARDO RAVI LUCAS NEVES 01 N4 TARDE -
VESPERTINO
996349719/999217727
RUA COSME E DAMIãO,45-NOSSA SENHORA DA
APRESENTAçãO/NATAL
17/01/2025
B 15/03/2021
271 24 CHLOE MARTINS DA NOBREGA
NOTTINGHAM
01 N4 MANHA -
MATUTINO
98152-1832
RUA JOAO PAULO II,643-VALE DOURADO/NATAL 17/02/2025
B 06/04/2021
260 276 DIANA SARAH RODRIGUES DAS
NEVES
01 N4 TARDE -
VESPERTINO
98809-9004
AV. BOA SORTE,237-NSª SENHORA DA APRESENTACAO/NATAL 10/02/2025
B 26/04/2021
500 24 HENRY CAVALCANTE DA SILVA 01 N4 TARDE -
VESPERTINO
92145 7861
RUA SERRA DO VENTO,1086-NSA DA APRESENTAÇÃO/NATAL 06/02/2025
B 19/05/2020
408 24 JOAO VINICIUS ABREU DUARTE DE
SOUZA
01 N4 TARDE -
VESPERTINO
99938 1854
TV SANTA ROSA ,28 B-NOSSA SENHORA DA
APRESENTAÇÃO/NATAL
30/12/2024
B 03/11/2020
123 24 JOSE LUCAS DA SILVA OLIVEIRA 01 N4 TARDE-VESPE
RTINO
988047004/987446498
AVENIDA SANTARéM,1748-NOSSA SENHORA DA
APRESENTAçãO/NATAL
03/02/2025
B 28/07/2020
556 24 NICOLLAS DA SILVA COSTA 01 N4 TARDE -
RODOVIA BVRES-1P0E1,T4I2N2O4 -JARDINS/SÃO GONÇALO DO AMARANTE 10/06/2025
B 15/03/2021
366 24 RUAN MIGUEL DE OLIVEIRA
BATISTA
01 N4 TARDE -
VESPERTINO
99963 8892
R.MANOEL PATRICIO DE MEDEIROS,2100-JARDINS/NATAL 04/12/2024
B 23/10/2020
48 50 ANA LETÍCIA OLIVEIRA SOARES 01 N5 TARDE -
VESPERTINO
996480769/996439989
RUA NOSSA SENHORA DO PERPéTUO SOCORRO,0047-NOSSA
SENHORA DA APRESENTAçãO/NATAL
02/01/2025
B 29/01/2020
268 24 ANNE BEATRIZ JERONIMO DA
SILVA
01 N5 TARDE -
VESPERTINO
999564784
RUA JOSE TORRES,98-NSª SHª APRESENTACAO/NATAL 03/02/2025
B 12/02/2020
225 24 HEITOR NUNES DE MEDEIROS 01 N5 TARDE -
VESPERTINO
98823 1664
RUA LAGOA AMANA ,1116-POTENGI/NATAL 03/02/2025
B 30/05/2019
459 24 JOAQUIM BENÍCIO DO
NASCIMENTO SILVA
01 N5 TARDE -
RUA JOAO PVAEUSLPOER STEINGOUN DO,541-/NATAL 17/01/2025
B 28/05/2019
426 24 LORENZO CATALDO FELICIANO 01 N5 TARDE -
RUA MANOVEELS JPOESRéT IDNEO O LIVEIRA,211-LEIGOS/SAQUAREMA 08/01/2025
B 21/11/2019
484 24 RAFAEL LORENZO DE OLIVEIRA
FERNANDES
01 N5 TARDE -
RUA PADREV JEOSAPOER MTAINROIA ,104-GOLANDIM /NATAL 28/01/2025
B 20/09/2019
`;

function parseStudents(text) {
    const students = [];
    // Join lines to handle names split across lines
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    // Pattern: Code Ref Name 01 Grade Shift
    // Names are strictly UPPERCASE with possible accents. We anchor with '01' and the grade.
    // Adjusted reference code to be more flexible (24, 276, 50, etc.)
    const studentRegex = /(\d{1,4})\s+(\d{1,3})\s+([A-Z\xC0-\xFF\s]{5,100}?)\s+01\s+(N[2345]|(?:\d+º\s+Ano))\s+(MANHA|TARDE|MATUTINO|VESPERTINO|TARDE-VESPE|TARDE-VESPERTINO)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, grade, shiftRaw] = match;

        // Clean up name - it might contain parts of address or other info if the grade anchor is far
        // But the "01" anchor is quite specific.
        name = name.trim();

        // Shift cleaning
        const shift = shiftRaw.includes('MANHA') || shiftRaw.includes('MATUTINO') ? 'Matutino' : 'Vespertino';

        // Find Class (A or B) following the record
        // It usually follows a date pattern: DD/MM/YYYY A DD/MM/YYYY
        // We'll search in the text following this match until the next student start
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
        'N5': 'Nível V - Edu. Infantil'
    };
    return map[grade] || grade;
}

function translateShift(shift) {
    if (shift === 'MANHA' || shift === 'MATUTINO') return 'Matutino';
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
