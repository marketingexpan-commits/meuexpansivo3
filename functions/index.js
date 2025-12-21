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
    // 1. Verificação de Segurança (Opcional mas recomendado)
    // Verificar se o request vem realmente do Abacate Pay via assinatura ou token no header.
    // const signature = req.headers['abacate-signature'];

    try {
        const event = req.body;

        console.log("Recebido Webhook Abacate:", event);

        // 2. Lógica de Processamento
        // O payload do Abacate Pay contém o status e os metadados do pagamento.

        const { status, metadata, customerId, products } = event.data || event;

        if (status === 'PAID') {
            // Pagamento Confirmado!

            // Exemplo: products[0].externalId contém nosso ID de referência (ex: "mensalidades_studentId")
            const externalId = products && products[0] ? products[0].externalId : null;

            if (externalId && externalId.startsWith('mensalidades_')) {
                const studentId = externalId.split('_')[1];

                // Buscar mensalidades pendentes deste aluno e marcar como pagas
                // OBS: A lógica exata depende se o valor cobre tudo ou se é uma mensalidade específica.
                // Aqui, vamos assumir que ele pagou o que foi gerado.

                const snapshot = await db.collection('mensalidades')
                    .where('studentId', '==', studentId)
                    .where('status', '==', 'Pendente')
                    .get();

                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.docs.forEach(doc => {
                        batch.update(doc.ref, {
                            status: 'Pago',
                            lastUpdated: new Date().toISOString()
                        });
                    });
                    await batch.commit();
                    console.log(`Mensalidades atualizadas para o aluno ${studentId}`);
                }
            }
        }

        res.status(200).send({ received: true });

    } catch (error) {
        console.error("Erro no Webhook:", error);
        res.status(500).send("Internal Server Error");
    }
});
