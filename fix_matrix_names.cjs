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

async function fixMatrixNames() {
    console.log("--- FIXING MATRIX SUBJECT NAMES ---\n");

    // 1. Get all subjects to build ID -> Name map
    const subjectsSnap = await getDocs(collection(db, "academic_subjects"));
    const subjectMap = {};

    subjectsSnap.docs.forEach(d => {
        const data = d.data();
        subjectMap[d.id] = data.name;
    });

    console.log(`Loaded ${Object.keys(subjectMap).length} subjects\n`);

    // 2. Fix all matrices
    const matricesSnap = await getDocs(collection(db, "academic_matrices"));
    const batch = writeBatch(db);
    let updateCount = 0;

    for (const doc of matricesSnap.docs) {
        const matrix = doc.data();
        let needsUpdate = false;

        const updatedSubjects = matrix.subjects.map(sub => {
            if (!sub.name || sub.name === 'undefined') {
                const correctName = subjectMap[sub.id];
                if (correctName) {
                    console.log(`Fixing: ${sub.id} -> ${correctName}`);
                    needsUpdate = true;
                    return { ...sub, name: correctName };
                }
            }
            return sub;
        });

        if (needsUpdate) {
            batch.update(doc.ref, { subjects: updatedSubjects });
            updateCount++;
        }
    }

    if (updateCount > 0) {
        await batch.commit();
        console.log(`\n✅ FIXED: Updated ${updateCount} matrices with correct subject names.`);
    } else {
        console.log("\n✅ All matrices already have correct names.");
    }
}

fixMatrixNames().catch(console.error);
