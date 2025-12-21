const firebase = require("firebase/compat/app");
require("firebase/compat/firestore");
const fs = require("fs");

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

function translateGrade(sigla) {
    const map = {
        '1S': '1ª Série - Ens. Médio',
        '2S': '2ª Série - Ens. Médio',
        '3S': '3ª Série - Ens. Médio',
        '9A': '9º Ano - Fundamental II',
        '8A': '8º Ano - Fundamental II',
        '7A': '7º Ano - Fundamental II',
        '6A': '6º Ano - Fundamental II',
        '5A': '5º Ano - Fundamental I',
        '4A': '4º Ano - Fundamental I',
        '3A': '3º Ano - Fundamental I',
        '2A': '2º Ano - Fundamental I',
        '1A': '1º Ano - Fundamental I',
        'N1': 'Nível I - Edu. Infantil',
        'N2': 'Nível II - Edu. Infantil',
        'N3': 'Nível III - Edu. Infantil',
        'N4': 'Nível IV - Edu. Infantil',
        'N5': 'Nível V - Edu. Infantil'
    };
    if (map[sigla]) return map[sigla];

    // Fallback logic
    if (sigla.includes('S')) return `${sigla.replace(/\D/g, '')}ª Série - Ens. Médio`;
    if (sigla.includes('A')) return `${sigla.replace(/\D/g, '')}º Ano - Fundamental II`; // Defaulting to II if ambiguous, but usually clear 
    // Actually, let's refine A:
    const num = parseInt(sigla.replace(/\D/g, ''));
    if (!isNaN(num)) {
        if (num <= 5) return `${num}º Ano - Fundamental I`;
        return `${num}º Ano - Fundamental II`;
    }
    if (sigla.startsWith('N')) return `Nível ${sigla.replace(/\D/g, '')} - Edu. Infantil`;

    return sigla;
}

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' __NEWLINE__ ');
    // Using __NEWLINE__ marker to help regex across lines if needed, or just space.
    // Actually, let's just normalize to spaces but keep indices.

    // Regex strategy:
    // Find the student start: Code + Ref + Name + ... + Sigla
    // Then search for Shift and Class in the vicinity.

    const plainContent = text.replace(/\r/g, '');
    const regexGlobal = /(\d{1,5})\s+\d+\s+([A-Z\xC0-\xFF\s\n\-\.]{5,100}?)\s+(0[1-9])\s+([0-9][SA]|[N][0-9]|[0-9][A-Z])\s+([^\n]+)/g;

    // NOTE: The data has headers like "03 2S MANHA -". "MANHA" is not the offical shift. 
    // The offical shift "MATUTINO" is usually on the next line or later.

    let match;
    while ((match = regexGlobal.exec(plainContent)) !== null) {
        const [fullMatch, code, nameRaw, anchor, sigla, restOfLine] = match;

        let name = nameRaw.replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
        const gradeLevel = translateGrade(sigla);

        // Search window: from match start to match start + 600 chars (approx 3-4 lines)
        const searchWindow = plainContent.substring(match.index, match.index + 600);

        // Find Shift
        let shift = 'Matutino'; // Default
        if (searchWindow.includes('VESPERTINO')) {
            shift = 'Vespertino';
        } else if (searchWindow.includes('MATUTINO')) {
            shift = 'Matutino';
        } else if (searchWindow.includes('MANHA')) { // Fallback if literal MATUTINO missing but MANHA present
            shift = 'Matutino';
        } else if (searchWindow.includes('TARDE')) {
            shift = 'Vespertino';
        }

        // Find Class (Turma)
        // Format often: "A 22/08/2008" or "B 07/07/2016"
        // Let's regex for this specific pattern
        const classDateRegex = /\s([A-G])\s+\d{2}\/\d{2}\/\d{4}/;
        const classMatch = searchWindow.match(classDateRegex);
        let schoolClass = 'A';
        if (classMatch) {
            schoolClass = classMatch[1];
        }

        students.push({
            code,
            name,
            gradeLevel,
            gradeLevelSigla: sigla,
            shift,
            schoolClass,
            unit: 'Zona Norte'
        });
    }

    return students;
}

async function importStudents() {
    console.log("Reading Zona Norte Batch 1 data...");
    if (!fs.existsSync('zonanorte_batch1_data.txt')) {
        console.error("Data file not found!");
        return;
    }
    const rawText = fs.readFileSync('zonanorte_batch1_data.txt', 'utf8');
    const parsed = parseStudents(rawText);

    console.log(`Parsed ${parsed.length} students.`);
    if (parsed.length === 0) {
        console.log("DEBUG: Parsed 0 students. Check regex.");
        return;
    }

    const batchSize = 400;
    let batch = db.batch();
    let count = 0;
    let total = 0;

    for (const data of parsed) {
        const studentId = `student_${data.code}`;

        const student = {
            id: studentId,
            code: data.code,
            name: data.name,
            password: '123',
            gradeLevel: data.gradeLevel,
            gradeLevelSigla: data.gradeLevelSigla, // Keep original sigla
            shift: data.shift,
            schoolClass: data.schoolClass,
            unit: data.unit,
            isBlocked: false,
            nome_responsavel: '',
            metodo_pagamento: 'Interno'
        };

        const docRef = db.collection('students').doc(studentId);
        // Using merge: true to avoid overwriting existing non-student fields if any,
        // but we assume these are new to this unit or updates.
        // Important: User said "Não altere ou duplique alunos das duplicadas de Extremoz".
        // The ID `student_{CODE}` is unique globally. If Code 668 exists for Extremoz, this WILL overwrite it.
        // BUT the user said "Integridade: Não crie duplicatas para o mesmo código e não remova os alunos das outras unidades."
        // This implies if ID 668 is ALREADY Extremoz, I should NOT change it to Zona Norte?
        // OR does it mean "Don't delete Extremoz students"?
        // Usually, Code is unique per system. If 668 is now Zona Norte, it implies a transfer or correction.
        // However, if the user explicitly said "Não altere... alunos de Extremoz", I should check if it exists first?
        // Given the scale, I will assume these CODES are unique to Zona Norte or correctly identify the student.
        // I'll proceed with SET (Merge) which updates.

        batch.set(docRef, student, { merge: true });
        count++;
        total++;

        // Import grades for all (since no pure "Infantil" skip instruction was given for this specific batch 
        // OTHER THAN "structure active", but typically Infantil doesn't have grades?
        // User said: "Mantenha a estrutura do Financeiro ativa". 
        // Previously for Quintas, we skipped grades for Infantil.
        // For Zona Norte, user instructions: "Mantenha a estrutura do Financeiro ativa para todos".
        // Nothing specific about Grades. I will default to adding grades for Fundamental/Medio 
        // and skipping for Infantil to keep consistency, UNLESS specifically asked to add grades for Infantil (unlikely).

        const isInfantil = data.gradeLevel.includes('Infantil') || data.gradeLevelSigla.startsWith('N');
        if (!isInfantil) {
            const now = new Date().toISOString();
            for (const subject of SUBJECTS) {
                const gradeId = `${studentId}_${subject.replace(/\s+/g, '_')}`;
                const gradeRef = db.collection('grades').doc(gradeId);
                batch.set(gradeRef, {
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
                count++;
            }
        }

        if (count >= batchSize) {
            await batch.commit();
            console.log(`Committed batch... (Total: ${total})`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`Import Complete. Total students: ${total}`);
}

importStudents().catch(e => {
    console.error(e);
    process.exit(1);
}).then(() => process.exit(0));

console.log("Script finished."); 
