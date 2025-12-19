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
23 24 ADRIAN MANOEL ALVES DA SILVA
OLIVEIRA
02 2A MANHA -
MATUTINO
9872424047/994009218
RUA RIO DOS SINOS,388-NOSSA SENHORA DA
APRESENTAçãO/NATAL
24/02/2025
A 11/03/2018
39 24 ANTONNY LEVY SANTOS DA COSTA 02 2A MANHA -
MATUTINO
987554713/987192885
RUA PROFESSOR MANOEL VILAR,230-NOSSA SENHORA DA
APRESENTAçãO/NATAL
29/01/2025
A 21/11/2017
299 24 ARLEAN DO NASCIMENTO ARAUJO 02 2A MANHA -
RUA JOANAM AETLIUSTAIN FOE R N ANDES,688-NOSSA SENHORA DA
APRESENTAçãO/NATAL
03/02/2025
A 08/06/2017
518 24 BENJAMIM NAIRON NASCIMENTO
FERNANDES
02 2A MANHA -
RUA PRESIDMEANTTUET IMNAOS C ARENHAS ,355-QUINTAS /NATAL 07/02/2025
A 01/03/2017
521 24 DAVI NICHOLAS CAVALCANTE DE
SOUZA
02 2A MANHA -
RUA JOSé MMAATUURTíCINIOO D E MACEDO,26-NOSSA SENHORA DA
APRESENTAçãO/NATAL
08/02/2025
A 06/07/2017
511 24 ELOÁ LOPES DOS SANTOS 02 2A MANHA -
MATUTINO
84987619097
RUA MARIA DO SOCORRO DE AZEVEDO
MACHADO,68-GUAJIRU/SãO GONçALO DO AMARANTE
07/02/2025
A 03/05/2018
12 24 ENZO MIGUEL ARAUJO DE
OLIVEIRA
02 2A MANHA -
,-/ MATUTINO 11/02/2025
A 17/11/2017
325 24 HEITOR OLIVEIRA DE MEDEIROS 02 2A MANHA -
RUA ROSIMMAART UFTEIRNROE I R RA,46-NOSSA SENHORA DA
APRESENTAçãO/NATAL
20/01/2025
A 01/12/2017
147 24 HELENA SOPHIA DA SILVA
MARCOLINO
02 2A MANHA -
MATUTINO
8893-1125/9638-0353
RUA VALE DO CARIRI,57-NOSSA SENHORA DA
APRESENTAçãO/NATAL
28/01/2025
A 19/09/2017
499 24 ISLA VITORIA RODRIGUES
MOREIRA
02 2A MANHA -
MATUTINO
99196 2593
RODOVIA BR 101 ,4224-SÃO GONÇALO/SÃO GONÇALO DO
AMARANTE
06/02/2025
A 04/04/2017
154 24 JENNIFER HELOISA DA SILVA
FERNANDES
02 2A MANHA -
RUA SãO JMOAãOTU DTOIN MOE R ITI,2341-POTENGI/NATAL 25/01/2025
A 16/06/2017
92 24 JÚLIA TEREZA DA SILVA ARAÚJO 02 2A MANHA -
RODOVIA BMRA-T1U0T1,N4O22 4 -JARDINS/SãO GONçALO DO AMARANTE 10/01/2025
A 30/03/2018
219 24 KAUÊ MIGUEL SOUZA DA SILVA 02 2A MANHA -
MATUTINO
84 9 88109986
,-/ 14/01/2025
A 01/03/2018
96 100 LUIZ BENICIO MANIÇOBA DE LIMA 02 2A TARDE -
RUA GADEVLHESAP,1E0R0T-INNOOS SA SENHORA DA APRESENTAçãO/NATAL 14/01/2025
A 11/07/2017
137 24 LUIZ MANUEL QUEIROZ DE
OLIVEIRA
02 2A MANHA -
MATUTINO
986400663/987398403
RUA FRANCISCA LINDALVA DE SOUZA,48-JARDINS/SãO
GONçALO DO AMARANTE
14/01/2025
A 12/01/2018
470 24 MANUELA FERREIRA DE OLIVEIRA 02 2A MANHA -
RUA SANTAM LAUTIUZTAI N,1O4 6 - IGAPO/NATAL 22/01/2025
A 10/06/2017
421 24 MARIA HELENA DOS SANTOS LEÃO 02 2A TARDE -
VESPERTINO
99914 2454
ROD BR 101 4224,-JARDINS/SÃO GONÇALO 06/01/2025
A 11/03/2018
113 24 NICOLAS DANTE TAVARES TORRES 02 2A MANHA -
MATUTINO
991137877/988320060
AVENIDA BOA SORTE,-NOSSA SENHORA DA
APRESENTAçãO/NATAL
10/02/2025
A 11/03/2018
224 24 RYAN ALEXANDER SILVA MARINHO 02 2A MANHA -
MATUTINO
98762-3957
,-/ 07/02/2025
A 15/07/2017
91 24 URIEL LEVI DOS SANTOS
MARREIRO
02 2A MANHA -
MATUTINO
8748-8538/8785-0478
TRAVESSA JOSé LUIZ DA SILVA,27-NOSSA SENHORA DA
APRESENTAçãO/NATAL
27/12/2024
A 14/01/2018
140 145 VALENTINA THORRYCCELEE
SILVEIRA DE SANTA
02 2A MANHA -
MATUTINO
988180110/994556717
RUA JOSé LUíS DA SILVA,617-NOSSA SENHORA DA
APRESENTAçãO/NATAL
09/01/2025
A 24/03/2018
`;

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    // Pattern: Code Ref Name (01|02) (Grade|Sigla) Shift
    const studentRegex = /(\d{1,4})\s+(\d{1,3})\s+([A-Z\xC0-\xFF\s]{5,100}?)\s+(01|02)\s+(N[1-5]|[1-9][AB S]?|(?:\d+º\s+Ano))\s+(MANHA|TARDE|MATUTINO|VESPERTINO|TARDE-VESPE|TARDE-VESPERTINO|MANHÃ)/g;

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
            gradeLevelSigla: grade.toUpperCase(),
            shift: shift,
            schoolClass: schoolClass,
            unit: 'Boa Sorte'
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

    // 1. EDUCAÇÃO INFANTIL (Começa com N)
    if (sigla.startsWith('N')) {
        return infantilMap[sigla] || sigla;
    }

    // 2. ENSINO FUNDAMENTAL OU MÉDIO (Começa com Número)
    if (/^\d/.test(sigla)) {
        const num = parseInt(sigla.match(/^\d+/)[0]);

        // ENSINO MÉDIO (Siglas como 1S, 2S, 3S - S de Série)
        if (sigla.includes('S')) {
            return `${num}ª Série - Ens. Médio`;
        }

        // FUNDAMENTAL I (1 a 5)
        if (num >= 1 && num <= 5) {
            return `${num}º Ano - Fundamental I`;
        }

        // FUNDAMENTAL II (6 a 9)
        if (num >= 6 && num <= 9) {
            return `${num}º Ano - Fundamental II`;
        }
    }

    return sigla;
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
            gradeLevel: translateGrade(data.gradeLevelSigla),
            gradeLevelSigla: data.gradeLevelSigla, // Store the original sigla
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
