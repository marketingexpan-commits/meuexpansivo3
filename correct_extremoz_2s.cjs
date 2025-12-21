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

// List of IDs to correct (2S)
const TARGET_CODES = [
    '1424', '193', '991', '197', '689', '952', '1029', '1324', '654', '533',
    '1928', '1938', '1919', '2035', '1073', '1427', '1549', '1998', '1160',
    '1621', '2003', '1896', '1942', '451', '120', '1562', '1927', '1883',
    '1944', '1848'
];

async function correctStudents() {
    console.log(`Starting surgical correction for ${TARGET_CODES.length} students (2nd Grade)...`);

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
                // Preference: 'student_{code}'
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
            // Force 2S, Extremoz, Matutino, Turma 03
            await targetDoc.ref.update({
                gradeLevel: '2ª Série - Ens. Médio',
                gradeLevelSigla: '2S',
                unit: 'Extremoz',
                shift: 'Matutino',
                schoolClass: '03' // Using '03' as requested for Turma
            });
            console.log(`[UPDATED] ${code} (${targetDoc.id}) -> 2S/Extremoz/Mat/03`);

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
