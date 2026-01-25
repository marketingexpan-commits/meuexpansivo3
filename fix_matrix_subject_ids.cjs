const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, writeBatch, doc } = require("firebase/firestore");

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

// STATIC ID -> LABEL MAPPING (From codebase)
// We use this to know that 'sub_math' means 'Matemática'
const STATIC_SUBJECT_MAP = {
    'sub_portuguese': 'Português',
    'sub_math': 'Matemática',
    'sub_history': 'História',
    'sub_geography': 'Geografia',
    'sub_science': 'Ciências',
    'sub_english': 'Inglês',
    'sub_arts': 'Artes', // could be 'Ens. Artes'
    'sub_physical_ed': 'Ed. Física',
    'sub_religious_ed': 'Ensino Religioso',
    'sub_writing': 'Redação',
    'sub_literature': 'Literatura',
    'sub_biology': 'Biologia',
    'sub_physics': 'Física',
    'sub_chemistry': 'Química',
    'sub_spanish': 'Espanhol',
    'sub_philosophy': 'Filosofia',
    'sub_sociology': 'Sociologia',
    'sub_life_project': 'Projeto de Vida',
    'sub_entrepreneurship': 'Empreendedorismo',
    'sub_music': 'Música',
    'sub_french': 'Francês'
};

async function fixMatrixSubjects() {
    console.log("--- SYNCING MATRIX SUBJECT IDs WITH REAL DYNAMIC IDs ---");

    // 1. Fetch REAL Subjects (The ones with random IDs like 'W9ws...')
    console.log("1. Fetching dictionary of real subjects...");
    const subjectsSnap = await getDocs(collection(db, "academic_subjects"));
    const realSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`- Found ${realSubjects.length} subjects in DB.`);

    // 2. Fetch Matrices
    console.log("2. Fetching matrices...");
    const matricesSnap = await getDocs(collection(db, "academic_matrices"));
    const matrices = matricesSnap.docs;
    console.log(`- Found ${matrices.length} matrices.`);

    const batch = writeBatch(db);
    let updatesCount = 0;

    for (const mDoc of matrices) {
        const matrix = mDoc.data();
        let changed = false;

        const newSubjects = matrix.subjects.map(sub => {
            // Check if current ID is one of our static ones (starts with sub_)
            // OR if strictly we just want to match by name to be safe

            // Try to find a Real Subject with the SAME NAME
            // Normalize names: Trim, Lowercase
            const targetName = (STATIC_SUBJECT_MAP[sub.id] || sub.name || '').trim().toLowerCase();

            // Fuzzy match name
            const match = realSubjects.find(rs => {
                const rsName = (rs.name || rs.label || '').trim().toLowerCase();
                // Direct match
                if (rsName === targetName) return true;
                // 'Ens. Artes' vs 'Artes'
                if (targetName === 'artes' && rsName === 'ens. artes') return true;
                if (targetName === 'ens. artes' && rsName === 'artes') return true;
                return false;
            });

            if (match && match.id !== sub.id) {
                console.log(`   [${matrix.id}] Swapping '${sub.name}' ID: ${sub.id} -> ${match.id}`);
                changed = true;
                return { ...sub, id: match.id, name: match.name }; // Update ID and ensure name matches exact DB name
            } else if (!match) {
                console.log(`   [${matrix.id}] WARNING: No match found for '${sub.name}' (${sub.id}). Keeping original.`);
            }

            return sub;
        });

        if (changed) {
            batch.update(mDoc.ref, { subjects: newSubjects });
            updatesCount++;
        }
    }

    if (updatesCount > 0) {
        await batch.commit();
        console.log(`--- FINISHED: Updated ${updatesCount} matrices with real IDs ---`);
    } else {
        console.log("--- FINISHED: No updates needed. ---");
    }
}

fixMatrixSubjects().catch(console.error);
