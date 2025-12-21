console.log("Script starting...");
const fs = require('fs');
let firebase;
try {
    const pkg = require("firebase/compat/app");
    firebase = pkg.default || pkg;
    require("firebase/compat/firestore");
    console.log("Firebase loaded.");
} catch (e) {
    console.error("Firebase load error:", e);
    process.exit(1);
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
console.log("DB Initialized.");

const SUBJECTS = [
    'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Empreendedorismo',
    'Ensino Religioso', 'Espanhol', 'Filosofia', 'Física', 'Geografia',
    'História', 'Inglês', 'Literatura', 'Matemática', 'Musicalização',
    'Português', 'Projeto de Vida', 'Química', 'Redação', 'Sociologia'
];

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    // Adjusted regex to match the provided format
    // Matches: Code Ref Name Anchor(03) Grade(1S) Shift(MANHA)
    const studentRegex = /(\d{1,5})\s+(\d{1,5})\s+([A-Z\xC0-\xFF\s\n\-]+?)\s+(03)\s+(1S)\s+(MANHA)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;

        students.push({
            code,
            name: name.trim().replace(/\s+/g, ' '),
            gradeSigla: grade,
            shift: 'Matutino', // Forced as per rules
            schoolClass: 'A' // Default assumption if not found, though prompt implies 1S is enough.
        });
    }
    return students;
}

async function importStudents() {
    console.log("Reading data file...");
    let rawText = "";
    try {
        rawText = fs.readFileSync('extremoz_1s_data.txt', 'utf8');
    } catch (err) {
        console.error("Error reading data file:", err);
        process.exit(1);
    }

    console.log("Parsing text...");
    const parsed = parseStudents(rawText);
    console.log(`Found ${parsed.length} students to process.`);

    for (const data of parsed) {
        // Enforcing rules:
        // Série: '1S' -> '1ª Série - Ens. Médio'
        // Unidade: 'Extremoz'
        // Turno: 'Matutino'

        const gradeLevel = '1ª Série - Ens. Médio';
        const unit = 'Extremoz';
        const shift = 'Matutino';
        const studentId = `student_${data.code}`;

        const student = {
            id: studentId,
            code: data.code,
            name: data.name,
            gradeLevel: gradeLevel,
            gradeLevelSigla: data.gradeSigla,
            shift: shift,
            unit: unit,
            // Only defaults for new students:
            isBlocked: false,
            nome_responsavel: '',
            metodo_pagamento: 'Interno'
            // Password? Typically logic sets it if missing.
        };

        try {
            const docRef = db.collection('students').doc(studentId);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                // Update specific fields only to avoid breaking financial data
                console.log(`[UPDATE] Student ${data.code} - ${data.name} exists. Updating Grade/Shift/Unit.`);
                await docRef.update({
                    gradeLevel: gradeLevel,
                    gradeLevelSigla: data.gradeSigla,
                    shift: shift,
                    unit: unit,
                    name: data.name // Update name just in case of correction
                });
            } else {
                // Create new student
                console.log(`[CREATE] Student ${data.code} - ${data.name} is NEW.`);
                await docRef.set({
                    ...student,
                    password: '123' // Default password for new
                });

                // Initialize grades for new students
                const now = new Date().toISOString();
                const batch = db.batch();
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
                    });
                }
                await batch.commit();
                console.log(`   -> Created grades for ${data.name}`);
            }

        } catch (e) {
            console.error(`[ERROR] ${data.name}: `, e);
        }
    }
    console.log("Import finished.");
}

importStudents().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
}).then(() => process.exit(0));
