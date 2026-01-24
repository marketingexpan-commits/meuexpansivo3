const { initializeApp } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs } = require("firebase/firestore");

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

async function check() {
    const studentsRef = collection(db, "students");
    const snap = await getDocs(studentsRef);

    let stats = { cursando: 0, concluido: 0, transferido: 0, desistente: 0 };

    snap.forEach(doc => {
        const s = doc.data();
        if (s.code === "1953") console.log(`SOFIA (1953): ${s.status}`);
        if (s.code === "142") console.log(`MATHEUS (142): ${s.status}`);

        if (s.status === 'CURSANDO') stats.cursando++;
        else if (s.status === 'CONCLUÍDO') stats.concluido++;
        else if (s.status === 'TRANSFERIDO') stats.transferido++;
        else if (s.status === 'DESISTENTE') stats.desistente++;
    });

    console.log("Status Stats:", stats);
}

check();
