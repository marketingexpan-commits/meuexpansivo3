
interface PixParams {
    key: string;
    name: string;
    city: string;
    amount: number;
    description?: string; // TximId (txid) usually, or description
    txid?: string;
}

export const generatePixPayload = ({ key, name, city, amount, txid = '***' }: PixParams): string => {
    // IDs do Payload do Pix (EMVCo)
    const ID_PAYLOAD_FORMAT_INDICATOR = '00';
    const ID_MERCHANT_ACCOUNT_INFORMATION = '26';
    const ID_MERCHANT_ACCOUNT_INFORMATION_GUI = '00';
    const ID_MERCHANT_ACCOUNT_INFORMATION_KEY = '01';
    const ID_MERCHANT_CATEGORY_CODE = '52';
    const ID_TRANSACTION_CURRENCY = '53';
    const ID_TRANSACTION_AMOUNT = '54';
    const ID_COUNTRY_CODE = '58';
    const ID_MERCHANT_NAME = '59';
    const ID_MERCHANT_CITY = '60';
    const ID_ADDITIONAL_DATA_FIELD_TEMPLATE = '62';
    const ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID = '05';
    const ID_CRC16 = '63';

    // Helper para formatar campos (ID + Length + Value)
    const formatField = (id: string, value: string) => {
        const len = value.length.toString().padStart(2, '0');
        return `${id}${len}${value}`;
    };

    // Helper para o CRC16 (CCITT-FALSE)
    const getCRC16 = (payload: string) => {
        const polynomial = 0x1021;
        let crc = 0xFFFF;

        for (let i = 0; i < payload.length; i++) {
            let c = payload.charCodeAt(i);
            crc ^= (c << 8);
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) {
                    crc = (crc << 1) ^ polynomial;
                } else {
                    crc = crc << 1;
                }
            }
        }
        crc &= 0xFFFF;
        return crc.toString(16).toUpperCase().padStart(4, '0');
    };

    // 1. Payload Format Indicator (000201)
    let payload = formatField(ID_PAYLOAD_FORMAT_INDICATOR, '01');

    // 2. Point of Initiation Method (12 se dinâmico, mas usaremos estático simplificado ou omitimos para estático padrão. Omitindo para compatibilidade geral em estático)
    // payload += formatField(ID_POINT_OF_INITIATION_METHOD, '11'); 

    // 3. Merchant Account Information (GUI + Chave)
    const gui = formatField(ID_MERCHANT_ACCOUNT_INFORMATION_GUI, 'br.gov.bcb.pix');
    const chave = formatField(ID_MERCHANT_ACCOUNT_INFORMATION_KEY, key);
    // const desc = description ? formatField(ID_MERCHANT_ACCOUNT_INFORMATION_DESCRIPTION, description) : ''; 
    payload += formatField(ID_MERCHANT_ACCOUNT_INFORMATION, gui + chave);

    // 4. Merchant Category Code (0000 para indefinido ou 5732 para serviços gerais? 0000 é seguro)
    payload += formatField(ID_MERCHANT_CATEGORY_CODE, '0000');

    // 5. Transaction Currency (986 = BRL)
    payload += formatField(ID_TRANSACTION_CURRENCY, '986');

    // 6. Transaction Amount
    payload += formatField(ID_TRANSACTION_AMOUNT, amount.toFixed(2));

    // 7. Country Code
    payload += formatField(ID_COUNTRY_CODE, 'BR');

    // 8. Merchant Name (Sem acentos, max 25 chars)
    const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase();
    payload += formatField(ID_MERCHANT_NAME, cleanName);

    // 9. Merchant City
    const cleanCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15).toUpperCase();
    payload += formatField(ID_MERCHANT_CITY, cleanCity);

    // 10. Additional Data (TxID)
    const cleanTxid = txid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';
    const addData = formatField(ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID, cleanTxid);
    payload += formatField(ID_ADDITIONAL_DATA_FIELD_TEMPLATE, addData);

    // 11. CRC16
    payload += ID_CRC16 + '04'; // Prepara para o cálculo
    const crc = getCRC16(payload);

    return payload + crc;
};
