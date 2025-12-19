import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

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

const HS_SUBJECTS_PDF = [
    "Português", "Matemática", "Inglês", "História", "Geografia",
    "Literatura", "Biologia", "Física", "Química", "Redação",
    "Espanhol", "Ens. Artes", "Filosofia", "Sociologia",
    "Ed. Física", "Projeto de Vida", "Empreendedorismo"
];

const studentsData = [
    { code: "433", name: "ALICIA FIGUEREDO RODRIGUES", media: 7.8 },
    { code: "535", name: "ALLINE HEVYLLIN DO CARMO SENA", media: 8.5 },
    { code: "544", name: "ANA CAROLINA VARELA", media: 8.6 },
    { code: "479", name: "ANA JÚLIA BARBOSA TEIXEIRA", media: 8.1 },
    { code: "435", name: "ANDERSON GUILHERME SILVA DO CARMO", media: 8.5 },
    { code: "364", name: "ANGELA WENDY LUIZ DOS ANJOS", media: 8.5 },
    { code: "409", name: "AYSLANNE ANGELO DAMASCENA", media: 8.8 },
    { code: "365", name: "BARBARA CORDEIRO ALVES COSTA", media: 8.5 },
    { code: "450", name: "CAUA VICTOR DA SILVA OLIVEIRA", media: 8.9 },
    { code: "510", name: "CLARA KETILLYN JESUS BEZERRA", media: 8.1 },
    { code: "430", name: "DANIEL CRISTIAN SOARES DO VALE", media: 8.3 },
    { code: "505", name: "DAVI LUCAS DOS SANTOS FARIAS", media: 9.2 },
    { code: "504", name: "DYLAN EMANUEL VIEIRA SANTOS", media: 8.7 },
    { code: "452", name: "EMILLY LETICIA FRANÇA DA SILVA", media: 8.6 },
    { code: "489", name: "GABRIELLY RODRIGUES SOARES", media: 8.1 },
    { code: "74", name: "GRAZIELLY QAMAR TEIXEIRA FARIAS", media: 8.2 },
    { code: "244", name: "INGRID VITORIA LOPES DA SILVA", media: 7.8 },
    { code: "487", name: "ISAAC GABRIEL DA SILVA SABINO", media: 8.8 },
    { code: "475", name: "JAMILLY NASCIMENTO DE LIMA", media: 8.3 },
    { code: "415", name: "JENNYFER MIKAELLE SILVA LUCAS TEIXEIRA", media: 8.6 },
    { code: "497", name: "JOSE LEANDRO NETO", media: 8.3 },
    { code: "190", name: "JOSE VICTOR FRANCA DA SILVEIRA", media: 7.1 },
    { code: "472", name: "LARISSA BEATRIZ PINHEIRO ANDRADE", media: 8.6 },
    { code: "494", name: "LAURA BEATRIZ SILVA DE AZEVEDO", media: 7.7 },
    { code: "532", name: "LETICIA FREIRE SERRANO", media: 8.6 },
    { code: "531", name: "LIVIA FREIRE SERRANO", media: 8.2 },
    { code: "391", name: "LUIZ HENRIQUE PEREIRA DA SILVA", media: 8.0 },
    { code: "413", name: "MAGNUS GABRIEL VALENÇA DE SIQUEIRA", media: 8.2 },
    { code: "525", name: "MARIA CLARA DE SOUSA DANTAS", media: 7.6 },
    { code: "111", name: "MARIA GABRIELA CANDIDO DA SILVA", media: 8.3 },
    { code: "370", name: "MARIA JULIA CUSTODIO", media: 8.6 },
    { code: "462", name: "MARIA JULIA REBOUÇAS CAMARA", media: 7.7 },
    { code: "419", name: "MARIA LUIZA ALVES BEZERRA", media: 8.8 },
    { code: "86", name: "MARIA STEFANNY MARQUES DE ARAÚJO", media: 7.4 },
    { code: "503", name: "MYRELLA SOFIA MATIAS DO NASCIMENTO COSTA", media: 9.0 },
    { code: "509", name: "PENELOPE EMILIA CRUZ SILVA", media: 8.9 },
    { code: "326", name: "RAISSA EUFRASIO SILVA DANTAS DE LIMA", media: 8.3 },
    { code: "438", name: "REBECA HELENA DE SOUZA FERREIRA", media: 7.8 },
    { code: "457", name: "RENATO GUEDES DE AZEVEDO", media: 8.5 },
    { code: "534", name: "RUAN CARLOS DA SILVA COSTA", media: 7.6 },
    { code: "473", name: "SAMUEL BARROS DA SILVA", media: 8.5 },
    { code: "146", name: "VITOR GABRIEL SANTOS DA COSTA", media: 8.1 },
    { code: "372", name: "YASMIN BENICE LIMA DA SILVA", media: 8.7 },
    { code: "75", name: "ALAN VICTOR ALBINO SANTANA CARVALHO", media: 8.5 }
];

async function ingestGrades() {
    console.log(`Starting ingestion of ${studentsData.length} students...`);
    const now = new Date().toISOString();

    for (const data of studentsData) {
        const studentId = `student_${data.code}`;
        console.log(`Processing ${data.name} (${studentId})...`);

        // First, clear any existing grades for this student in 2025 to avoid duplicates/debris
        const existingGrades = await db.collection('grades')
            .where('studentId', '==', studentId)
            .where('year', '==', 2025)
            .get();

        const batch = db.batch();
        existingGrades.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Now add the correct 2025 grades
        const ingestionBatch = db.batch();
        for (const subject of HS_SUBJECTS_PDF) {
            const gradeId = `${studentId}_${subject.replace(/\s+/g, '_')}_2025`;
            const gradeRef = db.collection('grades').doc(gradeId);

            ingestionBatch.set(gradeRef, {
                id: gradeId,
                studentId,
                subject,
                year: 2025,
                bimesters: {
                    bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                    bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                    bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                    bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 }
                },
                mediaAnual: data.media,
                mediaFinal: data.media,
                situacaoFinal: "Aprovado", // Forced as per instruction
                lastUpdated: now
            });
        }
        await ingestionBatch.commit();
        console.log(`  [OK] ${data.name} done.`);
    }

    console.log("Ingestion completed successfully!");
    process.exit(0);
}

ingestGrades().catch(err => {
    console.error("Critical Error during ingestion:", err);
    process.exit(1);
});
