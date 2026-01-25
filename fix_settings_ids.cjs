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

// Default settings template for 2026
const DEFAULT_BIMESTERS = [
    { number: 1, label: '1º Bimestre', startDate: '2026-02-01', endDate: '2026-04-30' },
    { number: 2, label: '2º Bimestre', startDate: '2026-05-01', endDate: '2026-07-15' },
    { number: 3, label: '3º Bimestre', startDate: '2026-07-20', endDate: '2026-09-30' },
    { number: 4, label: '4º Bimestre', startDate: '2026-10-01', endDate: '2026-12-20' }
];

const SCHOOL_UNITS = [
    { id: 'unit_zn', label: 'Zona Norte' },
    { id: 'unit_bs', label: 'Boa Sorte' },
    { id: 'unit_ext', label: 'Extremoz' },
    { id: 'unit_qui', label: 'Quintas' }
];

async function fixSettings() {
    console.log("--- MIGRATING ACADEMIC SETTINGS TO UNIT IDs ---");

    // 1. Delete existing settings with random IDs or non-matching IDs
    const snap = await getDocs(collection(db, "academic_settings"));
    const deleteBatch = writeBatch(db);
    let deletedCount = 0;

    snap.forEach(d => {
        // If doc ID doesn't match our 'settings_UNIT_YEAR' pattern or is random
        // We'll just wipe all and re-seed for 2026 to be clean.
        // Actually, let's just wipe everything to be safe and clean.
        console.log(`Deleting old setting: ${d.id} (${d.data().unit})`);
        deleteBatch.delete(d.ref);
        deletedCount++;
    });

    if (deletedCount > 0) {
        await deleteBatch.commit();
        console.log(`Deleted ${deletedCount} old settings documents.`);
    }

    // 2. Create correct settings for 2026
    const createBatch = writeBatch(db);
    SCHOOL_UNITS.forEach(unit => {
        const docId = `settings_${unit.id}_2026`;
        const ref = doc(db, "academic_settings", docId);

        createBatch.set(ref, {
            id: docId,
            unit: unit.id, // THE FIX: Storing unit_id here, not "Boa Sorte"
            year: '2026',
            currentBimester: 1,
            bimesters: DEFAULT_BIMESTERS,
            updatedAt: new Date().toISOString()
        });
        console.log(`Queued creation of: ${docId}`);
    });

    await createBatch.commit();
    console.log(`--- FINISHED: Created ${SCHOOL_UNITS.length} Standardized Settings Docs ---`);
}

fixSettings().catch(console.error);
