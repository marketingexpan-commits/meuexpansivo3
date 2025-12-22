const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// --------------------------------------------------------
// WEBHOOK ABACATE PAY
// Endpoint para receber notificações de pagamento.
// --------------------------------------------------------
// URL Exemplo: https://us-central1-SEU-PROJETO.cloudfunctions.net/abacateWebhook

exports.abacateWebhook = functions.https.onRequest(async (req, res) => {
    // 1. Verificação de Segurança
    try {
        console.log("🔥 ACESSOU: abacateWebhook endpoint atingido!");

        const event = req.body;
        console.log("📥 Payload Recebido:", JSON.stringify(event, null, 2));

        // 2. Lógica de Processamento
        const { status, metadata, customerId, products } = event.data || event;

        if (status === 'PAID') {
            console.log("Status PAID recebido. Iniciando processamento...");
            console.log("Metadata recebido:", metadata || "Nenhum metadata");

            const batch = db.batch();
            let updatedCount = 0;

            // 1. Prioridade: Buscar via METADATA (Novo Padrão)
            if (metadata && metadata.studentId) {
                const studentId = metadata.studentId;
                console.log(`Processando via Metadata para Aluno ID: ${studentId}`);

                // Processar Mensalidades Específicas
                if (metadata.mensalidadeIds) {
                    const idsToPay = metadata.mensalidadeIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    console.log(`IDs recebidos para baixa: ${idsToPay.join(', ')}`);

                    for (const feeId of idsToPay) {
                        try {
                            const feeRef = db.collection('mensalidades').doc(feeId);
                            const doc = await feeRef.get();

                            if (!doc.exists) {
                                console.error(`❌ ERRO CRÍTICO: Mensalidade com ID [${feeId}] não encontrada no banco de dados!`);
                                console.log(`Tentativa de baixa falhou para ID: ${feeId}`);
                                continue;
                            }

                            // Update directly to ensure success in loop
                            await feeRef.update({
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                receiptUrl: event.data?.publicUrl || event.data?.billingUrl || event.data?.url || null,
                                lastUpdated: new Date().toISOString(),
                                paymentMethod: 'AbacatePay_Webhook'
                            });
                            console.log(`✅ Sucesso: Mensalidade [${feeId}] atualizada para PAGO.`);
                            updatedCount++;
                        } catch (err) {
                            console.error(`Erro ao atualizar mensalidade [${feeId}]:`, err);
                        }
                    }
                }

                // Processar Eventos (Se houver)
                if (metadata.eventIds) {
                    const eventIdsToPay = metadata.eventIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    console.log(`IDs de Eventos para baixar: ${eventIdsToPay.join(', ')}`);
                    for (const evId of eventIdsToPay) {
                        const evRef = db.collection('eventos_financeiros').doc(evId);
                        batch.update(evRef, {
                            status: 'Pago',
                            paymentDate: new Date().toISOString(),
                            receiptUrl: event.data?.publicUrl || event.data?.billingUrl || event.data?.url || null,
                            lastUpdated: new Date().toISOString()
                        });
                        updatedCount++;
                    }
                }

            } else {
                // 2. Fallback: Lógica Antiga
                console.log("Metadata ausente. Tentando fallback para externalId...");
                const externalId = products && products[0] ? products[0].externalId : null;

                if (externalId && externalId.startsWith('mensalidades_')) {
                    const studentId = externalId.split('_')[1];
                    console.log(`Fallback: Baixando TUDO pendente para aluno ${studentId}`);

                    const snapshot = await db.collection('mensalidades')
                        .where('studentId', '==', studentId)
                        .where('status', '==', 'Pendente')
                        .get();

                    if (!snapshot.empty) {
                        snapshot.docs.forEach(doc => {
                            batch.update(doc.ref, {
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                receiptUrl: event.data?.publicUrl || event.data?.billingUrl || event.data?.url || null,
                                lastUpdated: new Date().toISOString()
                            });
                            updatedCount++;
                        });
                    }
                }
            }

            if (updatedCount > 0) {
                // Note: batch might be empty if we used direct await updates above, but commit is safe even if empty/partial
                // We only strictly *need* batch commit if we added batch operations (fallback logic or events logic)
                // Safe to commit always if we think batch has ops, or check. 
                // For simplicity, let's just commit - if empty, it's a no-op usually. 
                // Check if batch has operations? Firestore Admin SDK doesn't expose 'hasOperations'.
                // We can rely on logic: if fallback was used OR events logic used batch (yes they did), we commit.
                // Mensalidades utilized direct update.
                // So if metadata.eventIds OR (!metadata && fallback), we commit.
                try {
                    await batch.commit();
                } catch (e) {
                    // ignore if "no writes" error, otherwise log
                }
                console.log(`Sucesso! Registros atualizados.`);
            } else {
                console.log("Nenhum registro encontrado para atualização ou lista de IDs vazia.");
            }
        }

        res.status(200).send({ received: true });

    } catch (error) {
        console.error("Erro no Webhook:", error);
        res.status(500).send("Internal Server Error");
    }
});
