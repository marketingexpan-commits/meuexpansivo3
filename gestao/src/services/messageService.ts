import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, orderBy } from 'firebase/firestore';
import type { SchoolMessage } from '../types';
import { MessageRecipient } from '../types';

const MESSAGES_COLLECTION = 'schoolMessages';
const NOTIFICATIONS_COLLECTION = 'notifications';

export const messageService = {
    // Buscar mensagens direcionadas à Diretoria
    async getDirectorMessages(unit?: string) {
        try {
            let q;
            if (unit && unit !== 'admin_geral') {
                q = query(
                    collection(db, MESSAGES_COLLECTION),
                    where('recipient', '==', MessageRecipient.DIRECTION),
                    where('unit', '==', unit),
                    orderBy('timestamp', 'desc')
                );
            } else {
                q = query(
                    collection(db, MESSAGES_COLLECTION),
                    where('recipient', '==', MessageRecipient.DIRECTION),
                    orderBy('timestamp', 'desc')
                );
            }

            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SchoolMessage[];
        } catch (error) {
            console.error("Erro ao buscar mensagens da diretoria:", error);
            throw error;
        }
    },

    // Marcar mensagem como lida
    async markAsRead(messageId: string) {
        try {
            const docRef = doc(db, MESSAGES_COLLECTION, messageId);
            await updateDoc(docRef, { status: 'read' });
        } catch (error) {
            console.error("Erro ao marcar mensagem como lida:", error);
            throw error;
        }
    },

    // Responder à mensagem
    async replyToMessage(message: SchoolMessage, response: string, responderName: string) {
        try {
            const docRef = doc(db, MESSAGES_COLLECTION, message.id);

            // 1. Atualizar a mensagem com a resposta
            await updateDoc(docRef, {
                response: response,
                responseAuthor: responderName,
                responseTimestamp: new Date().toISOString(),
                status: 'replied'
            });

            // 2. Criar notificação para o aluno
            await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
                studentId: message.studentId,
                title: 'Nova Resposta da Diretoria',
                message: `Sua mensagem sobre "${message.messageType}" foi respondida.`,
                timestamp: new Date().toISOString(),
                read: false,
                type: 'school_message_reply'
            });

        } catch (error) {
            console.error("Erro ao responder mensagem:", error);
            throw error;
        }
    }
};
