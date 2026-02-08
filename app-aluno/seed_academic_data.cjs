const { initializeApp } = require("firebase/app");
const { getFirestore, collection, setDoc, doc, getDocs, writeBatch } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Data structure mirroring academicDefaults.ts but with explicit exclusions
const SUBJECTS_TO_SEED = [
    { id: 'disc_portugues', name: 'Português', shortName: 'Port', order: 10 },
    { id: 'disc_matematica', name: 'Matemática', shortName: 'Mat', order: 20 },
    { id: 'disc_historia', name: 'História', shortName: 'His', order: 30 },
    { id: 'disc_geografia', name: 'Geografia', shortName: 'Geo', order: 40 },
    { id: 'disc_ciencias', name: 'Ciências', shortName: 'Ciên', order: 50 },
    { id: 'disc_ingles', name: 'Inglês', shortName: 'Ing', order: 60 },
    { id: 'disc_artes', name: 'Ens. Artes', shortName: 'Art', order: 70 },
    { id: 'disc_educacao_fisica', name: 'Ed. Física', shortName: 'E.F.', order: 80 },
    // Ensino Religioso EXCLUDED
    { id: 'disc_redacao', name: 'Redação', shortName: 'Red', order: 100 },
    { id: 'disc_literatura', name: 'Literatura', shortName: 'Lit', order: 110 },
    { id: 'disc_biologia', name: 'Biologia', shortName: 'Bio', order: 120 },
    { id: 'disc_fisica', name: 'Física', shortName: 'Fís', order: 130 },
    { id: 'disc_quimica', name: 'Química', shortName: 'Quí', order: 140 },
    { id: 'disc_espanhol', name: 'Espanhol', shortName: 'Esp', order: 150 },
    { id: 'disc_frances', name: 'Francês', shortName: 'Fra', order: 160 },
    { id: 'disc_filosofia', name: 'Filosofia', shortName: 'Fil', order: 170 },
    { id: 'disc_sociologia', name: 'Sociologia', shortName: 'Soc', order: 180 },
    { id: 'disc_projeto_vida', name: 'Projeto de Vida', shortName: 'P.V.', order: 190 },
    // Empreendedorismo EXCLUDED
    { id: 'disc_musica', name: 'Música', shortName: 'Mús', order: 210 }
];

const GRADES = [
    { id: 'grade_bercario', name: 'Berçário', segment: 'Educação Infantil' },
    { id: 'grade_nivel_1', name: 'Nível I', segment: 'Educação Infantil' },
    { id: 'grade_nivel_2', name: 'Nível II', segment: 'Educação Infantil' },
    { id: 'grade_nivel_3', name: 'Nível III', segment: 'Educação Infantil' },
    { id: 'grade_nivel_4', name: 'Nível IV', segment: 'Educação Infantil' },
    { id: 'grade_nivel_5', name: 'Nível V', segment: 'Educação Infantil' },
    { id: 'grade_1_ano', name: '1º Ano', segment: 'Fundamental I' },
    { id: 'grade_2_ano', name: '2º Ano', segment: 'Fundamental I' },
    { id: 'grade_3_ano', name: '3º Ano', segment: 'Fundamental I' },
    { id: 'grade_4_ano', name: '4º Ano', segment: 'Fundamental I' },
    { id: 'grade_5_ano', name: '5º Ano', segment: 'Fundamental I' },
    { id: 'grade_6_ano', name: '6º Ano', segment: 'Fundamental II' },
    { id: 'grade_7_ano', name: '7º Ano', segment: 'Fundamental II' },
    { id: 'grade_8_ano', name: '8º Ano', segment: 'Fundamental II' },
    { id: 'grade_9_ano', name: '9º Ano', segment: 'Fundamental II' },
    { id: 'grade_1_ser', name: '1ª Série', segment: 'Ensino Médio' },
    { id: 'grade_2_ser', name: '2ª Série', segment: 'Ensino Médio' },
    { id: 'grade_3_ser', name: '3ª Série', segment: 'Ensino Médio' }
];

const CURRICULUM_DEFAULTS = {
    'Fundamental I': {
        disc_portugues: 4, disc_matematica: 4, disc_ciencias: 2, disc_geografia: 2,
        disc_historia: 2, disc_ingles: 2, disc_artes: 2, disc_espanhol: 1,
        disc_filosofia: 1, disc_projeto_vida: 1, disc_musica: 1
    },
    'Fundamental II': {
        disc_matematica: 4, disc_portugues: 4, disc_historia: 2, disc_geografia: 2,
        disc_ciencias: 2, disc_ingles: 1, disc_espanhol: 1, disc_frances: 1,
        disc_artes: 1, disc_redacao: 1, disc_educacao_fisica: 1, disc_projeto_vida: 1
    },
    'Ensino Médio': {
        disc_portugues: 2, disc_matematica: 4, disc_fisica: 4, disc_biologia: 2,
        disc_historia: 2, disc_geografia: 2, disc_sociologia: 1, disc_filosofia: 2,
        disc_quimica: 2, disc_literatura: 2, disc_redacao: 2, disc_ingles: 1, disc_espanhol: 1
    }
};

const UNITS = ['unit_zn', 'unit_bs', 'unit_ext', 'unit_qui'];
const SHIFTS = ['shift_morning', 'shift_afternoon'];
const YEAR = '2025';

async function seed() {
    console.log("--- SEEDING ACADEMIC DATA ---");

    // 1. Seed Subjects
    console.log("Seeding academic_subjects...");
    const subjectBatch = writeBatch(db);
    SUBJECTS_TO_SEED.forEach(s => {
        const ref = doc(db, "academic_subjects", s.id);
        subjectBatch.set(ref, { ...s, isActive: true });
    });
    await subjectBatch.commit();

    // 2. Seed Grades
    console.log("Seeding academic_grades...");
    const gradeBatch = writeBatch(db);
    GRADES.forEach((g, i) => {
        const ref = doc(db, "academic_grades", g.id);
        gradeBatch.set(ref, { ...g, isActive: true, order: (i + 1) * 10 });
    });
    await gradeBatch.commit();

    // 3. Seed Matrices for all Units/Shifts
    console.log("Seeding academic_matrices...");
    let matrixCount = 0;
    for (const unit of UNITS) {
        for (const shift of SHIFTS) {
            const matrixBatch = writeBatch(db);
            let batchSize = 0;

            for (const grade of GRADES) {
                const defaults = CURRICULUM_DEFAULTS[grade.segment];
                if (!defaults) continue;

                const matrixId = `matrix_${unit}_${grade.id}_${shift}_${YEAR}`;
                const subjectsArr = Object.entries(defaults).map(([id, hours]) => ({
                    id,
                    weeklyHours: hours,
                    order: SUBJECTS_TO_SEED.find(s => s.id === id)?.order || 999
                }));

                const matrixData = {
                    id: matrixId,
                    unit,
                    gradeId: grade.id,
                    shift,
                    academicYear: YEAR,
                    subjects: subjectsArr
                };

                matrixBatch.set(doc(db, "academic_matrices", matrixId), matrixData);
                batchSize++;
                matrixCount++;
            }
            if (batchSize > 0) await matrixBatch.commit();
        }
        console.log(`  Finished unit: ${unit}`);
    }

    console.log(`--- SEED COMPLETED: ${SUBJECTS_TO_SEED.length} subjects, ${GRADES.length} grades, ${matrixCount} matrices ---`);
}

seed().catch(console.error);
