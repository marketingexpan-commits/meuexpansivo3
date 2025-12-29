const functions = require('firebase-functions');
const admin = require('firebase-admin');

// -------------------------------------------------------------
// CONFIGURAÇÃO ZENVIA (Substitua pelo seu Token Oficial)
// -------------------------------------------------------------
const ZENVIA_API_TOKEN = 'SEU_TOKEN_ZENVIA_AQUI'; // <--- INSIRA SEU TOKEN
const ZENVIA_SENDER_ID = 'Expansivo'; // O nome que aparecerá (se suportado) ou use um número fixo

// Helper para enviar SMS via Zenvia API (v2)
async function sendZenviaSMS(phoneNumber, messageText) {
    if (!ZENVIA_API_TOKEN || ZENVIA_API_TOKEN === 'SEU_TOKEN_ZENVIA_AQUI') {
        console.warn("⚠️ [Zenvia] Token não configurado. SMS não enviado:", messageText);
        return false;
    }

    try {
        const url = 'https://api.zenvia.com/v2/channels/sms/messages';

        // Formatar telefone: Remover +55 se houver, garantir formato '5584999999999'
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
// FUNÇÃO AGENDADA (Executa todo dia às 08:00 da manhã)
// -------------------------------------------------------------
exports.checkAndSendSms = functions.pubsub.schedule('every day 08:00').timeZone('America/Sao_Paulo').onRun(async (context) => {
    const db = admin.firestore();
    const today = new Date();

    // Datas de Gatilho
    // 1. Lembrete Antecipado (Hoje + 3 dias)
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + 3);
    const reminderStr = reminderDate.toISOString().split('T')[0];

    // 2. Vencimento (Hoje)
    const todayStr = today.toISOString().split('T')[0];

    // 3. Atraso (Hoje - 1 dia)
    const overdueDate = new Date(today);
    overdueDate.setDate(today.getDate() - 1);
    const overdueStr = overdueDate.toISOString().split('T')[0];

    console.log(`🔎 [SMS Job] Iniciando varredura.`);
    console.log(`   - Lembrete (3 dias): ${reminderDate}`);
    console.log(`   - Vencimento (Hoje): ${todayStr}`);
    console.log(`   - Atraso (1 dia):    ${overdueStr}`);

    let totalSent = 0;

    try {
        // --- BUSCA 1: Lembrete (3 dias antes) ---
        // "Avisar que vence em breve"
        const snapReminder = await db.collection('mensalidades')
            .where('dueDate', '==', reminderStr)
            .where('status', '==', 'Pendente')
            .get();

        for (const doc of snapReminder.docs) {
            await processFee(doc, 'reminder', db);
            totalSent++;
        }

        // --- BUSCA 2: Vencimento (Hoje) ---
        // "Vence hoje!"
        const snapToday = await db.collection('mensalidades')
            .where('dueDate', '==', todayStr)
            .where('status', '==', 'Pendente')
            .get();

        for (const doc of snapToday.docs) {
            await processFee(doc, 'due_today', db);
            totalSent++;
        }

        // --- BUSCA 3: Atraso (1 dia depois) ---
        // "Venceu ontem, evite bloqueio"
        const snapOverdue = await db.collection('mensalidades')
            .where('dueDate', '==', overdueStr)
            .where('status', '==', 'Pendente')
            .get();

        for (const doc of snapOverdue.docs) {
            await processFee(doc, 'overdue', db);
            totalSent++;
        }

        console.log(`🏁 [SMS Job] Finalizado. Total de mensagens processadas: ${totalSent}`);
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
        // (Otimização: idealmente o telefone estaria na mensalidade, mas vamos buscar para garantir)
        const studentSnap = await db.collection('students').doc(fee.studentId).get();
        if (!studentSnap.exists) return;

        const student = studentSnap.data();

        // Prioridade de Telefone: Financeiro > Pessoal > Contato
        const rawPhone = student.telefone_responsavel || student.contactPhone || student.phone || student.telefone;

        if (!rawPhone || rawPhone.length < 10) {
            console.warn(`⚠️ Aluno ${student.name} sem telefone válido para SMS.`);
            return;
        }

        const monthName = fee.month || 'Mês Atual';
        const valueFormatted = fee.value ? `R$ ${fee.value.toFixed(2).replace('.', ',')}` : 'Valor Pendente';
        const link = "meuexpansivo.vercel.app";

        let message = "";

        if (type === 'reminder') {
            message = `Expansivo: Ola! A mensalidade de ${monthName} vence em 3 dias. Valor: ${valueFormatted}. Acesse: ${link}`;
        } else if (type === 'due_today') {
            message = `Expansivo: A mensalidade de ${monthName} vence HOJE! Evite juros. Valor: ${valueFormatted}. Pague em: ${link}`;
        } else if (type === 'overdue') {
            message = `Expansivo: A mensalidade de ${monthName} venceu ontem. Regularize agora p/ evitar bloqueio. Acesse: ${link}`;
        }

        if (message) {
            await sendZenviaSMS(rawPhone, message);
        }

    } catch (err) {
        console.error(`Erro processando mensalidade ${doc.id}:`, err);
    }
}
