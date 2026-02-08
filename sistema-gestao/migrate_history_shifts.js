
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAe5Rb4dqi8OcyUXj69EFr4AGElCI9Rb9o",
    authDomain: "meu-expansivo-app.firebaseapp.com",
    databaseURL: "https://meu-expansivo-app-default-rtdb.firebaseio.com",
    projectId: "meu-expansivo-app",
    storageBucket: "meu-expansivo-app.firebasestorage.app",
    messagingSenderId: "688981571362",
    appId: "1:688981571362:web:179c1dcae4b01f9f9f177b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MAPPING = {
    'Matutino': 'shift_morning',
    'Vespertino': 'shift_afternoon',
    'Noite': 'shift_night',
    'Integral': 'shift_full'
};

async function migrateHistoryShifts() {
    console.log("Starting History Migration: Standardizing Enrollment History Shifts...");

    try {
        const snapshot = await getDocs(collection(db, "students"));
        const students = [];

        snapshot.forEach((doc) => {
            students.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Loaded ${students.length} students. Finding candidates for history update...`);

        const updates = [];
        students.forEach(student => {
            if (!student.enrollmentHistory || !Array.isArray(student.enrollmentHistory)) return;

            let hasChanges = false;
            const newHistory = student.enrollmentHistory.map(h => {
                const currentShift = h.shift;
                if (MAPPING[currentShift]) {
                    hasChanges = true;
                    return { ...h, shift: MAPPING[currentShift] };
                }
                return h;
            });

            if (hasChanges) {
                updates.push({
                    id: student.id,
                    enrollmentHistory: newHistory
                });
            }
        });

        if (updates.length === 0) {
            console.log("No legacy history shifts found. Database is already standardized!");
            return;
        }

        console.log(`Found ${updates.length} students with legacy history to migrate.`);

        // Batch updates (Limit 500 per batch)
        const BATCH_SIZE = 300; // Safe margin for array writes
        const chunks = [];

        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            chunks.push(updates.slice(i, i + BATCH_SIZE));
        }

        console.log(`Processing in ${chunks.length} batches...`);

        let totalUpdated = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const batch = writeBatch(db);

            chunk.forEach(item => {
                const docRef = doc(db, "students", item.id);
                batch.update(docRef, { enrollmentHistory: item.enrollmentHistory });
            });

            await batch.commit();
            totalUpdated += chunk.length;
            console.log(`Batch ${i + 1}/${chunks.length} committed. (${chunk.length} students updated)`);
        }

        console.log("--------------------------------------------------");
        console.log(`HISTORY MIGRATION COMPLETE. Total student records updated: ${totalUpdated}`);
        console.log("--------------------------------------------------");

    } catch (error) {
        console.error("History Migration Failed:", error);
    }
}

migrateHistoryShifts();
