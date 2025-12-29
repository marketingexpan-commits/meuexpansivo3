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
