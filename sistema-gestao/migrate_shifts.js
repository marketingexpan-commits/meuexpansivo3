
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

async function migrateShifts() {
    console.log("Starting Migration: Standardizing Shift Values...");

    try {
        const snapshot = await getDocs(collection(db, "students"));
        const students = [];

        snapshot.forEach((doc) => {
            students.push({ id: doc.id, ...doc.data() });
        });

        console.log(`Loaded ${students.length} students. Finding candidates for update...`);

        const updates = [];
        students.forEach(student => {
            const currentShift = student.shift;
            if (MAPPING[currentShift]) {
                updates.push({
                    id: student.id,
                    oldShift: currentShift,
                    newShift: MAPPING[currentShift],
                    name: student.name
                });
            }
        });

        if (updates.length === 0) {
            console.log("No legacy shifts found. Database is already standardized!");
            return;
        }

        console.log(`Found ${updates.length} students to migrate.`);

        // Batch updates (Limit 500 per batch)
        const BATCH_SIZE = 400; // Safe margin
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
                batch.update(docRef, { shift: item.newShift });
            });

            await batch.commit();
            totalUpdated += chunk.length;
            console.log(`Batch ${i + 1}/${chunks.length} committed. (${chunk.length} updates)`);
        }

        console.log("--------------------------------------------------");
        console.log(`MIGRATION COMPLETE. Total records updated: ${totalUpdated}`);
        console.log("--------------------------------------------------");

    } catch (error) {
        console.error("Migration Failed:", error);
    }
}

migrateShifts();
