const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, writeBatch, query, where } = require("firebase/firestore");

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

async function fixSwap() {
    console.log("--- REVERSING INCORRECT SUBJECT SWAP ---");

    // The issue: We swapped W9ws... (which was MATH) to disc_portugues
    // And ZDLHk... (which was PORTUGUESE) to disc_matematica
    // We need to REVERSE this

    const batch = writeBatch(db);
    let fixCount = 0;

    // Find all grades with disc_portugues and check if they should be math
    const gradesSnap = await getDocs(collection(db, "grades"));

    console.log("Checking all grades for incorrect swaps...\n");

    for (const doc of gradesSnap.docs) {
        const grade = doc.data();

        // If it's disc_portugues but has math-related content, swap to disc_matematica
        // If it's disc_matematica but has portuguese content, swap to disc_portugues

        // For now, let's just reverse the specific student's grades
        if (grade.studentId === 'ivHS6pIaX0HTyp7HU4TR') {
            console.log(`Student Thiago Luis - Grade: ${grade.subject}`);

            // REVERSE THE SWAP
            if (grade.subject === 'disc_portugues') {
                // This was originally W9ws... which was MATH
                console.log(`  ❌ WRONG: disc_portugues should be disc_matematica`);
                batch.update(doc.ref, { subject: 'disc_matematica' });
                fixCount++;
            } else if (grade.subject === 'disc_matematica') {
                // This was originally ZDLHk... which was PORTUGUESE  
                console.log(`  ❌ WRONG: disc_matematica should be disc_portugues`);
                batch.update(doc.ref, { subject: 'disc_portugues' });
                fixCount++;
            }
        }
    }

    if (fixCount > 0) {
        await batch.commit();
        console.log(`\n✅ FIXED: Reversed ${fixCount} incorrect swaps.`);
    } else {
        console.log("\n✅ No swaps needed.");
    }
}

fixSwap().catch(console.error);
