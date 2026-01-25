const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, writeBatch } = require("firebase/firestore");

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

// Mapeamento: Nome do Segmento -> ID Correto
const SEGMENT_MAP = {
    'educação infantil': 'seg_infantil',
    'fundamental i': 'seg_fund_1',
    'fundamental ii': 'seg_fund_2',
    'ensino médio': 'seg_medio'
};

async function fixGradeSegments() {
    console.log("--- RECONNECTING GRADES TO SEGMENTS ---");

    // 1. Buscar todos os segmentos atuais
    const segmentsSnap = await getDocs(collection(db, "academic_segments"));
    const segments = {};
    segmentsSnap.docs.forEach(d => {
        const data = d.data();
        const name = (data.name || data.label || '').toLowerCase().trim();
        segments[name] = d.id;
        console.log(`Segment: "${data.name}" -> ${d.id}`);
    });

    // 2. Buscar todas as séries
    console.log("\n2. Fixing Grades...");
    const gradesSnap = await getDocs(collection(db, "academic_grades"));
    const batch = writeBatch(db);
    let updateCount = 0;

    for (const doc of gradesSnap.docs) {
        const grade = doc.data();
        const currentSegmentId = grade.segmentId;

        // Verificar se o segmentId atual existe
        const segmentExists = segmentsSnap.docs.some(d => d.id === currentSegmentId);

        if (!segmentExists) {
            // Tentar inferir o segmento correto pelo nome da série
            let newSegmentId = null;

            const gradeName = (grade.name || '').toLowerCase();

            if (gradeName.includes('berçário') || gradeName.includes('nível')) {
                newSegmentId = 'seg_infantil';
            } else if (gradeName.includes('1º ano') || gradeName.includes('2º ano') ||
                gradeName.includes('3º ano') || gradeName.includes('4º ano') ||
                gradeName.includes('5º ano')) {
                newSegmentId = 'seg_fund_1';
            } else if (gradeName.includes('6º ano') || gradeName.includes('7º ano') ||
                gradeName.includes('8º ano') || gradeName.includes('9º ano')) {
                newSegmentId = 'seg_fund_2';
            } else if (gradeName.includes('série')) {
                newSegmentId = 'seg_medio';
            }

            if (newSegmentId) {
                console.log(`- Fixing "${grade.name}": ${currentSegmentId} -> ${newSegmentId}`);
                batch.update(doc.ref, { segmentId: newSegmentId });
                updateCount++;
            } else {
                console.log(`- WARNING: Could not infer segment for "${grade.name}"`);
            }
        }
    }

    if (updateCount > 0) {
        await batch.commit();
        console.log(`\n--- FIXED: Reconnected ${updateCount} grades to segments. ---`);
    } else {
        console.log("\n--- NO ORPHANED GRADES FOUND. ---");
    }
}

fixGradeSegments().catch(console.error);
