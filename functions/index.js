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
console.log('Mercado Pago Access Token presente:', !!MP_ACCESS_TOKEN);

const cors = require('cors')({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
});

// --------------------------------------------------------
// 1. CREATE PREFERENCE (Para gerar o pagamento)
// --------------------------------------------------------
exports.createMercadoPagoPreference = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { title, quantity, price, studentId, mensalidadeIds, eventIds, payment_methods } = req.body;

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
                    payer: req.body.payer, // Include Payer in Preference
                    payment_methods: payment_methods, // Pass payment restrictions
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
                            const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                            const documentNumber = Math.floor(100000 + Math.random() * 900000).toString();

                            await db.collection('mensalidades').doc(feeId).update({
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                paymentMethod: paymentInfo.payment_method_id || 'MercadoPago',
                                lastUpdated: new Date().toISOString(),
                                receiptUrl: `https://www.mercadopago.com.br/activities/${data.id}`,
                                receiptId: receiptId,
                                documentNumber: documentNumber
                            });
                        } catch (err) {
                            console.error(`Erro ao atualizar mensalidade ${feeId}:`, err);
                        }
                    }
                }
                else if (metadata && metadata.mensalidade_ids) {
                    const feeIds = metadata.mensalidade_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    for (const feeId of feeIds) {
                        const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                        const documentNumber = Math.floor(100000 + Math.random() * 900000).toString();

                        await db.collection('mensalidades').doc(feeId).update({
                            status: 'Pago',
                            paymentDate: new Date().toISOString(),
                            paymentMethod: paymentInfo.payment_method_id || 'MercadoPago',
                            lastUpdated: new Date().toISOString(),
                            receiptId: receiptId,
                            documentNumber: documentNumber
                        });
                    }
                }

                // NOVO: Baixa em Eventos/Extras
                if (metadata && metadata.event_ids) {
                    const eventIds = metadata.event_ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
                    for (const eventId of eventIds) {
                        const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                        const documentNumber = Math.floor(100000 + Math.random() * 900000).toString();

                        await db.collection('eventos_escola').doc(eventId).update({
                            status: 'Pago',
                            paymentDate: new Date().toISOString(),
                            paymentMethod: paymentInfo.payment_method_id || 'MercadoPago',
                            lastUpdated: new Date().toISOString(),
                            receiptId: receiptId,
                            documentNumber: documentNumber
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

            // Ensure Payload is standardized to Snake Case (API Requirement)
            const cleanPaymentData = {
                ...paymentData,
                payer: {
                    email: paymentData.payer.email,
                    first_name: paymentData.payer.first_name || paymentData.payer.firstName,
                    last_name: paymentData.payer.last_name || paymentData.payer.lastName,
                    identification: paymentData.payer.identification,
                    address: paymentData.payer.address
                        ? {
                            zip_code: paymentData.payer.address.zip_code || paymentData.payer.address.zipCode,
                            federal_unit: paymentData.payer.address.federal_unit || paymentData.payer.address.federalUnit,
                            street_name: paymentData.payer.address.street_name || paymentData.payer.address.streetName,
                            street_number: paymentData.payer.address.street_number || paymentData.payer.address.streetNumber,
                            neighborhood: paymentData.payer.address.neighborhood,
                            city: paymentData.payer.address.city
                        }
                        : undefined
                }
            };

            const result = await payment.create({
                body: cleanPaymentData,
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
                            const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                            const documentNumber = Math.floor(100000 + Math.random() * 900000).toString();

                            await db.collection('mensalidades').doc(feeId).update({
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                paymentMethod: result.payment_method_id || 'MercadoPago_Instant',
                                lastUpdated: new Date().toISOString(),
                                receiptUrl: `https://www.mercadopago.com.br/activities/${result.id}`,
                                receiptId: receiptId,
                                documentNumber: documentNumber
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
// 3. GENERATE BOLETO (Gerar Boleto Específico)
// --------------------------------------------------------
exports.generateBoleto = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { studentId, amount, dueDate, description, payer } = req.body;

            console.log(`🎫 Gerando boleto para aluno ${studentId} - Valor bruto: ${amount}`);

            const parseCurrency = (val) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                const clean = String(val).replace(/[^\d,.]/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                } else if (clean.includes(',')) {
                    return parseFloat(clean.replace(',', '.'));
                }
                return parseFloat(clean) || 0;
            };

            const cleanAmount = parseCurrency(amount);

            // Ensure 2 decimal places and valid number
            const finalAmount = Math.round((cleanAmount + Number.EPSILON) * 100) / 100;

            if (isNaN(finalAmount) || finalAmount < 5.0) {
                console.error("❌ Valor inválido detectado:", amount, "->", finalAmount);
                return res.status(400).json({ error: `Valor inválido ou abaixo do mínimo (R$ 5,00): ${amount}` });
            }

            // Ensure expiration is in the future (Mercado Pago requirement)
            let finalDueDate = dueDate;
            const now = new Date();
            const expirationDate = new Date(dueDate);
            if (expirationDate <= now) {
                // If past or today, set to 3 days from now
                const newExp = new Date();
                newExp.setDate(now.getDate() + 3);
                finalDueDate = newExp.toISOString();
                console.log(`⚠️ Data de vencimento corrigida de ${dueDate} para ${finalDueDate} (estava no passado)`);
            }

            const payment = new Payment(client);

            const paymentData = {
                transaction_amount: finalAmount,
                description: description,
                payment_method_id: 'bolbradesco',
                payer: {
                    email: payer.email,
                    first_name: (payer.firstName || 'Responsável').substring(0, 40),
                    last_name: (payer.lastName || studentId).substring(0, 40),
                    identification: {
                        type: 'CPF',
                        number: (payer.cpf || '00000000000').replace(/\D/g, '')
                    },
                    address: {
                        zip_code: (payer.address.zipCode || '59000000').replace(/\D/g, ''),
                        street_name: (payer.address.streetName || 'Endereço não informado').substring(0, 60),
                        street_number: (payer.address.streetNumber || 'S/N').substring(0, 10),
                        neighborhood: (payer.address.neighborhood || 'Bairro').substring(0, 60),
                        city: (payer.address.city || 'Natal').substring(0, 60),
                        federal_unit: (payer.address.state || 'RN').substring(0, 2)
                    }
                },
                date_of_expiration: finalDueDate,
                external_reference: `boleto_${studentId}_${Date.now()}`
            };

            console.log("🚀 Payload Final p/ Mercado Pago:", JSON.stringify(paymentData, null, 2));

            const result = await payment.create({ body: paymentData });

            console.log(`✅ Boleto gerado: ${result.id}`);

            const barcode = result.barcode ? result.barcode.content : (result.transaction_details ? result.transaction_details.barcode.content : null);
            const digitableLine = result.transaction_details ? result.transaction_details.digitable_line : null;
            const ticketUrl = result.transaction_details ? result.transaction_details.external_resource_url : null;
            const qrCode = result.point_of_interaction?.transaction_data?.qr_code || null;
            const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64 || null;

            res.json({
                id: result.id,
                status: result.status,
                barcode: barcode,
                digitableLine: digitableLine,
                ticketUrl: ticketUrl,
                qrCode: qrCode,
                qrCodeBase64: qrCodeBase64
            });

        } catch (error) {
            console.error("❌ Erro ao gerar boleto:", error);
            // Extrair mensagem de erro detalhada do Mercado Pago se disponível
            let errorMessage = error.message;
            if (error.cause && error.cause.length > 0) {
                errorMessage = error.cause.map(c => `${c.code}: ${c.description}`).join(' | ');
            } else if (error.errors && error.errors.length > 0) {
                errorMessage = error.errors.map(e => e.message).join(' | ');
            }

            res.status(500).json({
                error: errorMessage,
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
                            const receiptId = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                            const documentNumber = Math.floor(100000 + Math.random() * 900000).toString();

                            await db.collection('mensalidades').doc(feeId).update({
                                status: 'Pago',
                                paymentDate: new Date().toISOString(),
                                paymentMethod: paymentInfo.payment_method_id || 'MercadoPago_Manual',
                                lastUpdated: new Date().toISOString(),
                                receiptUrl: `https://www.mercadopago.com.br/activities/${paymentId}`,
                                receiptId: receiptId,
                                documentNumber: documentNumber
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
                payment_method_id: paymentInfo.payment_method_id, // Return method ID for frontend
                updated: status === 'approved'
            });

        } catch (error) {
            console.error("❌ Erro ao verificar pagamento:", error);
            res.status(500).json({ error: error.message });
        }
    });
});




// --------------------------------------------------------
// 5. SMS SCHEDULER (Automação de Cobrança)
// --------------------------------------------------------
exports.smsScheduler = require('./smsScheduler').checkAndSendSms;

// --------------------------------------------------------
// 6. TEST BATCH SEND (Manual Trigger)
// --------------------------------------------------------
exports.sendTestBatch = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const { codes } = req.body; // Expects { codes: ['11111', '54321', ...] }
            if (!codes || !Array.isArray(codes)) {
                // If no codes provided, default to the list requested by user
                const defaultCodes = ['11111', '54321', '77777', '1256', '00000', '88888', '33333'];
                console.log("⚠️ No codes provided, using default list:", defaultCodes);
                return await processBatch(defaultCodes, res);
            }
            await processBatch(codes, res);

        } catch (error) {
            console.error("❌ Erro no Batch Test:", error);
            res.status(500).json({ error: error.message });
        }
    });
});

async function processBatch(codes, res) {
    const { sendZenviaSMS } = require('./smsScheduler');
    const db = admin.firestore();
    let sentCount = 0;
    const results = [];

    console.log(`🚀 Iniciando envio em lote para códigos: ${codes.join(', ')}`);

    for (const code of codes) {
        // Find student by code
        const snapshot = await db.collection('students').where('code', '==', String(code)).get();

        if (snapshot.empty) {
            console.warn(`⚠️ Aluno com código ${code} não encontrado.`);
            results.push({ code, status: 'Not Found' });
            continue;
        }

        // Could be multiple if duplicates exist, but assume first
        const student = snapshot.docs[0].data();
        const phoneNumber = student.phoneNumber || student.contactPhone || student.telefone_responsavel || student.phone || student.telefone;

        if (!phoneNumber) {
            console.warn(`⚠️ Aluno ${student.name} (${code}) sem telefone.`);
            results.push({ code, name: student.name, status: 'No Phone' });
            continue;
        }

        const message = 'Teste de integração sms Meu Expansivo concluído com sucesso!';
        const success = await sendZenviaSMS(phoneNumber, message);

        if (success) {
            console.log(`✅ SMS enviado para ${student.name} (${code}) - ${phoneNumber}`);
            sentCount++;
            results.push({ code, name: student.name, phone: phoneNumber, status: 'Sent' });
        } else {
            console.error(`❌ Falha ao enviar para ${student.name} (${code})`);
            results.push({ code, name: student.name, status: 'Failed' });
        }
    }

    res.json({ success: true, sent: sentCount, details: results });
}

// --------------------------------------------------------
// ASAAS E-BOOKS INTEGRATION
// --------------------------------------------------------

async function getOrCreateAsaasCustomer(apiKey, baseUrl, student) {
    const email = student.email || `${student.id}@meuexpansivo.com.br`;
    const name = student.name || 'Estudante Sem Nome';
    const cpfCnpj = student.cpf || '00000000000';

    // 1. Search for existing customer
    const searchUrl = `${baseUrl}/customers?email=${encodeURIComponent(email)}`;
    const searchRes = await fetch(searchUrl, {
        method: 'GET',
        headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
        }
    });

    if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
            return searchData.data[0].id;
        }
    }

    // 2. Create customer if not found
    const createUrl = `${baseUrl}/customers`;
    const customerPayload = {
        name: name,
        email: email,
        externalReference: student.id
    };
    
    const cleanCpf = cpfCnpj.replace(/\D/g, '');
    if (cleanCpf && cleanCpf.length === 11) {
        customerPayload.cpfCnpj = cleanCpf;
    }

    const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerPayload)
    });

    if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("Erro ao criar cliente no Asaas:", errText);
        throw new Error(`Falha ao criar cliente no Asaas: ${errText}`);
    }

    const newCustomer = await createRes.json();
    return newCustomer.id;
}

exports.criarCobrancaPixEbook = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { studentId, bookId, bookTitle, price, studentName, studentGrade } = req.body;

            if (!studentId || !bookId || !price) {
                return res.status(400).json({ error: "Parâmetros obrigatórios ausentes (studentId, bookId, price)" });
            }

            // 1. Fetch Asaas API Configuration from Firestore
            const configDoc = await db.collection('config').doc('asaas_config').get();
            if (!configDoc.exists) {
                return res.status(400).json({ error: "Asaas não configurado no painel administrativo." });
            }

            const { apiKey, environment } = configDoc.data();
            if (!apiKey) {
                return res.status(400).json({ error: "Chave de API do Asaas não configurada." });
            }

            const baseUrl = environment === 'production' 
                ? 'https://api.asaas.com/v3' 
                : 'https://sandbox.asaas.com/v3';

            // 2. Fetch student details from Firestore
            const studentDoc = await db.collection('students').doc(studentId).get();
            const studentData = studentDoc.exists ? studentDoc.data() : {};
            const studentInfo = {
                id: studentId,
                name: studentName || studentData.name || 'Aluno',
                email: studentData.email || studentData.contactEmail || `${studentId}@meuexpansivo.com.br`,
                cpf: studentData.cpf || studentData.responsavelCpf || ''
            };

            // 3. Get or Create Customer ID in Asaas
            const asaasCustomerId = await getOrCreateAsaasCustomer(apiKey, baseUrl, studentInfo);

            // 4. Create Payment Charge
            const paymentPayload = {
                customer: asaasCustomerId,
                billingType: 'PIX',
                value: Number(price),
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                description: `Compra do e-Livro: ${bookTitle}`,
                externalReference: `${studentId}_${bookId}`
            };

            console.log("Criando cobrança PIX no Asaas para cliente:", asaasCustomerId);
            const createPaymentRes = await fetch(`${baseUrl}/payments`, {
                method: 'POST',
                headers: {
                    'access_token': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentPayload)
            });

            if (!createPaymentRes.ok) {
                const errText = await createPaymentRes.text();
                console.error("Erro ao criar cobrança no Asaas:", errText);
                return res.status(500).json({ error: `Erro do Asaas: ${errText}` });
            }

            const paymentData = await createPaymentRes.json();
            const paymentId = paymentData.id;

            // 5. Get PIX QR Code & Copy-Paste Key from Asaas
            console.log("Buscando QRCode PIX para pagamento:", paymentId);
            const qrCodeRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
                method: 'GET',
                headers: {
                    'access_token': apiKey
                }
            });

            if (!qrCodeRes.ok) {
                const errText = await qrCodeRes.text();
                console.error("Erro ao buscar QRCode PIX:", errText);
                return res.status(500).json({ error: `Erro ao buscar QRCode do Asaas: ${errText}` });
            }

            const qrCodeData = await qrCodeRes.json();

            res.json({
                success: true,
                paymentId: paymentId,
                payload: qrCodeData.payload,
                encodedImage: qrCodeData.encodedImage,
                expirationDate: qrCodeData.expirationDate
            });

        } catch (error) {
            console.error("Erro no criarCobrancaPixEbook:", error);
            res.status(500).json({ error: error.message });
        }
    });
});

exports.webhookAsaasEbooks = functions.https.onRequest(async (req, res) => {
    try {
        const { event, payment } = req.body;
        console.log(`🔔 Webhook Asaas recebido. Evento: ${event}, Pagamento: ${payment?.id}`);

        if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            const externalReference = payment.externalReference;
            if (externalReference && externalReference.includes('_')) {
                const parts = externalReference.split('_');
                const studentId = parts[0];
                const rawBookId = parts[1];

                // Separa múltiplos IDs de livros caso tenham sido comprados juntos
                const bookIds = rawBookId.includes('-') ? rawBookId.split('-') : [rawBookId];

                for (const bookId of bookIds) {
                    console.log(`💰 Compra confirmada para Aluno: ${studentId}, Livro: ${bookId}`);

                    const purchaseSnapshot = await db.collection('ebook_purchases')
                        .where('studentId', '==', studentId)
                        .where('bookId', '==', bookId)
                        .get();

                    if (purchaseSnapshot.empty) {
                        const studentDoc = await db.collection('students').doc(studentId).get();
                        const studentData = studentDoc.exists ? studentDoc.data() : {};
                        const studentName = studentData.name || 'Estudante';
                        const studentGrade = studentData.grade || studentData.gradeLevel || studentData.serie || 'Série Não Informada';

                        const bookDoc = await db.collection('e_books').doc(bookId).get();
                        const bookData = bookDoc.exists ? bookDoc.data() : {};
                        const bookTitle = bookData.title || 'Livro Digital';

                        await db.collection('ebook_purchases').add({
                            studentId: studentId,
                            studentName: studentName,
                            studentGrade: studentGrade,
                            bookId: bookId,
                            bookTitle: bookTitle,
                            price: Number(bookData.price || 0),
                            paymentId: payment.id,
                            paymentMethod: 'PIX',
                            status: 'Aprovado',
                            purchasedAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        console.log(`✅ Registro de compra do e-Book ${bookId} criado com sucesso no Firestore!`);
                    } else {
                        console.log(`⚠️ Compra do aluno ${studentId} para o livro ${bookId} já havia sido registrada.`);
                    }
                }
            }
        }

        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Erro no webhookAsaasEbooks:", error);
        res.status(500).send("Internal Server Error");
    }
});
