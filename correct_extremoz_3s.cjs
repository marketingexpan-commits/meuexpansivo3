const firebase = require("firebase/compat/app");
require("firebase/compat/firestore");

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

// List of IDs to correct (3S)
const TARGET_CODES = [
    '1515', '1113', '1524', '1901', '482', '1772', '745', '1750', '1791', '993',
    '1079', '1131', '1365', '1763', '1897', '1887', '961', '1753', '1060', '1787',
    '1773', '34', '698', '1754', '1000', '989', '1166', '1790', '1904', '1903',
    '2108', '1759', '1976', '1774', '265', '1559', '1146', '1760'
];

async function correctStudents() {
    console.log(`Starting surgical correction for ${TARGET_CODES.length} students (3rd Grade)...`);

    for (const code of TARGET_CODES) {
        try {
            const snapshot = await db.collection('students').where('code', '==', code).get();

            if (snapshot.empty) {
                console.log(`[MISSING] Student ${code} NOT FOUND in DB.`);
                continue;
            }

            let targetDoc = null;
            let docsToDelete = [];

            if (snapshot.size > 1) {
                console.log(`[DUPLICATE] Found ${snapshot.size} docs for code ${code}. Cleaning up...`);
                const standardId = `student_${code}`;
                const standardDoc = snapshot.docs.find(d => d.id === standardId);

                if (standardDoc) {
                    targetDoc = standardDoc;
                    docsToDelete = snapshot.docs.filter(d => d.id !== standardId);
                } else {
                    targetDoc = snapshot.docs[0];
                    docsToDelete = snapshot.docs.slice(1);
                }
            } else {
                targetDoc = snapshot.docs[0];
            }

            // Perform Update
            // Force 3S, Extremoz, Matutino, Turma A
            await targetDoc.ref.update({
                gradeLevel: '3ª Série - Ens. Médio',
                gradeLevelSigla: '3S',
                unit: 'Extremoz',
                shift: 'Matutino',
                schoolClass: 'A'
            });
            console.log(`[UPDATED] ${code} (${targetDoc.id}) -> 3S/Extremoz/Mat/A`);

            // Perform Deletion of Duplicates
            if (docsToDelete.length > 0) {
                const batch = db.batch();
                for (const doc of docsToDelete) {
                    batch.delete(doc.ref);
                    console.log(`   -> Deleting duplicate doc: ${doc.id}`);
                }
                await batch.commit();
                console.log(`   -> Deleted ${docsToDelete.length} duplicates.`);
            }

        } catch (e) {
            console.error(`[ERROR] Processing ${code}:`, e);
        }
    }
    console.log("Correction finished.");
}

correctStudents().catch(e => {
    console.error(e);
    process.exit(1);
}).then(() => process.exit(0));
