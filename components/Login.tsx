import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../firebaseConfig';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { SCHOOL_UNITS_LIST, ALLOW_MOCK_LOGIN, UNITS_CONTACT_INFO, SCHOOL_LOGO_URL, SCHOOL_LOGO_WHITE_URL } from '../constants';
import { Admin, SchoolUnit, MuralItem, UNIT_LABELS } from '../types';

interface LoginProps {
  onLoginStudent: (code: string, pass: string) => void;
  onLoginTeacher: (cpf: string, pass: string, unit?: string) => void;
  onLoginAdmin: (user: string, pass: string) => void;
  onLoginCoordinator: (name: string, pass: string, unit: string) => void;
  onResetSystem: () => void;
  error?: string;
  adminsList?: Admin[];
}

import { useSchoolConfig } from '../src/hooks/useSchoolConfig';

export const Login: React.FC<LoginProps> = ({ onLoginStudent, onLoginTeacher, onLoginAdmin, onLoginCoordinator, onResetSystem, error, adminsList }) => {
  const { config } = useSchoolConfig();
  // --- SPLASH SCREEN STATE ---
  // --- SPLASH SCREEN STATE ---
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const [animateLogo, setAnimateLogo] = useState(false);
  // Controla a visibilidade do logo estático no header para fazer a troca "mágica"
  const [showStaticLogo, setShowStaticLogo] = useState(false);

  // --- CONTADOR DE VISITAS PÚBLICAS ---
  useEffect(() => {
    try {
      const hasVisited = sessionStorage.getItem('visited_login_page');
      if (!hasVisited) {
        // Incrementa Global
        db.collection('site_stats').doc('general').set({
          login_page_views: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });

        // Incrementa Diário
        const today = new Date().toISOString().split('T')[0];
        db.collection('daily_login_page_views').doc(today).set({
          count: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });

        sessionStorage.setItem('visited_login_page', 'true');
      }
    } catch (error) {
      console.error("Erro ao registrar visita:", error);
    }
  }, []);

  React.useEffect(() => {
    // 0. Iniciar com logo invisível (fade-in suave)
    const timer0 = setTimeout(() => {
      setLogoVisible(true);
    }, 100);

    // 1. Iniciar troca de cor da logo (2s) - Mais lento
    const timer1 = setTimeout(() => {
      setAnimateLogo(true);
    }, 2000);

    // 2. Iniciar fade out da tela (4.5s) - Duração total maior
    const timer2 = setTimeout(() => {
      setSplashFading(true);
    }, 4500);

    // 3. Remover splash da DOM e mostrar logo estático (5.5s)
    const timer3 = setTimeout(() => {
      setShowSplash(false);
      setShowStaticLogo(true);
    }, 5500);

    return () => {
      clearTimeout(timer0);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin' | 'coordinator'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [selectedAdminUnit, setSelectedAdminUnit] = useState('');
  const [selectedTeacherUnit, setSelectedTeacherUnit] = useState(SCHOOL_UNITS_LIST[0]);
  const [selectedCoordinatorUnit, setSelectedCoordinatorUnit] = useState(SCHOOL_UNITS_LIST[0]);

  const [isMuralOpen, setIsMuralOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // --- REMEMBER ME LOGIC ---
  const [rememberMe, setRememberMe] = useState(false);

  React.useEffect(() => {
    const savedCode = localStorage.getItem('savedUserCode');
    if (savedCode) {
      setIdentifier(savedCode);
      setRememberMe(true);
    }
  }, []);

  // --- MODO SECRETO ---
  const [showHiddenTabs, setShowHiddenTabs] = useState(false);
  const maskCPF = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
      return v
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return v.substring(0, 11);
  };

  const [secretClickCount, setSecretClickCount] = useState(0);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const handleSecretClick = () => {
    if (showHiddenTabs) return;

    const newCount = secretClickCount + 1;
    setSecretClickCount(newCount);

    if (newCount === 5) {
      setShowHiddenTabs(true);
      alert("🔐 Modo Administrativo/Coordenação Desbloqueado!");
    }
  };

  // --- REF PARA MEDIR POSIÇÃO DO LOGO ---
  const logoRef = useRef<HTMLDivElement>(null);
  const [logoPosition, setLogoPosition] = useState({ top: '50%', left: '50%' });

  // Calcular posição exata do logo no header
  useLayoutEffect(() => {
    const calculatePosition = () => {
      const rect = logoRef.current?.getBoundingClientRect();
      if (rect) {
        // Calcular o centro do elemento alvo
        const centerY = rect.top + rect.height / 2;
        const centerX = rect.left + rect.width / 2;
        // Atualizar estado com posição exata
        setLogoPosition({ top: `${centerY}px`, left: `${centerX}px` });
      }
    };

    // Calcular inicialmente e em resize
    // Pequeno delay para garantir que o layout estabilizou e elementos estão visíveis
    const timer = setTimeout(() => {
      calculatePosition();
    }, 100);

    window.addEventListener('resize', calculatePosition);
    return () => {
      window.removeEventListener('resize', calculatePosition);
      clearTimeout(timer);
    };
  }, []);

  const [muralItems, setMuralItems] = useState<MuralItem[]>([]);
  const [downloadLinks, setDownloadLinks] = useState<MuralItem[]>([]);

  useEffect(() => {
    // Removed orderBy('createdAt', 'desc') to avoid missing index error
    const unsubscribe = db.collection('mural_items')
      .where('isActive', '==', true)
      .onSnapshot(snapshot => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MuralItem));

        // Sort client-side
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setMuralItems(items.filter(i => i.type === 'flyer'));
        setDownloadLinks(items.filter(i => i.type === 'file'));
      }, err => console.error("Error fetching mural", err));
    return () => unsubscribe();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Save or Remove 'remember me' (Student Only)
    if (activeTab === 'student') {
      if (rememberMe && identifier) {
        localStorage.setItem('savedUserCode', identifier);
      } else {
        localStorage.removeItem('savedUserCode');
      }
    }

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
    } else if (activeTab === 'coordinator') {
      if (!selectedCoordinatorUnit) {
        alert("Por favor, selecione a unidade escolar.");
        return;
      }
      onLoginCoordinator(identifier, password, selectedCoordinatorUnit);
    }
  };

  const switchTab = (tab: 'student' | 'teacher' | 'admin' | 'coordinator') => {
    setActiveTab(tab);
    setIdentifier('');
    setPassword('');
    setSelectedAdminUnit('');
    if (tab === 'teacher') setSelectedTeacherUnit(SCHOOL_UNITS_LIST[0]);
    if (tab === 'coordinator') setSelectedCoordinatorUnit(SCHOOL_UNITS_LIST[0]);
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (activeTab === 'student') {
      if (/^\d{0,5}$/.test(val)) {
        setIdentifier(val);
      }
    } else if (activeTab === 'teacher') {
      // CPF: Apply mask
      setIdentifier(maskCPF(val));
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#E8E8E8] p-4 md:p-6">

        {/* --- HEADER HORIZONTAL (ESTILO REFERÊNCIA) --- */}
        <div className="flex items-center gap-4 mb-8 animate-fade-in-down">
          <div
            ref={logoRef}
            onClick={handleSecretClick}
            className={`cursor-pointer active:scale-95 transition-transform h-16 md:h-20 w-auto ${showStaticLogo ? 'opacity-100' : 'opacity-0'} transition-opacity duration-0`}
          >
            <SchoolLogo className="!h-full w-auto" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] leading-none mb-1" style={{ color: config.accentColor }}>{config.appSubtitle}</span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-none" style={{ color: config.primaryColor }}>{config.appName}</h1>
          </div>
        </div>

        {/* --- CARD CONTAINER --- */}
        <div className="max-w-md w-full relative">

          {/* --- SPLASH SCREEN (OVERLAY ON CARD) --- */}
          {showSplash && (
            <>
              {/* CONTENÇÃO DA TELA DE ABERTURA (Full-height e largura do card no PC) */}
              <div className="fixed inset-0 z-[60] pointer-events-none flex justify-center">
                <div className="w-full h-full max-w-md relative">

                  {/* CAMADAS DE FUNDO */}
                  <div className="absolute inset-0 md:rounded-2xl overflow-hidden shadow-xl">
                    {/* CAMADA DE FUNDO BRANCA */}
                    <div
                      className={`absolute inset-0 bg-white transition-opacity duration-1000 ${splashFading ? 'opacity-0' : 'opacity-100'}`}
                    >
                      {/* CAMADA DE FUNDO (GRADIENTE AZUL) */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br from-blue-950 to-slate-900 transition-opacity duration-[1500ms] ${animateLogo ? 'opacity-0' : 'opacity-100'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* LOGO QUE VIAJA (Posição Fixa Global) */}
              <div className="fixed inset-0 z-[70] pointer-events-none">

                {/* LOGO QUE VIAJA (Livre para sair do Card) */}
                {/* LOGO QUE VIAJA (Posição Dinâmica) */}
                <div
                  className={`absolute z-[70] transition-all duration-1000 ease-in-out perspective-[1000px] -translate-x-1/2 -translate-y-1/2
                   ${splashFading ? 'h-12 md:h-16 w-24 md:w-32 scale-90 md:scale-100' : 'h-32 w-32 scale-100'}
                `}
                  style={{
                    top: splashFading ? logoPosition.top : '50%',
                    left: splashFading ? logoPosition.left : '50%',
                  }}
                >
                  {/* 3D Flip Container */}
                  <div
                    className={`relative w-full h-full transition-transform duration-[1500ms] [transform-style:preserve-3d] ${animateLogo ? '[transform:rotateY(180deg)]' : ''}`}
                  >
                    {/* Logo Branca (FRENTE) */}
                    <div className="absolute inset-0 [backface-visibility:hidden]">
                      <img
                        src={SCHOOL_LOGO_WHITE_URL}
                        alt="Logo Branca"
                        className="w-full h-full object-contain object-center"
                      />
                    </div>

                    {/* Logo Laranja (VERSO) */}
                    <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                      <img
                        src={SCHOOL_LOGO_URL}
                        alt="Logo Oficial"
                        className="w-full h-full object-contain object-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* --- CARD PRINCIPAL (CINZA COM ABAS) --- */}
          <div
            className="rounded-2xl overflow-hidden relative shadow-lg"
            style={{
              background: `linear-gradient(90deg, 
                ${activeTab === 'student' || hoveredTab === 'student' ? '#D1D5DB' : '#E5E7EB'} 0%, 
                ${activeTab === 'student' || hoveredTab === 'student' ? '#D1D5DB' : '#E5E7EB'} ${showHiddenTabs ? '25%' : '50%'}, 
                ${(activeTab === 'teacher' && !showHiddenTabs) || (activeTab === 'admin' && showHiddenTabs) || hoveredTab === (showHiddenTabs ? 'admin' : 'teacher') ? '#D1D5DB' : '#E5E7EB'} ${showHiddenTabs ? '75%' : '50%'},
                ${(activeTab === 'teacher' && !showHiddenTabs) || (activeTab === 'admin' && showHiddenTabs) || hoveredTab === (showHiddenTabs ? 'admin' : 'teacher') ? '#D1D5DB' : '#E5E7EB'} 100%)`
            }}
          >

            {/* ABAS INTEGRADAS NO CARD CINZA (SEM PADDING PARA SER TOTALMENTE FLUSH) */}
            <div className="flex w-full relative">
              <button
                className={`flex-1 py-4 text-sm font-semibold text-center transition-all ${activeTab === 'student'
                  ? 'bg-gray-300 text-blue-950 hover:bg-gray-400'
                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                onClick={() => switchTab('student')}
                onMouseEnter={() => setHoveredTab('student')}
                onMouseLeave={() => setHoveredTab(null)}
              >
                Aluno / Família
              </button>
              <button
                className={`flex-1 py-4 text-sm font-semibold text-center transition-all ${activeTab === 'teacher'
                  ? 'bg-gray-300 text-blue-950 hover:bg-gray-400'
                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                onClick={() => switchTab('teacher')}
                onMouseEnter={() => setHoveredTab('teacher')}
                onMouseLeave={() => setHoveredTab(null)}
              >
                Professor
              </button>

              {/* ABAS OCULTAS (ADMIN / COORDENADOR) */}
              {showHiddenTabs && (
                <>
                  <button
                    className={`flex-1 py-4 text-sm font-semibold text-center transition-all ${activeTab === 'coordinator'
                      ? 'bg-gray-300 text-blue-950 hover:bg-gray-400'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => switchTab('coordinator')}
                    onMouseEnter={() => setHoveredTab('coordinator')}
                    onMouseLeave={() => setHoveredTab(null)}
                  >
                    Coord.
                  </button>
                  <button
                    className={`flex-1 py-4 text-sm font-semibold text-center transition-all ${activeTab === 'admin'
                      ? 'bg-gray-300 text-blue-950 hover:bg-gray-400'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => switchTab('admin')}
                    onMouseEnter={() => setHoveredTab('admin')}
                    onMouseLeave={() => setHoveredTab(null)}
                  >
                    Admin
                  </button>
                </>
              )}
            </div>

            {/* ÁREA BRANCA DO FORMULÁRIO (COM BORDAS ARREDONDADAS NO TOPO TAMBÉM) */}
            <div className="bg-white rounded-2xl p-6 relative z-10 shadow-inner">

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
                        <option key={unit} value={unit}>{UNIT_LABELS[unit as SchoolUnit] || unit}</option>
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
                        <option key={unit} value={unit}>{UNIT_LABELS[unit as SchoolUnit] || unit}</option>
                      ))}
                    </select>
                  </div>
                )}
                {activeTab === 'coordinator' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Selecione a Unidade</label>
                    <select
                      value={selectedCoordinatorUnit}
                      onChange={(e) => setSelectedCoordinatorUnit(e.target.value as SchoolUnit)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:border-blue-950 bg-white transition-colors"
                      required
                    >
                      {SCHOOL_UNITS_LIST.map(unit => (
                        <option key={unit} value={unit}>{UNIT_LABELS[unit as SchoolUnit] || unit}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {activeTab === 'student' ? 'Código de Matrícula' :
                      activeTab === 'teacher' ? 'CPF do Professor' :
                        activeTab === 'coordinator' ? 'Nome do Coordenador' : 'Usuário'}
                  </label>
                  <input
                    type="text"
                    inputMode={activeTab === 'student' || activeTab === 'teacher' ? 'numeric' : 'text'}
                    maxLength={activeTab === 'student' ? 5 : activeTab === 'teacher' ? 14 : undefined}
                    value={identifier}
                    onChange={handleIdentifierChange}
                    placeholder={
                      activeTab === 'student' ? 'Ex.: 12345 (Consulte a Secretaria)' :
                        activeTab === 'teacher' ? '000.000.000-00' :
                          activeTab === 'coordinator' ? 'Ex: Maria Silva' :
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

                {/* Checkbox "Lembrar meu código" (Exclusivo Aluno) */}
                {activeTab === 'student' && (
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none">
                      Lembrar meu código
                    </label>
                  </div>
                )}

                {error && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {error}
                  </div>
                )}

                {/* Botão Acessar Portal */}
                <button
                  type="submit"
                  className="w-full py-4 text-lg font-bold text-white rounded-xl transition-all transform active:scale-95 hover:opacity-90"
                  style={{ backgroundColor: config.accentColor }}
                >
                  Acessar
                </button>

              </form>
            </div>
          </div>

          {/* --- BOTÕES DO RODAPÉ (FORA DO CARD) --- */}
          <div className="mt-4 space-y-3">
            {/* DOIS BOTÕES LADO A LADO */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="py-3 px-4 bg-gray-200 hover:bg-gray-300 text-blue-950 border border-gray-300 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm transform active:scale-95 group"
              >
                <svg className="w-5 h-5 transition-transform duration-200 group-active:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                <span>Fale Conosco</span>
              </button>

              <a
                href={config.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 bg-gray-200 hover:bg-gray-300 text-blue-950 border border-gray-300 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm transform active:scale-95 group"
              >
                <svg className="w-5 h-5 transition-transform duration-200 group-active:scale-125" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path></svg>
                <span>Instagram</span>
              </a>
            </div>

            {/* BOTÃO MURAL DIGITAL FULL WIDTH */}
            <button
              type="button"
              onClick={() => setIsMuralOpen(true)}
              className="w-full py-3 px-4 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm shadow-sm hover:opacity-90"
              style={{ backgroundColor: config.primaryColor }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              <span>Mural Digital</span>
            </button>
          </div>

          {/* CRÉDITOS DO DESENVOLVEDOR */}
          <div className="mt-6 text-center">
            <p className="text-[10px] text-gray-500">{config.copyrightText}</p>
            <p className="text-[10px] text-gray-500 mt-1">
              <span>Desenvolvido por: </span>
              <a
                href={`${config.developerUrl}?text=${encodeURIComponent(config.developerMessage || 'Olá, preciso de suporte.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-600 hover:underline transition-colors font-medium"
              >
                {config.developerName}
              </a>
            </p>
          </div>
        </div>
      </div >

      {/* --- MURAL DIGITAL MODAL --- */}
      {
        isMuralOpen && (
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
                      {muralItems.length === 0 && <p className="text-gray-400 italic text-center py-4">Nenhum destaque no momento.</p>}
                      {muralItems.map(item => (
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
                        {downloadLinks.length === 0 && <p className="text-gray-400 italic text-center py-4">Nenhum arquivo disponível.</p>}
                        {downloadLinks.map(link => (
                          <li key={link.id} className="hover:bg-blue-50 transition-colors group cursor-pointer relative">
                            <a
                              href={link.url}
                              download={link.url !== '#' ? true : undefined}
                              target={link.url !== '#' ? '_blank' : undefined}
                              rel="noopener noreferrer"
                              onClick={(e) => link.url === '#' && e.preventDefault()}
                              className="block p-5"
                            >
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
        )
      }

      {/* --- FALE CONOSCO MODAL --- */}
      {
        isContactOpen && (
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
                {(config.units && config.units.length > 0 ? config.units : UNITS_CONTACT_INFO).map(unit => (
                  <div key={unit.name} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                    <h3 className="font-bold text-blue-950 mb-1">{unit.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{unit.address}</p>
                    <a href={`https://wa.me/${unit.whatsapp}?text=Olá! Venho através do aplicativo Meu Expansivo e gostaria de solicitar um atendimento. Obrigado!`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 font-bold text-sm bg-white p-2 rounded-lg border border-green-100 shadow-sm group-hover:shadow-md transition-all justify-center">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }

      {/* --- LIGHTBOX / PREVIEW DE IMAGEM --- */}
      {
        previewImage && (
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
        )
      }
    </>
  );
};