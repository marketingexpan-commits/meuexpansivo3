const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');

// -------------------------------------------------------------
// CONFIGURAÇÃO ZENVIA (Lê do .env)
// -------------------------------------------------------------
const ZENVIA_API_TOKEN = process.env.ZENVIA_API_TOKEN;
const ZENVIA_SENDER_ID = 'marketing.expan'; // FIXO conforme suporte

// Helper para enviar SMS via Zenvia API (v2)
async function sendZenviaSMS(phoneNumber, messageText) {
    if (!ZENVIA_API_TOKEN || ZENVIA_API_TOKEN.includes('COLOQUE_AQUI')) {
        console.warn("⚠️ [Zenvia Simulation] Token não configurado ou inválido.", messageText);
        return false;
    }

    // Debug Log
    console.log("Using Zenvia Token:", ZENVIA_API_TOKEN ? "YES (Hidden)" : "NO");

    return new Promise((resolve, reject) => {
        // Formatar telefone: Remover não- dígitos. Se não começar com 55, adicionar.
        let cleanPhone = phoneNumber.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }

        const data = JSON.stringify({
            from: ZENVIA_SENDER_ID,
            to: cleanPhone,
            contents: [{ type: 'text', text: messageText }]
        });

        const options = {
            hostname: 'api.zenvia.com',
            path: '/v2/channels/sms/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-TOKEN': ZENVIA_API_TOKEN,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                try {
                    const responseJson = JSON.parse(responseBody);
                    console.log(`✅ [Zenvia] Status: ${res.statusCode} | ID: ${responseJson.id}`);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(responseJson.id); // Retornar o ID
                    } else {
                        console.error(`❌ [Zenvia] Erro ${res.statusCode}:`, responseBody);
                        resolve(false);
                    }
                } catch (e) {
                    console.log(`✅ [Zenvia] Status: ${res.statusCode} | Body: ${responseBody}`);
                    resolve(res.statusCode === 200);
                }
            });
        });

        req.on('error', (error) => {
            console.error("❌ [Zenvia] Network Error:", error);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

// -------------------------------------------------------------
// FUNÇÃO AGENDADA (Executa todo dia às 08:00)
// -------------------------------------------------------------
exports.checkAndSendSms = functions.pubsub.schedule('every day 08:00').timeZone('America/Sao_Paulo').onRun(async (context) => {
    const db = admin.firestore();
    const today = new Date();

    // Datas de Gatilho
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + 3);
    const reminderStr = reminderDate.toISOString().split('T')[0];

    const todayStr = today.toISOString().split('T')[0];

    const overdueDate = new Date(today);
    overdueDate.setDate(today.getDate() - 1);
    const overdueStr = overdueDate.toISOString().split('T')[0];

    console.log(`🔎 [SMS Job] Iniciando varredura para: Reminder=${reminderStr}, Today=${todayStr}, Overdue=${overdueStr}`);

    let totalSent = 0;

    try {
        // 1. Lembrete (3 dias antes)
        const snapReminder = await db.collection('mensalidades')
            .where('dueDate', '==', reminderStr)
            .where('status', '==', 'Pendente')
            .get();

        for (const doc of snapReminder.docs) {
            await processFee(doc, 'reminder', db);
            totalSent++;
        }

        // 2. Vencimento (Hoje)
        const snapToday = await db.collection('mensalidades')
            .where('dueDate', '==', todayStr)
            .where('status', '==', 'Pendente')
            .get();

        for (const doc of snapToday.docs) {
            await processFee(doc, 'due_today', db);
            totalSent++;
        }

        // 3. Atraso (1 dia depois)
        const snapOverdue = await db.collection('mensalidades')
            .where('dueDate', '==', overdueStr)
            .where('status', '==', 'Pendente')
            .get();

        for (const doc of snapOverdue.docs) {
            await processFee(doc, 'overdue', db);
            totalSent++;
        }

        console.log(`✅ [SMS Job] Finalizado. Total de tentativas: ${totalSent}`);
        return null;
    } catch (error) {
        console.error("❌ Erro fatal no Job de SMS:", error);
        return null;
    }
});

// Lógica de Processamento Individual
// Helper para remover acentuação
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Lógica de Processamento Individual
async function processFee(doc, type, db) {
    const fee = doc.data();
    if (!fee.studentId) return;

    try {
        // Buscar dados do aluno para pegar o telefone
        const studentSnap = await db.collection('students').doc(fee.studentId).get();
        if (!studentSnap.exists) return;

        const student = studentSnap.data();

        // Prioridade de Telefone: Novo Standard 'phoneNumber' > Legado
        const rawPhone = student.phoneNumber || student.contactPhone || student.telefone_responsavel || student.phone || student.telefone;

        if (!rawPhone || rawPhone.length < 10) {
            console.log(`⚠️ Aluno ${student.name} sem telefone válido.`);
            return;
        }

        const monthName = removeAccents(fee.month || 'Mes Atual');
        const link = "https://meuexpansivo.app";

        let message = "";

        // TEMPLATES ATUALIZADOS (Sem acento, < 160 chars, marketing.expan)
        if (type === 'reminder') {
            message = `EXPANSIVO: Ola. A mensalidade de ${monthName} vence em 3 dias. Evite juros. Acesse: ${link}`;
        } else if (type === 'due_today') {
            message = `EXPANSIVO: A mensalidade de ${monthName} vence HOJE. Evite multa pagando agora em: ${link}`;
        } else if (type === 'overdue') {
            message = `EXPANSIVO: A mensalidade de ${monthName} venceu ontem. Regularize agora para evitar bloqueio: ${link}`;
        }

        if (message) {
            // Garantir limite de 160 chars (apenas segurança, templates já são curtos)
            if (message.length > 160) {
                message = message.substring(0, 157) + "...";
            }
            await sendZenviaSMS(rawPhone, message);
        }

    } catch (err) {
        console.error(`Erro processando mensalidade ${doc.id}:`, err);
    }
}

exports.sendZenviaSMS = sendZenviaSMS;
