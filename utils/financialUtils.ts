import { Mensalidade } from '../types';

/**
 * Calculates interest and fines for a given fee (mensalidade)
 */
export const calculateFinancials = (mensalidade: Mensalidade) => {
    const originalDate = new Date(mensalidade.dueDate);
    // Standardizing due date to day 10 for strict calculation if needed, 
    // though usually we respect the dueDate field. 
    // The current logic in AdminDashboard sets it to 23:59:59 of day 10 of the month?
    // Let's replicate the exact logic from AdminDashboard.ts
    const strictDueDate = new Date(originalDate.setDate(10));
    strictDueDate.setHours(23, 59, 59, 999);

    // Reference date: today or payment date
    let referenceDate = new Date();
    referenceDate.setHours(0, 0, 0, 0);

    if (mensalidade.status === 'Pago' && mensalidade.paymentDate) {
        referenceDate = new Date(mensalidade.paymentDate);
        referenceDate.setHours(0, 0, 0, 0);
    } else if (mensalidade.status === 'Pago' && !mensalidade.paymentDate) {
        // Se pago mas sem data (legado/erro), não cobra juros
        return { originalValue: mensalidade.value, total: mensalidade.value, fine: 0, interest: 0 };
    }

    let fine = 0;
    let interest = 0;

    // Se a data de referência (pagamento ou hoje) for maior que o vencimento
    if (referenceDate > strictDueDate) {
        const diffTime = Math.abs(referenceDate.getTime() - strictDueDate.getTime());
        const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        fine = mensalidade.value * 0.02;
        interest = mensalidade.value * (0.00033 * daysLate);
    }

    return {
        originalValue: mensalidade.value,
        fine,
        interest,
        total: mensalidade.value + fine + interest
    };
};
