import React, { useState } from 'react';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { SCHOOL_UNITS_LIST, ALLOW_MOCK_LOGIN, UNITS_CONTACT_INFO } from '../constants';
import { Admin, SchoolUnit } from '../types';

interface LoginProps {
  onLoginStudent: (code: string, pass: string) => void;
  onLoginTeacher: (cpf: string, pass: string, unit?: string) => void;
  onLoginAdmin: (user: string, pass: string) => void;
  onResetSystem: () => void;
  error?: string;
  adminsList?: Admin[];
}

export const Login: React.FC<LoginProps> = ({ onLoginStudent, onLoginTeacher, onLoginAdmin, onResetSystem, error, adminsList }) => {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [selectedAdminUnit, setSelectedAdminUnit] = useState('');
  const [selectedTeacherUnit, setSelectedTeacherUnit] = useState(SCHOOL_UNITS_LIST[0]);

  const [isMuralOpen, setIsMuralOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // --- MODO SECRETO ---
  const [isAdminVisible, setIsAdminVisible] = useState(false);
  const [secretClickCount, setSecretClickCount] = useState(0);

  const handleSecretClick = () => {
    if (isAdminVisible) return;

    const newCount = secretClickCount + 1;
    setSecretClickCount(newCount);

    if (newCount === 5) {
      setIsAdminVisible(true);
      alert("🔐 Modo Administrativo Desbloqueado!");
    }
  };
  // --------------------

  const MURAL_ITEMS = [
    { id: 3, type: 'flyer', title: 'Comunicado de Férias', url: 'https://i.postimg.cc/xTZgfGfv/Férias_layout_App_Meu_Ex_Prancheta_1.png' },
    { id: 1, type: 'flyer', title: 'Matrículas 2026 Abertas', url: 'https://i.postimg.cc/9X6vmqWW/Foco-Disciplina-Meu-Ex-Prancheta-1-copia-3.png' },
    { id: 2, type: 'flyer', title: 'Feliz Natal!', url: 'https://i.postimg.cc/nzktjFTd/expanzinho-Flyer-Natal-02.png' }
  ];

  const DOWNLOAD_LINKS = [
    { id: 1, title: 'Calendário Acadêmico 2025', date: '05/01/2025', size: '1.2 MB' },
    { id: 2, title: 'Lista de Livros - Fundamental I', date: '10/12/2024', size: '450 KB' },
    { id: 3, title: 'Lista de Livros - Fundamental II', date: '10/12/2024', size: '480 KB' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'student') {
      onLoginStudent(identifier, password);
    } else if (activeTab === 'teacher') {
      if (!selectedTeacherUnit) {
        alert("Por favor, selecione a unidade escolar.");
        return;
      }
      onLoginTeacher(identifier, password, selectedTeacherUnit);
    } else if (activeTab === 'admin') {
      onLoginAdmin(identifier, password);
    }
  };

  const switchTab = (tab: 'student' | 'teacher' | 'admin') => {
    setActiveTab(tab);
    setIdentifier('');
    setPassword('');
    setSelectedAdminUnit('');
    if (tab === 'teacher') setSelectedTeacherUnit(SCHOOL_UNITS_LIST[0]);
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (activeTab === 'student') {
      if (/^\d{0,5}$/.test(val)) {
        setIdentifier(val);
      }
    } else {
      setIdentifier(val);
    }
  };

  const handleAdminUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const unit = e.target.value;
    setSelectedAdminUnit(unit);
    if (unit === 'GERAL') {
      const generalAdmin = adminsList?.find(a => !a.unit);
      if (generalAdmin) setIdentifier(generalAdmin.username);
      else setIdentifier('');
      return;
    }
    const adminForUnit = adminsList?.find(a => a.unit === unit);
    if (adminForUnit) {
      setIdentifier(adminForUnit.username);
    } else {
      setIdentifier('');
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden relative">

          {/* CABEÇALHO (COM GRADIENTE AZUL MARINHO - Igual ao Mural de Avisos) */}
          <div
            className="bg-gradient-to-br from-blue-950 to-slate-900 p-8 text-center cursor-pointer select-none shadow-md"
            onClick={handleSecretClick}
          >
            <div className="flex flex-col items-center">
              <SchoolLogo variant="login" />
              <p className="text-white/80 text-sm font-medium mb-1 mt-2">Olá, bem-vindo(a) ao</p>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Meu Expansivo</h2>
              <p className="text-white/60 mt-1 text-xs uppercase tracking-widest font-semibold">PORTAL DA FAMÍLIA</p>
            </div>
          </div>

          {/* --- MENU DE ABAS --- */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              className={`flex-1 py-3 text-xs sm:text-sm font-medium text-center focus:outline-none focus:ring-0 focus:ring-offset-0 outline-none select-none transition-colors border-b-2 ${activeTab === 'student' ? 'text-blue-900 border-blue-900 bg-white' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
                }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onClick={() => switchTab('student')}
            >
              Família / Aluno
            </button>
            <button
              className={`flex-1 py-3 text-xs sm:text-sm font-medium text-center focus:outline-none focus:ring-0 focus:ring-offset-0 outline-none select-none transition-colors border-b-2 ${activeTab === 'teacher' ? 'text-blue-900 border-blue-900 bg-white' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
                }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onClick={() => switchTab('teacher')}
            >
              Professores
            </button>

            {/* ABA ADMIN (CONDICIONAL - MODO SECRETO) */}
            {isAdminVisible && (
              <button
                className={`flex-1 py-3 text-xs sm:text-sm font-medium text-center focus:outline-none focus:ring-0 focus:ring-offset-0 outline-none select-none transition-colors border-b-2 ${activeTab === 'admin' ? 'text-blue-900 border-blue-900 bg-white' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
                  }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                onClick={() => switchTab('admin')}
              >
                Admin
              </button>
            )}
          </div>

          {/* --- CONTEÚDO --- */}
          <div className="p-8 pb-6">

            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up">

              {activeTab === 'admin' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Selecione a Unidade</label>
                  <select
                    value={selectedAdminUnit}
                    onChange={handleAdminUnitChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-blue-950 bg-white transition-colors"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="GERAL" className="font-bold">⭐ GERENCIADOR ADM</option>
                    {SCHOOL_UNITS_LIST.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'teacher' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Selecione a Unidade</label>
                  <select
                    value={selectedTeacherUnit}
                    onChange={(e) => setSelectedTeacherUnit(e.target.value as SchoolUnit)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-blue-950 bg-white transition-colors"
                    required
                  >
                    {SCHOOL_UNITS_LIST.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  {activeTab === 'student' ? 'Código de Matrícula' :
                    activeTab === 'teacher' ? 'CPF do Professor' : 'Usuário'}
                </label>
                <input
                  type="text"
                  inputMode={activeTab === 'student' ? 'numeric' : 'text'}
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder={
                    activeTab === 'student' ? 'Ex.: 12345 (Consulte a Secretaria)' :
                      activeTab === 'teacher' ? 'Ex: 12345678900' :
                        'Usuário'
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-950 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={isPasswordVisible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-950 transition-colors pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {isPasswordVisible ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  {error}
                </div>
              )}

              {/* Botão Acessar Portal - Cor Sólida Laranja (Tom do Logo), Sem Gradiente */}
              <button type="submit" className="w-full py-3.5 text-lg font-bold text-white rounded-lg transition-all transform active:scale-95 bg-orange-600 hover:bg-orange-700 shadow-lg">
                Acessar
              </button>

            </form>

            {/* SEPARADOR SUTIL */}
            <div className="border-t border-gray-100 my-6"></div>

            {/* --- BOTÕES DO RODAPÉ (RESTAURADOS) --- */}
            <div className="grid grid-cols-2 gap-4">
              {/* BOTÃO FALE CONOSCO (ESTILO CINZA CLARO - COM ANIMAÇÃO NO ÍCONE E EFEITO NO QUADRADO MAIS INTENSO) */}
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-blue-950 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm group active:scale-95 shadow hover:shadow-lg"
              >
                <span className="bg-gray-200 p-1.5 rounded-lg transition-colors group-active:bg-gray-400">
                  <svg className="w-5 h-5 text-gray-600 transition-transform duration-300 group-active:rotate-12 group-hover:rotate-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                </span>
                <span>Fale Conosco</span>
              </button>

              {/* BOTÃO MURAL DIGITAL (COM GRADIENTE AZUL MARINHO E EFEITOS INTERATIVOS IGUAIS AO 'BAIXAR RELATÓRIO') */}
              <button
                type="button"
                onClick={() => setIsMuralOpen(true)}
                className="py-3 px-4 text-white rounded-xl font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-blue-950 to-slate-900 hover:from-blue-900 hover:to-slate-800 shadow-md hover:shadow-xl group"
              >
                <span className="bg-white/20 p-1.5 rounded-lg transition-colors group-active:bg-white/30">
                  <svg className="w-5 h-5 opacity-90 transition-transform duration-300 group-active:rotate-12 group-hover:rotate-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </span>
                <span>Mural Digital</span>
              </button>
            </div>

            {/* CRÉDITOS DO DESENVOLVEDOR (RESTAURADOS) */}
            <div className="mt-8 text-center border-t border-gray-100 pt-4">
              <p className="text-[10px] text-gray-500">© 2025 Expansivo Rede de Ensino. Todos os direitos reservados.</p>
              <p className="text-[10px] text-gray-500 mt-1">
                <span>Desenvolvido por: </span>
                <a
                  href="https://wa.me/5584988739180"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-600 hover:underline transition-colors font-medium"
                >
                  HC Apps | 84988739180
                </a>
              </p>
            </div>

            {/* --- PAINEL DE CREDENCIAIS (SÓ SE ALLOW_MOCK_LOGIN = TRUE) --- */}
            {ALLOW_MOCK_LOGIN && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                <h4 className="font-bold text-yellow-800 text-xs mb-2">MODO DE TESTE ATIVO</h4>
                <button onClick={onResetSystem} className="text-[10px] text-red-600 underline">Resetar Sistema</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MURAL DIGITAL MODAL --- */}
      {isMuralOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-900 text-white rounded-xl shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Mural Digital</h2>
                  <p className="text-sm text-blue-600 font-medium">Informações, Eventos e Downloads Úteis</p>
                </div>
              </div>
              <button onClick={() => setIsMuralOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-white rounded-full shadow-sm">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                <div className="flex flex-col h-full">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-200">
                    <span className="text-orange-500 bg-orange-100 p-1 rounded">📢</span> Destaques & Eventos
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 italic">Clique na imagem para ampliar.</p>
                  <div className="space-y-6 overflow-y-auto pr-2">
                    {MURAL_ITEMS.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreviewImage(item.url)}
                        className="w-full text-left bg-white p-3 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <div className="aspect-video w-full overflow-hidden rounded-xl bg-gray-200 relative">
                          <img src={item.url} alt={item.title} className="object-cover w-full h-full transform transition duration-700 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90"></div>
                          <div className="absolute bottom-0 left-0 w-full p-4">
                            <span className="inline-block px-2 py-1 bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider rounded mb-2">Novo</span>
                            <h4 className="text-white font-bold text-xl leading-tight">{item.title}</h4>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col h-full">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-200">
                    <span className="text-blue-500 bg-blue-100 p-1 rounded">📥</span> Arquivos para Download
                  </h3>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
                    <ul className="divide-y divide-gray-100">
                      {DOWNLOAD_LINKS.map(link => (
                        <li key={link.id} className="hover:bg-blue-50 transition-colors group cursor-pointer relative">
                          <a href="#" onClick={(e) => e.preventDefault()} className="block p-5">
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors shadow-sm">
                                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition-colors truncate mb-1">{link.title}</h4>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    {link.date}
                                  </span>
                                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <span className="font-mono bg-gray-100 px-1.5 rounded">{link.size}</span>
                                </div>
                              </div>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex justify-end gap-3">
              <Button onClick={() => setIsMuralOpen(false)} variant="secondary" className="px-6 py-2.5">Fechar Mural</Button>
            </div>
          </div>
        </div>
      )}

      {/* --- FALE CONOSCO MODAL --- */}
      {isContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsContactOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-blue-600 bg-blue-50 p-2 rounded-lg">📞</span> Fale Conosco
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Precisa de ajuda? Entre em contato com a secretaria da sua unidade via WhatsApp:
            </p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {UNITS_CONTACT_INFO.map(unit => (
                <div key={unit.name} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                  <h3 className="font-bold text-blue-950 mb-1">{unit.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{unit.address}</p>
                  <a href={`https://wa.me/${unit.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 font-bold text-sm bg-white p-2 rounded-lg border border-green-100 shadow-sm group-hover:shadow-md transition-all justify-center">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                    Abrir no WhatsApp
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- LIGHTBOX / PREVIEW DE IMAGEM --- */}
      {previewImage && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
          style={{ zIndex: 2147483647 }} // Valor máximo permitido
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviewImage(null);
          }}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-2"
            onClick={() => setPreviewImage(null)}
            style={{ zIndex: 2147483647 }}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <img
            src={previewImage}
            alt="Visualização Ampliada"
            className="w-full h-full max-w-none max-h-none object-contain pointer-events-auto select-none"
            style={{ maxWidth: '95vw', maxHeight: '95vh' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};