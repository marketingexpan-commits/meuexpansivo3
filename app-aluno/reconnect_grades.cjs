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

// MAP OF ORPHAN -> ACTIVE IDs
// Based on typical ghosts found in this system
// We will also use name matching to be smart
const STATIC_MAP = {
    // We can populate this if we knew the exact ID, but we'll infer it dynamically
};

async function reconnectGrades() {
    console.log("--- RECONNECTING ORPHANED GRADES ---");

    // 1. Build Map of Active Subjects: Name (lowercased) -> ID
    console.log("1. Mapping Active Subjects...");
    const subjectsSnap = await getDocs(collection(db, "academic_subjects"));
    const subjectMap = {};
    const subjectIds = new Set();

    subjectsSnap.docs.forEach(d => {
        const data = d.data();
        const id = d.id;
        subjectIds.add(id);
        if (data.name) subjectMap[data.name.trim().toLowerCase()] = id;
        if (data.label) subjectMap[data.label.trim().toLowerCase()] = id;
    });
    console.log(`- Loaded ${subjectIds.size} active subjects.`);

    // Add known static aliases
    subjectMap['matemática'] = subjectMap['matemática'] || 'disc_matematica'; // ensure specific
    subjectMap['português'] = subjectMap['português'] || 'disc_portugues';

    // 2. Fetch All Grades
    console.log("\n2. Scanning Grades...");
    const gradesSnap = await getDocs(collection(db, "grades"));
    const batch = writeBatch(db);
    let updateCount = 0;

    // Also inspect Matrix for Math while we are at it
    const matricesSnap = await getDocs(collection(db, "academic_matrices"));
    const sampleMatrix = matricesSnap.docs[0]?.data();
    if (sampleMatrix) {
        console.log("\n[DEBUG] Matrix Sample IDs:", sampleMatrix.subjects.map(s => `${s.name}(${s.id})[${s.weeklyHours}h]`));
    }

    for (const d of gradesSnap.docs) {
        const g = d.data();

        // Check if grade subject is invalid
        if (!subjectIds.has(g.subject)) {
            // ORPHAN DETECTED
            // Try to map it

            // PROBLEM: We don't know the NAME of the orphan if it's just an ID.
            // But usually the grade table doesn't have the subject name.

            // Strategy: We can't map strictly by name if we don't have it.
            // BUT, if we have a specific known orphan from debug (W9ws...), we can hardcode it.
            // OR, if the user mentioned "Thiago Luis" has "Matemática" row failing.
            // We assume the orphan is Math if the student is missing a Math grade? No that's risky.

            // Wait, looking at the previous debug output:
            // "[MISMATCH] Grade Subject "W9wsEMSR22kOtKZmT3nCt" NOT FOUND in Matrix."
            // And the user Screenshot shows "Matemática" row with empty dashes.
            // It suggests "W9ws..." IS "Matemática".

            // SPECIFIC ID FIXES (Based on debug output)
            if (g.subject === 'W9wsEMSR2kOtKZmT3nCt' || g.subject === 'W9wsEMSR22kOtKZmT3nCt') {
                const targetId = subjectMap['matemática'] || 'disc_matematica';
                console.log(`- Fixing Orphan Math [${g.subject}] -> ${targetId} for Student ${g.studentId}`);
                batch.update(d.ref, { subject: targetId, lastUpdated: new Date().toISOString() });
                updateCount++;
            }
            if (g.subject === 'ZDLHk7z94IX8dS3ysBVW') {
                const targetId = subjectMap['português'] || 'disc_portugues';
                console.log(`- Fixing Orphan Portuguese [${g.subject}] -> ${targetId} for Student ${g.studentId}`);
                batch.update(d.ref, { subject: targetId, lastUpdated: new Date().toISOString() });
                updateCount++;
            }
            // Add other known orphans here if found
        }
    }

    if (updateCount > 0) {
        await batch.commit();
        console.log(`\n--- FIXED: Reconnected ${updateCount} orphaned grade records. ---`);
    } else {
        console.log(`\n--- NO ORPHANS FOUND (of known types). ---`);
    }
}

reconnectGrades().catch(console.error);
