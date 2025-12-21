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
    if (sigla.includes('A')) return `${sigla.replace(/\D/g, '')}º Ano - Fundamental I`; // Default to Fund I if unknown, but usually covered
    if (sigla.startsWith('N')) return `Nível ${sigla.replace(/\D/g, '')} - Edu. Infantil`;

    return sigla;
}

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    const studentRegex = /(\d{1,4})\s+\d+\s+([A-Z\xC0-\xFF\s\n\-\.]{5,100}?)\s+(0[1-6])\s+([0-9][AS]|N[1-5]|[0-9]{2}[AS])\s+(MATUTINO|VESPERTINO)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, name, anchor, sigla, shift] = match;
        name = name.trim().replace(/\s+/g, ' ');

        const gradeLevel = translateGrade(sigla);
        let schoolClass = 'A';

        const nextPart = content.substring(match.index + full.length, match.index + full.length + 400);
        const dateLineMatch = nextPart.match(/\s+([AB])\s+\d{2}\/\d{2}\/\d{4}/);

        if (dateLineMatch) {
            schoolClass = dateLineMatch[1];
        } else {
            const lastChar = sigla.slice(-1);
            if (['A', 'B', 'C', 'D'].includes(lastChar)) {
                schoolClass = lastChar;
            }
        }

        students.push({
            code,
            name,
            gradeLevel,
            gradeLevelSigla: sigla,
            shift: shift.charAt(0).toUpperCase() + shift.slice(1).toLowerCase(),
            schoolClass,
            unit: 'Quintas'
        });
    }
    return students;
}

async function importStudents() {
    console.log("Reading Batch 2 data...");
    if (!fs.existsSync('quintas_batch2_data.txt')) {
        console.error("Data file not found!");
        return;
    }
    const rawText = fs.readFileSync('quintas_batch2_data.txt', 'utf8');
    const parsed = parseStudents(rawText);

    console.log(`Parsed ${parsed.length} students.`);
    if (parsed.length === 0) {
        console.log("DEBUG: Regex problem.");
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
            gradeLevelSigla: data.gradeLevelSigla,
            shift: data.shift,
            schoolClass: data.schoolClass,
            unit: data.unit,
            isBlocked: false,
            nome_responsavel: '',
            metodo_pagamento: 'Interno'
        };

        const docRef = db.collection('students').doc(studentId);
        batch.set(docRef, student, { merge: true });
        count++;
        total++;

        const isInfantil = data.gradeLevel.includes('Infantil');
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
