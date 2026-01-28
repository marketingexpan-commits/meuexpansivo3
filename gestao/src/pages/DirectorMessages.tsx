import { useState, useEffect } from 'react';
import { messageService } from '../services/messageService';
import type { SchoolMessage } from '../types';
import { MessageType, SchoolUnit, UNIT_LABELS } from '../types';
import {
    MessageCircle,
    Search,
    Filter,
    CheckCircle2,
    Clock,
    ChevronRight,
    Building2,
    Calendar,
    Send,
    X,
    Loader2,
    MessageSquareReply,
    Eye,
    Activity
} from 'lucide-react';
import { clsx } from 'clsx';

export function DirectorMessages() {
    const [messages, setMessages] = useState<SchoolMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterUnit, setFilterUnit] = useState<string>('all');

    const [selectedMessage, setSelectedMessage] = useState<SchoolMessage | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';

    useEffect(() => {
        loadMessages();
    }, []);

    const loadMessages = async () => {
        try {
            setIsLoading(true);
            const data = await messageService.getDirectorMessages(userUnit || undefined);
            setMessages(data);
        } catch (error) {
            console.error("Erro ao carregar mensagens:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            await messageService.markAsRead(id);
            setMessages(prev => prev.map((m: SchoolMessage) => m.id === id ? { ...m, status: 'read' as const } : m));
        } catch (error) {
            console.error("Erro ao marcar como lida:", error);
        }
    };

    const handleReply = async () => {
        if (!selectedMessage || !replyContent.trim()) return;

        try {
            setIsSendingReply(true);
            const adminName = localStorage.getItem('userName') || 'Diretoria';
            await messageService.replyToMessage(selectedMessage, replyContent, adminName);

            // Atualizar estado local
            setMessages(prev => prev.map((m: SchoolMessage) => m.id === selectedMessage.id ? {
                ...m,
                response: replyContent,
                responseAuthor: adminName,
                responseTimestamp: new Date().toISOString(),
                status: 'replied' as const
            } : m));

            setReplyContent('');
            setSelectedMessage(null);
            alert("Resposta enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao enviar resposta:", error);
            alert("Erro ao enviar resposta. Tente novamente.");
        } finally {
            setIsSendingReply(false);
        }
    };

    const filteredMessages = messages.filter((m: SchoolMessage) => {
        const matchesSearch = m.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || m.messageType === filterType;
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'new' && m.status === 'new' && !m.response) ||
            (filterStatus === 'read' && m.status === 'read' && !m.response) ||
            (filterStatus === 'replied' && (m.status === 'replied' || m.response));
        const matchesUnit = filterUnit === 'all' || m.unit === filterUnit;

        return matchesSearch && matchesType && matchesStatus && matchesUnit;
    });

    const getStatusIcon = (message: SchoolMessage) => {
        if (message.status === 'replied' || message.response) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        if (message.status === 'read') return <Eye className="w-4 h-4 text-blue-500" />;
        return <Clock className="w-4 h-4 text-amber-500" />;
    };

    const getStatusLabel = (message: SchoolMessage) => {
        if (message.status === 'replied' || message.response) return "Respondida";
        if (message.status === 'read') return "Lida";
        return "Nova";
    };

    const getTypeBadgeClass = (type: MessageType) => {
        switch (type) {
            case MessageType.COMPLIMENT: return "bg-emerald-50 text-emerald-700 border-emerald-100";
            case MessageType.SUGGESTION: return "bg-blue-50 text-blue-700 border-blue-100";
            case MessageType.COMPLAINT: return "bg-rose-50 text-rose-700 border-rose-100";
            default: return "bg-slate-50 text-slate-700 border-slate-100";
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-blue-900 animate-spin" />
                <p className="text-slate-500 font-medium">Carregando mensagens...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Msg. Alunos</h1>
                    <p className="text-slate-500 text-sm">Gerenciamento de feedbacks enviados pelo Fale com a Escola</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        Total: {filteredMessages.length}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative group md:col-span-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar aluno ou conteúdo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>

                    {/* Filter Type */}
                    <div className="relative flex items-center">
                        <Filter className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            <option value="all">Todos os Tipos</option>
                            <option value={MessageType.COMPLIMENT}>Elogios</option>
                            <option value={MessageType.SUGGESTION}>Sugestões</option>
                            <option value={MessageType.COMPLAINT}>Reclamações</option>
                        </select>
                    </div>

                    {/* Filter Status */}
                    <div className="relative flex items-center">
                        <Activity className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="new">Novas</option>
                            <option value="read">Lidas (Sem Resposta)</option>
                            <option value="replied">Respondidas</option>
                        </select>
                    </div>

                    {/* Filter Unit (Only for Admin Geral) */}
                    {isAdminGeral && (
                        <div className="relative flex items-center">
                            <Building2 className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                            <select
                                value={filterUnit}
                                onChange={(e) => setFilterUnit(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                <option value="all">Todas as Unidades</option>
                                {Object.entries(UNIT_LABELS).map(([id, label]) => (
                                    <option key={id} value={id}>{label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Aluno / Unidade</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Assunto</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredMessages.length > 0 ? (
                                filteredMessages.map((m: SchoolMessage) => (
                                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(m)}
                                                <span className={clsx(
                                                    "text-[10px] font-bold uppercase",
                                                    (m.status === 'replied' || m.response) ? "text-emerald-600" : m.status === 'read' ? "text-blue-600" : "text-amber-600"
                                                )}>
                                                    {getStatusLabel(m)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{m.studentName}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{UNIT_LABELS[m.unit as SchoolUnit] || m.unit}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "px-2 py-1 rounded-md border text-[10px] font-bold uppercase",
                                                getTypeBadgeClass(m.messageType)
                                            )}>
                                                {m.messageType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 font-mono text-[10px]">
                                            {new Date(m.timestamp).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedMessage(m);
                                                    if (m.status === 'new') handleMarkAsRead(m.id);
                                                }}
                                                className="p-2 hover:bg-white border-2 border-transparent hover:border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all shadow-sm hover:shadow-md"
                                                title="Visualizar Mensagem"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                        Nenhuma mensagem encontrada com os filtros selecionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Detalhes e Resposta */}
            {selectedMessage && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "p-3 rounded-2xl border-2",
                                    getTypeBadgeClass(selectedMessage.messageType)
                                )}>
                                    <MessageCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                                        Detalhes da Mensagem
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium">De: {selectedMessage.studentName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMessage(null)}
                                className="p-2 hover:bg-white border-2 border-transparent hover:border-slate-200 rounded-full text-slate-400 hover:text-rose-500 transition-all shadow-sm"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Message Info */}
                            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-3 h-3" />
                                    Unidade: <span className="text-slate-900">{UNIT_LABELS[selectedMessage.unit as SchoolUnit] || selectedMessage.unit}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3 h-3" />
                                    Data: <span className="text-slate-900">{new Date(selectedMessage.timestamp).toLocaleString('pt-BR')}</span>
                                </div>
                            </div>

                            {/* Message Content */}
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                                    "{selectedMessage.content}"
                                </p>
                            </div>

                            {/* Reply Section */}
                            {selectedMessage.response ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                                        <MessageSquareReply className="w-4 h-4" />
                                        Resposta Enviada por {selectedMessage.responseAuthor || 'Diretoria'}
                                    </div>
                                    <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                                        <p className="text-emerald-900 leading-relaxed whitespace-pre-wrap">
                                            {selectedMessage.response}
                                        </p>
                                        <p className="text-[10px] text-emerald-600 mt-4 font-mono">
                                            Em {new Date(selectedMessage.responseTimestamp!).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-900 block ml-1">
                                        Responder ao Aluno
                                    </label>
                                    <textarea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Escreva sua resposta aqui..."
                                        rows={4}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                                    ></textarea>
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setSelectedMessage(null)}
                                            className="px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-700 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleReply}
                                            disabled={isSendingReply || !replyContent.trim()}
                                            className="flex items-center gap-2 px-6 py-3 bg-blue-950 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            {isSendingReply ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                            Enviar Resposta
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
