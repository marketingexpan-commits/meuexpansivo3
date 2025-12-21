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

async function deleteQuintas() {
    console.log("Searching for 'Quintas' students to delete...");

    // Batch size limit is 500, but we'll do simple iteration or chunks
    const snapshot = await db.collection('students').where('unit', '==', 'Quintas').get();

    if (snapshot.empty) {
        console.log("No students found for unit 'Quintas'.");
        return;
    }

    console.log(`Found ${snapshot.size} students in unit 'Quintas'. Deleting...`);

    let deletedCount = 0;
    const batchSize = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        // Delete student
        batch.delete(doc.ref);
        deletedCount++;
        batchCount++;

        // Delete associated grades
        // Note: This is an async query inside loop, which is slow. 
        // Better: Collect IDs, then delete grades? Or just let them be orphaned if not critical?
        // Prompt says "remove permanently...". Cleanest is to remove grades too.
        // We will try to find grades.
        const gradesSnap = await db.collection('grades').where('studentId', '==', doc.id).get();
        gradesSnap.forEach(gDoc => {
            batch.delete(gDoc.ref);
            batchCount++;
        });

        if (batchCount >= batchSize) {
            await batch.commit();
            console.log(`   Committed batch... (Total students deleted so far: ${deletedCount})`);
            batch = db.batch(); // Reset
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`Operation Complete. Removed ${deletedCount} students from Quintas.`);
}

deleteQuintas().catch(e => {
    console.error(e);
    process.exit(1);
}).then(() => process.exit(0));
