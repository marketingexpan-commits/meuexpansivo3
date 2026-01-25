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

const GHOST_MAP = {
    "ZDLHk7z94IX8dS3ysBVW": "disc_portugues",
    "W9wsEMSR2kOtKZmT3nCt": "disc_matematica",
    "W9wsEMSR22kOtKZmT3nCt": "disc_matematica"
};

async function cleanup() {
    console.log("--- STARTING COMPREHENSIVE GHOST ID CLEANUP ---");
    const collectionsToClean = [
        "calendar_events",
        "attendance",
        "grade_entries",
        "grades",
        "teachers",
        "daily_agendas",
        "exam_guides",
        "class_materials",
        "tickets_pedagogicos",
        "app_notifications"
    ];
    let totalUpdated = 0;

    for (const colName of collectionsToClean) {
        console.log(`Scanning ${colName}...`);
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        let batchCount = 0;

        snap.forEach(d => {
            const data = d.data();
            let changed = false;
            let newData = { ...data };

            // 1. Handle single string fields: 'discipline', 'subject'
            const stringFields = ['discipline', 'subject'];
            stringFields.forEach(field => {
                if (data[field] && GHOST_MAP[data[field]]) {
                    newData[field] = GHOST_MAP[data[field]];
                    changed = true;
                }
            });

            // 2. Handle simple arrays: 'targetSubjectIds'
            if (data.targetSubjectIds && Array.isArray(data.targetSubjectIds)) {
                const updatedIds = data.targetSubjectIds.map(id => GHOST_MAP[id] || id);
                if (JSON.stringify(updatedIds) !== JSON.stringify(data.targetSubjectIds)) {
                    newData.targetSubjectIds = updatedIds;
                    changed = true;
                }
            }

            // 3. Handle teacher specific 'subjects' array
            if (colName === 'teachers' && data.subjects && Array.isArray(data.subjects)) {
                const updatedSubjects = data.subjects.map(id => GHOST_MAP[id] || id);
                if (JSON.stringify(updatedSubjects) !== JSON.stringify(data.subjects)) {
                    newData.subjects = updatedSubjects;
                    changed = true;
                }
            }

            // 4. Handle assignments in teacher profiles (nested arrays)
            if (colName === 'teachers' && data.assignments && Array.isArray(data.assignments)) {
                const updatedAssignments = data.assignments.map(as => {
                    if (as.subjects && Array.isArray(as.subjects)) {
                        const subUp = as.subjects.map(id => GHOST_MAP[id] || id);
                        if (JSON.stringify(subUp) !== JSON.stringify(as.subjects)) {
                            return { ...as, subjects: subUp };
                        }
                    }
                    return as;
                });
                if (JSON.stringify(updatedAssignments) !== JSON.stringify(data.assignments)) {
                    newData.assignments = updatedAssignments;
                    changed = true;
                }
            }

            if (changed) {
                batch.update(d.ref, newData);
                batchCount++;
                totalUpdated++;
                console.log(`  [MATCH] Updated ${colName} doc ${d.id}`);
            }
        });

        if (batchCount > 0) {
            await batch.commit();
            console.log(`  Committed ${batchCount} updates to ${colName}.`);
        } else {
            console.log(`  No matches found in ${colName}.`);
        }
    }

    console.log(`\n--- FINISHED: Total records sanitized: ${totalUpdated} ---`);
}

cleanup().catch(console.error);
