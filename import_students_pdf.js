import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import fs from "fs";

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

function parseStudents(text) {
    const students = [];
    const content = text.replace(/\r/g, '').split('\n').join(' ');
    // Regex rigorosa: busca Código Ref Nome (01|02) Sigla Turno
    const studentRegex = /(\d{1,4})\s+(\d{1,3})\s+([A-Z\xC0-\xFF\s\n\-\.]{5,100}?)\s+(01|02)\s+(N[1-5]|[1-9][AB S]?|(?:\d+º\s+Ano))\s+(MANHA|TARDE|MATUTINO|VESPERTINO|TARDE-VESPE|TARDE-VESPERTINO|MANHÃ)/g;

    let match;
    while ((match = studentRegex.exec(content)) !== null) {
        let [full, code, ref, name, anchor, grade, shiftRaw] = match;
        const shift = (shiftRaw.includes('MANHA') || shiftRaw.includes('MATUTINO') || shiftRaw.includes('MANHÃ')) ? 'Matutino' : 'Vespertino';
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

async function startImport() {
    console.log("Reading batch9.txt...");
    const rawText = fs.readFileSync('batch9.txt', 'utf8');
    const parsed = parseStudents(rawText);
    console.log(`Parsed ${parsed.length} students.`);

    for (const data of parsed) {
        const gradeLevel = translateGrade(data.gradeSigla);
        const studentId = `student_${data.code}`;

        const student = {
            id: studentId,
            code: data.code,
            name: data.name,
            password: '123',
            gradeLevel,
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

            const isInfantilBySigla = data.gradeSigla.startsWith('N');
            const isInfantilByName = gradeLevel.includes('Infantil') || gradeLevel.includes('Nível');

            if (isInfantilBySigla || isInfantilByName) {
                const gradesSnap = await db.collection('grades').where('studentId', '==', studentId).get();
                if (!gradesSnap.empty) {
                    console.log(`   -> [CLEANUP] Removing ${gradesSnap.size} subjects for Infantil.`);
                    const batch = db.batch();
                    gradesSnap.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } else {
                const now = new Date().toISOString();
                for (const subject of SUBJECTS) {
                    const gradeId = `${studentId}_${subject.replace(/\s+/g, '_')}`;
                    await db.collection('grades').doc(gradeId).set({
                        id: gradeId,
                        studentId,
                        subject,
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
                console.log(`   -> [GRADES] 20 subjects guaranteed.`);
            }
        } catch (e) {
            console.error(`[ERROR] ${data.name}:`, e);
        }
    }
    console.log("Done.");
    process.exit(0);
}

startImport().catch(err => {
    console.error("CRITICAL ERROR:", err);
    process.exit(1);
});
