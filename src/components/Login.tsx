
import React, { useState } from 'react';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { SCHOOL_UNITS_LIST, ALLOW_MOCK_LOGIN } from '../constants'; 
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
      
      // Tenta preencher automaticamente com base na lista (se disponível)
      // Se não tiver permissão para ler a lista, limpa o campo para o usuário digitar
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
          <div className="bg-blue-900 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <SchoolLogo variant="login" />
              <p className="text-blue-200 text-sm font-medium mb-1 mt-2">Olá, bem-vindo(a) ao</p>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Meu Expansivo</h2>
              <p className="text-blue-200 mt-2 text-sm uppercase tracking-widest font-semibold">O Portal do Aluno</p>
            </div>
          </div>

          {/* --- MENU DE ABAS --- */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              className={`flex-1 py-3 text-xs sm:text-sm font-medium text-center focus:outline-none transition-colors border-b-2 ${
                activeTab === 'student' ? 'text-blue-900 border-blue-900 bg-white' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => switchTab('student')}
            >
              Alunos
            </button>
            <button
              className={`flex-1 py-3 text-xs sm:text-sm font-medium text-center focus:outline-none transition-colors border-b-2 ${
                activeTab === 'teacher' ? 'text-blue-900 border-blue-900 bg-white' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => switchTab('teacher')}
            >
              Professores
            </button>
            <button
              className={`flex-1 py-3 text-xs sm:text-sm font-medium text-center focus:outline-none transition-colors border-b-2 ${
                activeTab === 'admin' ? 'text-blue-900 border-blue-900 bg-white' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => switchTab('admin')}
            >
              Admin
            </button>
          </div>

          {/* --- CONTEÚDO --- */}
          <div className="p-8">
            
            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up">
              
              {activeTab === 'admin' && (
                  <div>
                      <label className="block text-sm font-bold text-gray-700">Selecione a Unidade</label>
                      <select
                          value={selectedAdminUnit}
                          onChange={handleAdminUnitChange}
                          className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-800 focus:border-blue-800 transition-colors bg-white"
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
                      <label className="block text-sm font-bold text-gray-700">Selecione a Unidade</label>
                      <select
                          value={selectedTeacherUnit}
                          onChange={(e) => setSelectedTeacherUnit(e.target.value as SchoolUnit)}
                          className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-800 focus:border-blue-800 transition-colors bg-white"
                          required
                      >
                          {SCHOOL_UNITS_LIST.map(unit => (
                              <option key={unit} value={unit}>{unit}</option>
                          ))}
                      </select>
                  </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700">
                  {activeTab === 'student' ? 'Código do Aluno (5 dígitos)' : 
                  activeTab === 'teacher' ? 'CPF do Professor' : 'Usuário'}
                </label>
                <input
                  type="text"
                  inputMode={activeTab === 'student' ? 'numeric' : 'text'}
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder={
                    activeTab === 'student' ? 'Ex: 12345' : 
                    activeTab === 'teacher' ? 'Ex: 12345678900' : 
                    activeTab === 'admin' ? (
                        selectedAdminUnit === 'Extremoz' ? 'Ex: admin_ext' :
                        selectedAdminUnit === 'Boa Sorte' ? 'Ex: admin_bs' :
                        selectedAdminUnit === 'Zona Norte' ? 'Ex: admin_zn' :
                        selectedAdminUnit === 'Quintas' ? 'Ex: admin_qui' :
                        selectedAdminUnit === 'GERAL' ? 'Ex: admin_geral' :
                        'Ex: admin'
                    ) : 'Usuário'
                  }
                  className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-800 focus:border-blue-800 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-800 focus:border-blue-800 transition-colors"
                  required
                />
              </div>

              {error && (
                <div className="text-red-700 text-sm bg-red-50 p-3 rounded-lg border border-red-200 flex items-center">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full py-3 text-lg shadow-lg !bg-orange-600 !hover:bg-orange-700 !text-white">
                Acessar
              </Button>
            </form>

            {/* --- PAINEL DE CREDENCIAIS (SÓ SE ALLOW_MOCK_LOGIN = TRUE) --- */}
            {ALLOW_MOCK_LOGIN && (
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <h4 className="font-bold text-blue-900 text-sm mb-2 flex items-center">
                      <span className="mr-2">🔑</span> Credenciais de Teste
                  </h4>
                  <div className="space-y-2 text-xs text-blue-800">
                      <div className="flex justify-between items-center border-b border-blue-200 pb-1">
                          <span><strong>Aluno:</strong> 12345</span>
                          <span>Senha: <strong>123</strong></span>
                      </div>
                      <div className="flex flex-col border-b border-blue-200 pb-1">
                          <div className="flex justify-between">
                            <span><strong>Prof:</strong> 12345678900</span>
                            <span>Senha: <strong>admin</strong></span>
                          </div>
                          <span className="text-[10px] opacity-75">Unidade: Zona Norte</span>
                      </div>
                      <div className="flex flex-col">
                          <div className="flex justify-between">
                            <span><strong>Admin:</strong> admin_zn</span>
                            <span>Senha: <strong>admin</strong></span>
                          </div>
                          <span className="text-[10px] opacity-75">Unidade: Zona Norte</span>
                      </div>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t border-blue-200">
                    <button
                        type="button"
                        onClick={onResetSystem}
                        className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded font-bold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        RESTAURAR DADOS (TESTE)
                    </button>
                  </div>
              </div>
            )}

            {/* --- BOTÃO MURAL DIGITAL --- */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <button
                  type="button"
                  onClick={() => setIsMuralOpen(true)}
                  className="w-full py-3 bg-gradient-to-r from-blue-900 to-blue-950 hover:from-blue-800 hover:to-blue-900 text-white rounded-xl font-bold shadow-md hover:shadow-xl transition-all flex items-center justify-center gap-2 group transform active:scale-95"
              >
                  <span className="bg-white/20 p-1.5 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  </span>
                  Mural Digital
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
            <p className="text-xs text-gray-500">&copy; 2025 Expansivo Rede de Ensino. Todos os direitos reservados.</p>
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
