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

const shiftMap = {
    'Matutino': 'shift_morning',
    'Vespertino': 'shift_afternoon',
    'Manhã': 'shift_morning',
    'Tarde': 'shift_afternoon',
    'shift_morning': 'shift_morning',
    'shift_afternoon': 'shift_afternoon'
};

async function syncRootFields() {
    console.log("--- SYNCING ROOT FIELDS FROM HISTORY ---");
    const snap = await getDocs(collection(db, "students"));
    let batch = writeBatch(db);
    let count = 0;
    let updates = 0;

    for (const d of snap.docs) {
        const s = d.data();
        const history = s.enrollmentHistory || [];
        // Find 2025 entry
        const entry2025 = history.find(h => h.year === '2025');

        if (entry2025) {
            const updateData = {};
            let needsUpdate = false;

            // 1. Sync Grade
            if (s.gradeLevel !== entry2025.gradeLevel) {
                updateData.gradeLevel = entry2025.gradeLevel;
                needsUpdate = true;
            }

            // 2. Sync Class
            if (s.schoolClass !== entry2025.schoolClass) {
                updateData.schoolClass = entry2025.schoolClass;
                needsUpdate = true;
            }

            // 3. Sync & Normalize Shift
            const rawShift = entry2025.shift;
            const normalizedShift = shiftMap[rawShift] || rawShift;

            if (s.shift !== normalizedShift) {
                updateData.shift = normalizedShift;
                needsUpdate = true;
            }

            // 4. Sync Unit (Unit IDs seem consistent unit_zn etc from reconstitute)
            if (s.unit !== entry2025.unit) {
                updateData.unit = entry2025.unit;
                needsUpdate = true;
            }

            // Also check root shift if it is Matutino/Vespertino and normalize it even if matches history label
            // Because history might have "Matutino" but we want "shift_morning" on root
            if (s.shift && shiftMap[s.shift] && s.shift !== shiftMap[s.shift]) {
                updateData.shift = shiftMap[s.shift];
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(d.ref, updateData);
                count++;
                updates++;
            }
        }

        if (count >= 400) {
            await batch.commit();
            console.log(`Synced ${updates} students...`);
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) await batch.commit();
    console.log(`--- FINISHED: ${updates} students synced ---`);
}

syncRootFields().catch(console.error);
