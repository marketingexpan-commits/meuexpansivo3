/**
 * Masks a string as a CPF (000.000.000-00)
 */
export const maskCPF = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
        return v
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return v.substring(0, 11);
};

/**
 * Masks a string as a Phone number ((00) 00000-0000)
 */
export const maskPhone = (value: string) => {
    let r = value.replace(/\D/g, '');
    if (r.length > 11) r = r.substring(0, 11);
    if (r.length > 7) {
        r = `(${r.substring(0, 2)}) ${r.substring(2, 7)}-${r.substring(7)}`;
    } else if (r.length > 2) {
        r = `(${r.substring(0, 2)}) ${r.substring(2)}`;
    } else if (r.length > 0) {
        r = `(${r}`;
    }
    return r;
};

export const sanitizePhone = (value: string): string => {
    // 1. Remove tudo que não é dígito
    let digits = value.replace(/\D/g, '');

    // 2. Se estiver vazio ou curto demais, retorna vazio ou string original limpa
    if (digits.length < 8) return digits;

    // 3. Lógica para garantir prefixo 55
    // Se começar com 55 e tiver 12 ou 13 dígitos, assume que já está certo.
    // (55 + 2 DDD + 8 ou 9 NÚMERO)
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        return digits;
    }

    // Se NÃO começar com 55, adiciona.
    // Ex: usuário digitou 84988887777 (11 dígitos, DDD+Num) -> vira 5584988887777
    if (!digits.startsWith('55')) {
        return `55${digits}`;
    }

    // Fallback: retorna apenas os dígitos (caso seja um formato estranho que não queremos quebrar totalmente)
    return digits;
};
