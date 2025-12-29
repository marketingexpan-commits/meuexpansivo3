
// Script de Simulação de Mensagens SMS Zenvia
// Executar com: node functions/simulate_sms.js

console.log("---------------------------------------------------------");
console.log("📱 SIMULADOR DE MENSAGENS SMS (DOMÍNIO ATUALIZADO)");
console.log("---------------------------------------------------------");

const mockFee = {
    month: "Maio/2026",
    value: 450.00
};

const link = "https://meuexpansivo.app";

// 1. Lembrete (3 Dias Antes)
function generateReminder() {
    console.log("\n[CENÁRIO 1] Faltam 3 dias para o vencimento:");
    const msg = `Expansivo: Ola! A mensalidade de ${mockFee.month} vence em 3 dias. Valor: R$ ${mockFee.value.toFixed(2).replace('.', ',')}. Acesse: ${link}`;
    console.log("\u001b[32m" + msg + "\u001b[0m"); // Green output
    console.log(`(Caracteres: ${msg.length})`);
}

// 2. Dia do Vencimento
function generateDueToday() {
    console.log("\n[CENÁRIO 2] É o dia do vencimento (Hoje):");
    const msg = `Expansivo: A mensalidade de ${mockFee.month} vence HOJE! Evite juros e multa pagando agora em: ${link}`;
    console.log("\u001b[33m" + msg + "\u001b[0m"); // Yellow output
    console.log(`(Caracteres: ${msg.length})`);
}

// 3. Atraso (1 Dia Depois)
function generateOverdue() {
    console.log("\n[CENÁRIO 3] Venceu ontem (Atrasado):");
    const msg = `Expansivo: A mensalidade de ${mockFee.month} venceu ontem. Evite multa e o acúmulo de juros, regularizando agora em: ${link}`;
    console.log("\u001b[31m" + msg + "\u001b[0m"); // Red output
    console.log(`(Caracteres: ${msg.length})`);
}

generateReminder();
generateDueToday();
generateOverdue();

console.log("\n---------------------------------------------------------");
console.log("✅ Simulação Concluída.");
