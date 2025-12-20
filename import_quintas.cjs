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

// Grade de matérias para Fundamental/Médio (20 disciplinas)
const SUBJECTS = [
    'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Empreendedorismo',
    'Ensino Religioso', 'Espanhol', 'Filosofia', 'Física', 'Geografia',
    'História', 'Inglês', 'Literatura', 'Matemática', 'Musicalização',
    'Português', 'Projeto de Vida', 'Química', 'Redação', 'Sociologia'
];

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');

    const studentRegex = /(\d{1,5})\s+(\d{1,5})\s+([A-Z\xC0-\xFF\s\n\-]+?)\s+(0[1-9])\s+([0-9][A-Z]S?|[0-9][A-Z]|N[1-5])\s+(MATUTINO|VESPERTINO)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;
        const shift = (shiftRaw.includes('MATUTINO')) ? 'Matutino' : 'Vespertino';

        // Tentar capturar a turma (ex: "A 24/06/2007") na vizinhança
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

        // CORRECTION: Explicitly check for 'S' suffix for Ensino Médio
        if (sigla.includes('S')) {
            return `${num}ª Série - Ens.Médio`;
        }

        // If not S, assuming Fundamental.
        // 1-5 -> Fund I
        // 6-9 -> Fund II
        if (num >= 1 && num <= 5) return `${num}º Ano - Fundamental I`;
        return `${num}º Ano - Fundamental II`;
    }
    return sigla;
}

async function importStudents() {
    console.log("Reading data file...");
    let rawText = "";
    try {
        rawText = fs.readFileSync('quintas_data.txt', 'utf8');
    } catch (err) {
        console.error("Error reading quintas_data.txt:", err);
        process.exit(1);
    }

    console.log("Parsing text...");
    const parsed = parseStudents(rawText);
    console.log(`Found ${parsed.length} students to process.`);

    // GRADE OVERRIDES: Fix known data issues manually
    const GRADE_OVERRIDES = {
        '85': '1ª Série - Ens.Médio'
    };

    for (const data of parsed) {
        let gradeLevel = translateGrade(data.gradeSigla);

        // Apply Override if exists
        if (GRADE_OVERRIDES[data.code]) {
            console.log(`   [OVERRIDE] Fixing grade for ${data.name} (Code ${data.code}): ${gradeLevel} -> ${GRADE_OVERRIDES[data.code]}`);
            gradeLevel = GRADE_OVERRIDES[data.code];
        }

        const studentId = `student_${data.code}`;

        const student = {
            id: studentId,
            code: data.code,
            name: data.name,
            password: '123',
            gradeLevel: gradeLevel,
            gradeLevelSigla: data.gradeSigla, // We keep the original sigla for reference, or we could update it too if needed.
            shift: data.shift,
            schoolClass: data.schoolClass,
            unit: 'Quintas',
            isBlocked: false,
            nome_responsavel: '',
            metodo_pagamento: 'Interno'
        };

        try {
            const batch = db.batch();
            const studentRef = db.collection('students').doc(studentId);
            batch.set(studentRef, student, { merge: true });

            // Check if it's infantil based on the *potentially overridden* gradeLevel
            const isInfantil = data.gradeSigla.startsWith('N') || gradeLevel.includes('Infantil');

            if (!isInfantil) {
                const now = new Date().toISOString();
                for (const subject of SUBJECTS) {
                    const gradeId = `${studentId}_${subject.replace(/\s+/g, '_')}`;
                    const gradeRef = db.collection('grades').doc(gradeId);

                    // Note: We use merge: true to avoid overwriting existing grades if they exist
                    // but we ensure the structure is correct.
                    batch.set(gradeRef, {
                        id: gradeId,
                        studentId: studentId,
                        subject: subject,
                        // Only set default values if document doesn't exist is not easily possible with Merge in one go for nested fields without overwriting.
                        // However, the previous script was just doing set({ ... }, { merge: true }).
                        // To be safe and identical to previous logic:
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
            }

            await batch.commit();
            console.log(`[OK] ${student.name} (${student.gradeLevel}) - Class ${student.schoolClass}`);

            if (isInfantil) {
                // Separate clean-up for infantil (rare case of fixing incorrect imports)
                // This requires a read, so we keep it separate from the write batch above
                const gradesSnap = await db.collection('grades').where('studentId', '==', studentId).get();
                if (!gradesSnap.empty) {
                    console.log(`   -> [CLEAN] Removing ${gradesSnap.size} grades not needed for Infantil.`);
                    const deleteBatch = db.batch();
                    gradesSnap.docs.forEach(doc => deleteBatch.delete(doc.ref));
                    await deleteBatch.commit();
                }
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
