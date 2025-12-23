const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');

admin.initializeApp();
const db = admin.firestore();

// --------------------------------------------------------
// MERCADO PAGO CONFIGURATION
// --------------------------------------------------------
const MP_ACCESS_TOKEN = 'APP_USR-4544114605136589-122217-b74f4f0e9bb11f6ea971a59ec2e6d690-3074894410';
const MP_PUBLIC_KEY = 'APP_USR-e0a54aff-c482-451f-882c-e41a50bcde7d';

const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

const cors = require('cors')({ origin: true });

// --------------------------------------------------------
// 1. CREATE PREFERENCE (Para gerar o pagamento)
// --------------------------------------------------------
exports.createMercadoPagoPreference = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { title, quantity, price, studentId, mensalidadeIds, eventIds } = req.body;

            const preference = new Preference(client);

            const result = await preference.create({
                body: {
                    items: [
                        {
                            title: title,
                            quantity: Number(quantity),
                            unit_price: Number(price),
                            currency_id: 'BRL',
                        }
                    ],
                    external_reference: mensalidadeIds ? mensalidadeIds.toString() : `student_${studentId}`,
                    metadata: {
                        student_id: studentId,
                        mensalidade_ids: mensalidadeIds || '',
                        event_ids: eventIds || ''
                    },
                    back_urls: {
                        success: "https://meuexpansivo.vercel.app",
                        failure: "https://meuexpansivo.vercel.app",
                        pending: "https://meuexpansivo.vercel.app"
                    },
                    auto_return: "approved",
                }
            });

            res.json({ id: result.id, init_point: result.init_point });

        } catch (error) {
            console.error("Erro ao criar preferência:", error);
            res.status(500).json({ error: error.message });
        }
    });
});

// --------------------------------------------------------
// 2. WEBHOOK MERCADO PAGO
// --------------------------------------------------------
exports.mercadopagoWebhook = functions.https.onRequest(async (req, res) => {
    try {
        const { type, data } = req.body;
        console.log("🔔 Webhook Mercado Pago recebido:", type, data?.id);

        if (type === 'payment') {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: data.id });

            const status = paymentInfo.status;
            const externalRef = paymentInfo.external_reference;
            const metadata = paymentInfo.metadata;

            console.log(`💰 Pagamento ${data.id} - Status: ${status} - Ref: ${externalRef}`);

            if (status === 'approved') {
                // Lógica de Baixa no Firestore
                if (externalRef && externalRef.includes('student_') === false) {
                    const feeIds = externalRef.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    for (const feeId of feeIds) {
                        try {
                            await db.collection('mensalidades').doc(feeId).update({
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                paymentMethod: 'MercadoPago',
                                lastUpdated: new Date().toISOString(),
                                receiptUrl: `https://www.mercadopago.com.br/activities/1`
                            });
                        } catch (err) {
                            console.error(`Erro ao atualizar mensalidade ${feeId}:`, err);
                        }
                    }
                }
                else if (metadata && metadata.mensalidade_ids) {
                    const feeIds = metadata.mensalidade_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    for (const feeId of feeIds) {
                        await db.collection('mensalidades').doc(feeId).update({
                            status: 'Pago',
                            paymentDate: new Date().toISOString(),
                            paymentMethod: 'MercadoPago_Metadata',
                            lastUpdated: new Date().toISOString()
                        });
                    }
                }
            }
        }

        res.status(200).send("OK");

    } catch (error) {
        console.error("Erro no Webhook MP:", error);
        res.status(500).send("Internal Server Error");
    }
});

// --------------------------------------------------------
// 3. PROCESS PAYMENT (Recebe dados do Brick e cria pagamento)
// --------------------------------------------------------
exports.processMercadoPagoPayment = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const paymentData = req.body;
            console.log("💳 Processando pagamento:", paymentData.payment_method_id);

            const payment = new Payment(client);

            const requestOptions = {
                idempotencyKey: req.headers['x-idempotency-key'] || undefined
            };

            const result = await payment.create({
                body: paymentData,
                requestOptions
            });

            console.log("✅ Pagamento criado:", result.id, result.status);

            // --- INSTANT UPDATE LOGIC (Same as Webhook) ---
            if (result.status === 'approved') {
                const externalRef = result.external_reference;
                const metadata = result.metadata;

                if (externalRef && externalRef.includes('student_') === false) {
                    const feeIds = externalRef.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    for (const feeId of feeIds) {
                        try {
                            await db.collection('mensalidades').doc(feeId).update({
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                paymentMethod: 'MercadoPago_Instant',
                                lastUpdated: new Date().toISOString(),
                                receiptUrl: `https://www.mercadopago.com.br/activities/${result.id}`
                            });
                            console.log(`✅ [Instant] Mensalidade ${feeId} baixada.`);
                        } catch (err) {
                            console.error(`❌ [Instant] Erro ao atualizar mensalidade ${feeId}:`, err);
                        }
                    }
                }
            }
            // -----------------------------------------------

            res.status(200).json(result);

        } catch (error) {
            console.error("❌ Erro ao processar pagamento:", error);
            res.status(500).json({
                error: error.message,
                details: error.cause || error
            });
        }
    });
});

// --------------------------------------------------------
// 4. VERIFY PAYMENT STATUS (Endpoint para verificação manual)
// --------------------------------------------------------
exports.verifyPaymentStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { paymentId } = req.body;
            if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });

            console.log("🔍 Verificando status do pagamento:", paymentId);

            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });

            const status = paymentInfo.status;
            const externalRef = paymentInfo.external_reference;
            const metadata = paymentInfo.metadata;

            console.log(`📊 Status atual no MP: ${status}`);

            if (status === 'approved') {
                // Lógica de Baixa (Re-used)
                if (externalRef && externalRef.includes('student_') === false) {
                    const feeIds = externalRef.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    for (const feeId of feeIds) {
                        try {
                            await db.collection('mensalidades').doc(feeId).update({
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                paymentMethod: 'MercadoPago_ManualVerify',
                                lastUpdated: new Date().toISOString(),
                                receiptUrl: `https://www.mercadopago.com.br/activities/${paymentId}`
                            });
                            console.log(`✅ [Verify] Mensalidade ${feeId} baixada.`);
                        } catch (err) {
                            console.error(`❌ [Verify] Erro ao atualizar mensalidade ${feeId}:`, err);
                        }
                    }
                }
            }

            res.status(200).json({
                status: status,
                id: paymentId,
                updated: status === 'approved'
            });

        } catch (error) {
            console.error("❌ Erro ao verificar pagamento:", error);
            res.status(500).json({ error: error.message });
        }
    });
});
