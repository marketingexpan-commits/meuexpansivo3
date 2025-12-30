const functions = require('firebase-functions');
const admin = require('firebase-admin');

// -------------------------------------------------------------
// CONFIGURAÇÃO ZENVIA (Lê do .env)
// -------------------------------------------------------------
const ZENVIA_API_TOKEN = process.env.ZENVIA_API_TOKEN;
const ZENVIA_SENDER_ID = 'Expansivo';

// Helper para enviar SMS via Zenvia API (v2)
async function sendZenviaSMS(phoneNumber, messageText) {
    if (!ZENVIA_API_TOKEN || ZENVIA_API_TOKEN.includes('COLOQUE_AQUI')) {
        console.warn("⚠️ [Zenvia Simulation] Token não configurado ou inválido.", messageText);
        return false;
    }

    try {
        const url = 'https://api.zenvia.com/v2/channels/sms/messages';

        // Formatar telefone: Remover não- dígitos. Se não começar com 55, adicionar.
        let cleanPhone = phoneNumber.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }

        const payload = {
            from: ZENVIA_SENDER_ID,
            to: cleanPhone,
            contents: [
                {
                    type: 'text',
                    text: messageText
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-TOKEN': ZENVIA_API_TOKEN
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ [Zenvia] Erro ${response.status}:`, errText);
            return false;
        }

        const data = await response.json();
        console.log(`✅ [Zenvia] SMS enviado para ${cleanPhone}. ID:`, data.id);
        return true;

    } catch (error) {
        console.error("❌ [Zenvia] Exceção ao enviar SMS:", error);
        return false;
    }
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

        const monthName = fee.month || 'Mês Atual';
        const valueFormatted = fee.value ? `R$ ${fee.value.toFixed(2).replace('.', ',')}` : 'Valor Pendente';

        // NOVO DOMÍNIO
        const link = "https://meuexpansivo.app";

        let message = "";

        if (type === 'reminder') {
            message = `Expansivo: Ola! A mensalidade de ${monthName} vence em 3 dias. Valor: ${valueFormatted}. Acesse: ${link}`;
        } else if (type === 'due_today') {
            message = `Expansivo: A mensalidade de ${monthName} vence HOJE! Evite juros e multa pagando agora em: ${link}`;
        } else if (type === 'overdue') {
            message = `Expansivo: A mensalidade de ${monthName} venceu ontem. Evite multa e o acúmulo de juros, regularizando agora em: ${link}`;
        }

        if (message) {
            await sendZenviaSMS(rawPhone, message);
        }

    } catch (err) {
        console.error(`Erro processando mensalidade ${doc.id}:`, err);
    }
}
