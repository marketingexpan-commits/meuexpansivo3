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

async function migrateLocalizacaoToZona() {
    console.log('🔄 Iniciando migração: Localização → Zona (localizacao_tipo)...\n');

    try {
        // Buscar todos os alunos
        const studentsRef = collection(db, "students");
        const studentsSnapshot = await getDocs(studentsRef);

        if (studentsSnapshot.empty) {
            console.log('❌ Nenhum aluno encontrado no banco.');
            return;
        }

        console.log(`📊 Total de alunos encontrados no Firestore: ${studentsSnapshot.size}\n`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let batch = writeBatch(db);
        let batchCount = 0;
        const BATCH_SIZE = 450; // Firestore limit is 500

        for (const studentDoc of studentsSnapshot.docs) {
            const studentData = studentDoc.data();
            const studentId = studentDoc.id;

            // Verificar se tem o campo "localizacao" (antigo) e NÃO tem "localizacao_tipo" (novo)
            // Ou se queremos forçar a atualização se o novo estiver vazio/diferente
            if (studentData.localizacao && !studentData.localizacao_tipo) {
                // Normalizar o valor (pode vir como "Urbana", "urbana", "URBANA", etc.)
                const localizacaoValue = String(studentData.localizacao).trim();
                let zonaValue = null;

                if (localizacaoValue.toLowerCase() === 'urbana') {
                    zonaValue = 'Urbana';
                } else if (localizacaoValue.toLowerCase() === 'rural') {
                    zonaValue = 'Rural';
                } else {
                    console.log(`⚠️  Aluno ${studentData.name || studentId}: valor desconhecido "${localizacaoValue}" - pulando`);
                    skippedCount++;
                    continue;
                }

                // Adicionar ao batch
                batch.update(studentDoc.ref, {
                    localizacao_tipo: zonaValue
                });

                batchCount++;
                updatedCount++;

                console.log(`✅ ${updatedCount}. ${studentData.name || studentId}: "${localizacaoValue}" → "${zonaValue}"`);

                // Executar batch a cada BATCH_SIZE documentos
                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`\n💾 Batch de ${batchCount} documentos salvo.\n`);
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            } else if (studentData.localizacao_tipo) {
                // Já tem o campo novo, pular
                skippedCount++;
            } else {
                // Não tem nem o campo antigo nem o novo
                skippedCount++;
            }
        }

        // Executar batch final se houver documentos pendentes
        if (batchCount > 0) {
            await batch.commit();
            console.log(`\n💾 Batch final de ${batchCount} documentos salvo.\n`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ MIGRAÇÃO CONCLUÍDA!');
        console.log('='.repeat(60));
        console.log(`📊 Estatísticas:`);
        console.log(`   - Total de alunos: ${studentsSnapshot.size}`);
        console.log(`   - Atualizados: ${updatedCount}`);
        console.log(`   - Pulados: ${skippedCount}`);
        console.log(`   - Erros: ${errorCount}`);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
        throw error;
    }
}

// Executar migração
migrateLocalizacaoToZona()
    .then(() => {
        console.log('🎉 Script finalizado com sucesso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });
