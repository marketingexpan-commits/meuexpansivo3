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

// List of IDs to correct
const TARGET_CODES = [
    '1769', '2057', '1664', '1246', '2080', '2094', '2058', '241',
    '1274', '2085', '1494', '2047', '2023', '83', '1922', '1200',
    '2059', '2063', '2075', '626', '2064', '2014', '579', '401',
    '1535', '1240', '1573', '1948', '2025', '1681', '1350', '1102'
];

async function correctStudents() {
    console.log(`Starting surgical correction for ${TARGET_CODES.length} students...`);

    for (const code of TARGET_CODES) {
        try {
            // Find valid student documents with this code
            const snapshot = await db.collection('students').where('code', '==', code).get();

            if (snapshot.empty) {
                console.log(`[MISSING] Student ${code} NOT FOUND in DB.`);
                continue;
            }

            let targetDoc = null;
            let docsToDelete = [];

            // If duplicates, prioritize the one with correct grade if exists, or just the first one
            if (snapshot.size > 1) {
                console.log(`[DUPLICATE] Found ${snapshot.size} docs for code ${code}. Cleaning up...`);
                // Heuristic: Keep the one already updated, or the last updated one? 
                // Let's keep the one that matches our target schema closest or just the first one.
                // We'll update the chosen one anyway.

                // Sort by ID or creation? Firestore IDs are random-ish.
                // Let's pick the one with ID `student_${code}` if it exists, as that's our standard.
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
            // Force 1S, Extremoz, Matutino
            await targetDoc.ref.update({
                gradeLevel: '1ª Série - Ens. Médio',
                gradeLevelSigla: '1S',
                unit: 'Extremoz',
                shift: 'Matutino'
            });
            console.log(`[UPDATED] ${code} (${targetDoc.id}) -> 1S/Extremoz/Matutino`);

            // Perform Deletion of Duplicates
            if (docsToDelete.length > 0) {
                const batch = db.batch();
                for (const doc of docsToDelete) {
                    batch.delete(doc.ref);
                    // Also try to delete grades associated with the deleted student ID?
                    // Previous script used studentId for grades. If ID is different, grades are orphaned.
                    // We can try to delete them if we want to be thorough.
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
