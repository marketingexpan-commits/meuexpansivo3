import React, { useState } from 'react';
import { Student, SchoolMessage, MessageRecipient, MessageType, UnitContact, ContactRole, Teacher } from '../types';
import { Button } from './Button';

import { UNITS_DATA, DEFAULT_UNIT_DATA } from '../src/constants';
import { MessageCircle } from 'lucide-react';

export const MessageBox: React.FC<{ student: Student; onSendMessage: (message: Omit<SchoolMessage, 'id'>) => Promise<void>; unitContacts: UnitContact[]; teachers?: Teacher[]; }> = ({ student, onSendMessage, unitContacts, teachers = [] }) => {
  const [recipient, setRecipient] = useState<MessageRecipient>(MessageRecipient.COORDINATION);
  const [messageType, setMessageType] = useState<MessageType>(MessageType.SUGGESTION);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  // Novo State para Coordenador Específico
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const coordinators = unitContacts.filter(c =>
    c.unit === student.unit &&
    (c.role === ContactRole.COORDINATOR || c.role?.toString().toUpperCase() === 'COORDENADOR')
  );
  const unitTeachers = teachers.filter(t => t.unit === student.unit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 10) {
      alert('Por favor, escreva uma mensagem com pelo menos 10 caracteres.');
      return;
    }

    // 1. Preparação Síncrona do WhatsApp
    // Calculamos a URL antes de qualquer async para abrir a janela imediatamente
    // Isso evita o bloqueio de popups e a "página em branco"
    let waUrl = '';

    if (recipient === MessageRecipient.DIRECTION || recipient === MessageRecipient.COORDINATION) {
      const targetRole = recipient === MessageRecipient.DIRECTION ? ContactRole.DIRECTOR : ContactRole.COORDINATOR;
      // Tenta encontrar contato específico (prioriza seleção se for coordenação)
      let contact;

      if (recipient === MessageRecipient.COORDINATION && selectedCoordinatorId) {
        contact = unitContacts.find(c => c.id === selectedCoordinatorId);
      }

      if (!contact) {
        contact = unitContacts.find(c => c.unit === student.unit && c.role === targetRole);
      }

      // Fallback para dados da unidade
      const unitInfo = UNITS_DATA[student.unit] || DEFAULT_UNIT_DATA;

      // Prioriza o telefone do contato específico, senão usa o da unidade
      const phoneRaw = contact ? contact.phoneNumber : unitInfo.phone;
      const waNumber = phoneRaw.replace(/\D/g, '');
      const contactName = contact ? contact.name : `Escola (${student.unit})`;

      if (waNumber) {
        const messageText = `Olá ${contactName}! Sou o(a) ${student.name} (${student.gradeLevel} - Unidade ${student.unit}) e acabei de deixar uma mensagem de *${messageType}* no portal escolar direcionada à ${recipient}. Conteúdo: "${content}". Poderia verificar?`;
        // Usamos api.whatsapp.com pois é mais robusto em alguns dispositivos móveis
        waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(messageText)}`;

        // ABERTURA IMEDIATA DA URL FINAL
        window.open(waUrl, '_blank');
      }
    }

    setIsSending(true);
    try {
      // Modifica o conteúdo se for para um professor específico
      let finalContent = content;
      if (recipient === MessageRecipient.TEACHERS && selectedTeacherId) {
        const teacher = unitTeachers.find(t => t.id === selectedTeacherId);
        if (teacher) {
          finalContent = `Para o Professor(a): ${teacher.name} - ${content}`;
        }
      }

      // O envio ao banco ocorre em paralelo/background relativo à janela aberta
      await onSendMessage({
        studentId: student.id,
        studentName: student.name,
        unit: student.unit,
        recipient,
        messageType,
        content: finalContent,
        timestamp: new Date().toISOString(),
        status: 'new',
      });

      setIsSent(true);
      setContent('');
      setMessageType(MessageType.SUGGESTION);

      setRecipient(MessageRecipient.COORDINATION);
      setSelectedCoordinatorId(''); // Reset
      setSelectedTeacherId('');
      setTimeout(() => setIsSent(false), 5000);
    } catch (error) {
      console.error("Erro ao enviar mensagem interna:", error);
      // Não fechamos janela aqui pois o usuário já está no WhatsApp (se aplicável), o que é o objetivo principal.
      // A falha de log interno não deve impedir o contato.
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-gray-200 print:hidden">
      <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-blue-950" />
        Fale com a Escola
      </h3>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        {isSent ? (
          <div className="flex flex-col items-center justify-center h-48 text-center bg-green-50 rounded-lg border border-green-200 animate-fade-in">
            <svg className="w-12 h-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h4 className="text-lg font-bold text-green-800">Mensagem Enviada!</h4>
            <p className="text-sm text-green-700">Obrigado pelo seu feedback. A escola analisará sua mensagem em breve.</p>
            {(recipient === MessageRecipient.DIRECTION || recipient === MessageRecipient.COORDINATION) && (
              <p className="text-xs text-green-600 mt-2 font-semibold">Seu WhatsApp foi aberto para notificar a liderança.</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-1">Destinatário</label>
                <select id="recipient" value={recipient} onChange={e => setRecipient(e.target.value as MessageRecipient)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white">
                  {Object.values(MessageRecipient).map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                {/* NOVO: Dropdown Secundário para Coordenadores */}
                {recipient === MessageRecipient.COORDINATION && coordinators.length > 0 && (
                  <div className="mt-2 animate-fade-in">
                    <label htmlFor="coordSelect" className="block text-xs font-bold text-gray-500 mb-1 uppercase">Selecione o Coordenador:</label>
                    <select
                      id="coordSelect"
                      value={selectedCoordinatorId}
                      onChange={e => setSelectedCoordinatorId(e.target.value)}
                      className="w-full p-2 border border-blue-200 rounded-md bg-blue-50 text-blue-900 text-sm"
                      required
                    >
                      <option value="">-- Selecione --</option>
                      {coordinators.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.segment && c.segment !== 'all' ? `(${c.segment === 'infantil' ? 'Ed. Infantil' : 'Fund./Médio'})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Dropdown para Professores */}
                {recipient === MessageRecipient.TEACHERS && unitTeachers.length > 0 && (
                  <div className="mt-2 animate-fade-in">
                    <label htmlFor="teacherSelect" className="block text-xs font-bold text-gray-500 mb-1 uppercase">Selecione o Professor:</label>
                    <select
                      id="teacherSelect"
                      value={selectedTeacherId}
                      onChange={e => setSelectedTeacherId(e.target.value)}
                      className="w-full p-2 border border-blue-200 rounded-md bg-blue-50 text-blue-900 text-sm"
                      required
                    >
                      <option value="">-- Selecione --</option>
                      {unitTeachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(recipient === MessageRecipient.DIRECTION || recipient === MessageRecipient.COORDINATION) && (
                  <p className="text-xs text-blue-600 mt-1 italic flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                    Iremos abrir seu WhatsApp para notificar a liderança.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="messageType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Mensagem</label>
                <select id="messageType" value={messageType} onChange={e => setMessageType(e.target.value as MessageType)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white">
                  {Object.values(MessageType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Sua Mensagem</label>
              <textarea id="content" value={content} onChange={e => setContent(e.target.value)} rows={4} className="w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white" placeholder="Escreva seu elogio, sugestão ou reclamação aqui..." required minLength={10}></textarea>
            </div>
            <div className="text-right">
              <Button type="submit" disabled={isSending}>
                {isSending ? 'Enviando...' : 'Enviar Mensagem'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
