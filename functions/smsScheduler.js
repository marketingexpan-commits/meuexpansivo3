const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

/**
 * Placeholder for the actual SMS Gateway integration.
 * Replace this with your provider's logic (Twilio, Zenvia, AWS SNS, etc.)
 */
async function sendSmsProvider(phone, message) {
    // -----------------------------------------------------------
    // ZENVIA IMPLEMENTATION TEMPLATE (Uncomment when you have the key)
    // -----------------------------------------------------------
    /*
    const ZENVIA_TOKEN = 'YOUR_ZENVIA_API_TOKEN_HERE'; // <--- PASTE KEY HERE
    const ZENVIA_URL = 'https://api.zenvia.com/v2/channels/sms/messages';

    // Format phone: Zenvia usually expects '55' + DDD + Number (e.g. 5584999999999)
    // Adding 55 if missing (simple check)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;

    const body = {
        from: 'MeuExpansivo', // Or your Sender ID
        to: cleanPhone,
        contents: [{
            type: 'text',
            text: message
        }]
    };

    try {
        const response = await fetch(ZENVIA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-TOKEN': ZENVIA_TOKEN
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('[Zenvia Error]', data);
            throw new Error('Zenvia API Error');
        }
        
        return { success: true, messageId: data.id, providerDesc: 'Zenvia' };

    } catch (err) {
        console.error('Provider Error:', err);
        return { success: false, error: err.message };
    }
    */

    // -----------------------------------------------------------
    // SIMULATION MODE (Current Default)
    // -----------------------------------------------------------
    console.log(`[SIMULATION] Sending SMS to ${phone}: ${message}`);
    return { success: true, messageId: `mock_${Date.now()}` };
}

/**
 * Validates a Brazilian phone number format (basic check)
 */
function isValidPhone(phone) {
    if (!phone) return false;
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
}

/**
 * Returns the "start of day" and "end of day" for comparison, in UTC-3
 * But simplified here to just formatting dates for string comparison YYYY-MM-DD
 */
function getFormatDate(date) {
    // Adjust to Sao Paulo Timezone for "Day" calculation
    // Using basic ISO string manipulation or offsets if simpler libraries aren't available
    // Here we trust the server time or use explicit offset
    const spOffset = -3 * 60; // -3 hours in minutes
    const spDate = new Date(date.getTime() + spOffset * 60 * 1000);
    return spDate.toISOString().split('T')[0];
}

// ------------------------------------------------------------------
// CORE LOGIC
// ------------------------------------------------------------------

/**
 * Scheduled Function: Runs daily at 08:00 Sao Paulo time
 */
exports.checkAndSendSms = functions.pubsub.schedule('0 8 * * *')
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        const db = admin.firestore();
        const now = new Date();
        const todayStr = getFormatDate(now);

        console.log(`[SMS-CRON] Starting Check for ${todayStr}`);

        // 1. Fetch Students eligible for 'Sistema Interno'
        const studentsSnap = await db.collection('students')
            .where('metodo_pagamento', '==', 'Interno')
            .get();

        if (studentsSnap.empty) {
            console.log('[SMS-CRON] No students with Sistema Interno found.');
            return null;
        }

        console.log(`[SMS-CRON] Found ${studentsSnap.size} eligible students.`);

        const batchPromises = [];

        // 2. Iterate over students to check fees
        for (const doc of studentsSnap.docs) {
            const student = doc.data();
            const studentId = student.id;

            // Safety Check: Double verify payment method
            if (student.metodo_pagamento !== 'Interno') continue;
            if (student.metodo_pagamento === 'Parceiro Isaac') continue; // Redundant safety

            // Check Opt-in (default true)
            if (student.sms_opt_in === false) {
                console.log(`[SMS-CRON] Student ${student.name} opted out.`);
                continue;
            }

            // Phone Validation
            const responsiblePhone = student.telefone_responsavel || student.telefone_contato;
            if (!isValidPhone(responsiblePhone)) {
                console.log(`[SMS-CRON] Invalid phone for student ${student.name}`);
                continue;
            }

            // 3. Fetch 'Pendente' or 'Atrasado' fees for this student
            // Optimization: In a huge DB, we might query fees directly by date, but querying per student is safer for matching
            const feesSnap = await db.collection('mensalidades')
                .where('studentId', '==', studentId)
                .where('status', 'in', ['Pendente', 'Atrasado'])
                .get();

            if (feesSnap.empty) continue;

            for (const feeDoc of feesSnap.docs) {
                const fee = feeDoc.data();
                const feeId = fee.id;

                // CRITICAL: Double check status is NOT 'Pago' inside the loop (though query filtered)
                if (fee.status === 'Pago') continue;

                // Calculate Dates
                // Assuming fee.dueDate is YYYY-MM-DD
                const dueDateStr = fee.dueDate;
                // We need to compare specific dates only (ignore time)
                // Parse dueDateStr
                const dueDate = new Date(dueDateStr + 'T12:00:00-03:00'); // Midday to be safe
                const currentDate = new Date(); // now

                // Calculate Difference in Days (ignoring time)
                // Normalize both to midnight UTC
                const msPerDay = 1000 * 60 * 60 * 24;

                const d1 = new Date(dueDateStr);
                const d2 = new Date(todayStr); // today
                const diffTime = d2.getTime() - d1.getTime();
                const diffDays = Math.round(diffTime / msPerDay);

                // diffDays = 0 => Today is Due Date
                // diffDays = -3 => 3 Days before
                // diffDays = 1 => 1 Day after

                let smsType = null;
                let messageBody = null;
                const monthName = new Date(dueDateStr).toLocaleString('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' });
                const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                // RULE 1: SMS 1 (3 days before)
                if (diffDays === -3) {
                    smsType = 'SMS_1';
                    messageBody = `EXPANSIVO: Olá! Sua mensalidade de ${capMonth} vence em 3 dias (dia 10). Pague via Pix, Cartão ou Boleto no app: meuexpansivo.vercel.app`;
                }
                // RULE 2: SMS 2 (Due Day)
                else if (diffDays === 0) {
                    smsType = 'SMS_2';
                    messageBody = `EXPANSIVO: Hoje vence sua mensalidade de ${capMonth}. Evite multas pagando via Pix, Cartão ou Boleto até as 23h no portal: meuexpansivo.vercel.app`;
                }
                // RULE 3: SMS 3 (1 Day After)
                else if (diffDays === 1) {
                    smsType = 'SMS_3';
                    messageBody = `EXPANSIVO: Mensalidade de ${capMonth} em atraso. O valor já foi atualizado no app. Regularize via Pix, Cartão ou Boleto: meuexpansivo.vercel.app`;
                }

                if (smsType) {
                    // 4. Idempotency Check in 'sms_logs'
                    // ID format: {mensalidadeId}_{smsType}
                    const logId = `${feeId}_${smsType}`;
                    const logRef = db.collection('sms_logs').doc(logId);

                    const logDoc = await logRef.get();
                    if (logDoc.exists) {
                        console.log(`[SMS-CRON] Skipped ${smsType} for fee ${feeId} (Already Sent)`);
                        continue;
                    }

                    // 5. Send and Log
                    batchPromises.push((async () => {
                        try {
                            const result = await sendSmsProvider(responsiblePhone, messageBody);

                            // Save Log
                            await logRef.set({
                                id: logId,
                                studentId: studentId,
                                responsibleId: student.cpf_responsavel || 'unknown', // Best effort
                                mensalidadeId: feeId,
                                smsType: smsType,
                                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                                targetPhone: responsiblePhone,
                                status: result.success ? 'sucesso' : 'erro',
                                gatewayResponse: result,
                                message: messageBody
                            });

                            console.log(`[SMS-CRON] Sent ${smsType} for fee ${feeId}`);

                        } catch (err) {
                            console.error(`[SMS-CRON] Error sending ${smsType} for fee ${feeId}`, err);
                            // Log error attempt?
                        }
                    })());
                }
            }
        }

        // Wait for all async SMS sends
        await Promise.all(batchPromises);
        console.log(`[SMS-CRON] Finished. Processed ${batchPromises.length} messages.`);
        return null;
    });

/**
 * Cancellation Listener:
 * If a Monthly Fee becomes 'Pago', we don't need to "delete" future SMS because 
 * the scheduler checks status='Pendente'/'Atrasado' every time.
 * 
 * However, user requirement says: "cancelar automaticamente qualquer SMS futuro pendente".
 * Since our system is polling-based (Cron), simply updating the status to 'Pago' 
 * effectively cancels future sends because the query filters for != Pago.
 * 
 * We do not have "queued" SMS jobs in a queue system, so no deletion is needed.
 * The strict check inside the loop covers this requirement.
 */
