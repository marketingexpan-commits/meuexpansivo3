import { useState, useEffect, useMemo } from 'react';
import type { StudentRank, RankSettings, GradeConfig } from './services/rankService';
import { rankService } from './services/rankService';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, User, Globe, Building2, Phone, Info, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { twMerge } from 'tailwind-merge';

// Helper for medals
const RankIcon = ({ position }: { position: number }) => {
  switch (position) {
    case 1: return <Trophy className="w-12 h-12 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />;
    case 2: return <Medal className="w-10 h-10 text-slate-300" />;
    case 3: return <Medal className="w-8 h-8 text-orange-400" />;
    default: return null;
  }
};

const AwardsLegend = ({ config }: { config?: GradeConfig }) => {
  if (!config) return null;
  const { rank1, rank2, rank3 } = config.awards;
  if (!rank1 && !rank2 && !rank3) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col space-y-8 ml-12 py-8 border-l-4 border-yellow-400/20 pl-10 max-w-[300px]"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.2em]">1º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-[#001c3d] leading-tight uppercase tracking-tighter">{rank1 || '---'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">2º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-[#001c3d] leading-tight uppercase tracking-tighter">{rank2 || '---'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">3º Lugar - Prêmio</p>
        <p translate="no" className="text-xl font-black text-[#001c3d] leading-tight uppercase tracking-tighter">{rank3 || '---'}</p>
      </div>
    </motion.div>
  );
};

const RankCard = ({ student, index, isSmartTV }: { student: StudentRank, index: number, isSmartTV: boolean }) => {
  const is1st = student.rankPosition === 1;
  const targetScale = is1st ? 1.04 : 1.0;
  const tvDelay = 0.5 + index * 1.0; // Clearer "step" sequence for TV (0.5s start, 1.0s intervals)

  return (
    <motion.div
      {...(!isSmartTV ? {
        initial: { opacity: 0, y: 50, scale: 0.9 },
        animate: {
          opacity: is1st ? 1 : 0.9,
          y: 0,
          scale: targetScale
        },
        transition: {
          delay: index * 0.3,
          duration: 0.8,
          type: "spring",
          ease: "easeOut"
        }
      } : {})}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        zIndex: is1st ? 30 : 10,
        transformOrigin: 'center center',
        ...(isSmartTV ? {
          opacity: 0,
          animation: `tvCardEntrance 0.8s ease-out ${tvDelay}s forwards`,
          '--target-scale': targetScale
        } : {})
      } as any}
      className={twMerge(
        "bg-white p-4 flex flex-col items-center relative shadow-xl rounded-[2rem] border border-slate-100 w-full max-w-[265px] min-h-fit",
        is1st ? "ring-4 ring-yellow-400" : ""
      )}
    >
      {/* Rank Icon */}
      <div className="absolute top-6 right-6 z-20">
        <RankIcon position={student.rankPosition || 0} />
      </div>

      {/* Photo 3x4 with Padding Hack for Legacy Support */}
      <div className="relative w-full group">
        <div className="w-full pb-[133.33%] relative">
          <div className={twMerge(
            "absolute inset-0 w-full h-full rounded-2xl overflow-hidden shadow-lg border-4 transition-transform duration-500 group-hover:scale-[1.02] bg-slate-100",
            student.rankPosition === 1 ? "border-yellow-400" :
              student.rankPosition === 2 ? "border-slate-300" :
                "border-orange-500"
          )}>
            {student.photoUrl ? (
              <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <User size={64} />
              </div>
            )}
          </div>
        </div>

        {/* Rank Number Badge - Now outside overflow-hidden */}
        <div className={twMerge(
          "absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full font-black text-xl border shadow-xl z-10 whitespace-nowrap",
          student.rankPosition === 1 ? "bg-yellow-400 text-yellow-950 border-yellow-200" :
            student.rankPosition === 2 ? "bg-slate-200 text-slate-800 border-slate-100" :
              "bg-white text-orange-600 border-orange-200"
        )}>
          {student.rankPosition}º LUGAR
        </div>
      </div>

      {/* Details */}
      <div className="text-center mt-6 space-y-1">
        <h3 translate="no" className="text-lg font-black text-slate-900 leading-tight uppercase tracking-tighter" style={{ fontSize: student.name.length > 15 ? '1.1rem' : '1.25rem' }}>
          {student.name.split(' ').slice(0, 2).join(' ')}
        </h3>
        <div className="flex flex-col items-center space-y-0 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
          <span className="text-blue-600 leading-none">{student.gradeLevel}</span>
          <div className="flex items-center space-x-1 auto-cols-min leading-none mt-0.5">
            <span>TURMA {student.schoolClass}</span>
            <span className="opacity-30 mx-0.5">•</span>
            <span>{student.shift === 'shift_morning' ? 'MATUTINO' : 'VESPERTINO'}</span>
          </div>
        </div>
      </div>

      {/* Scores Grid (4 Columns) */}
      <div className="grid grid-cols-7 gap-0 w-full mt-4 pt-3 border-t border-slate-100 px-1">
        <div className="col-span-1 text-center flex flex-col justify-end">
          <p className="text-[7px] text-slate-400 uppercase font-bold leading-none tracking-tighter">Nota</p>
          <p className="text-[7px] text-slate-400 uppercase font-bold leading-none tracking-tighter mb-0.5">Média</p>
          <p className="text-sm font-black text-blue-600 leading-tight">{student.avgGrade.toFixed(1)}</p>
        </div>
        <div className="col-span-1 flex justify-center py-1">
          <div className="w-[1px] h-full bg-slate-200" />
        </div>
        <div className="col-span-1 text-center flex flex-col justify-end">
          <p className="text-[8px] text-slate-400 uppercase font-black tracking-tighter mb-0.5">Freq</p>
          <p className="text-sm font-black text-[#001c3d] leading-tight">{student.attendanceRate.toFixed(0)}%</p>
        </div>
        <div className="col-span-1 flex justify-center py-1">
          <div className="w-[1px] h-full bg-slate-200" />
        </div>
        <div className="col-span-1 text-center flex flex-col justify-end">
          <p className="text-[8px] text-slate-400 uppercase font-black tracking-tighter mb-0.5">Comp</p>
          <p className="text-sm font-black text-orange-600 leading-tight">{student.behaviorScore}</p>
        </div>
        <div className="col-span-1 flex justify-center py-1">
          <div className="w-[1px] h-full bg-slate-200" />
        </div>
        <div className="col-span-1 text-center flex flex-col justify-end">
          <p className="text-[8px] text-blue-600 uppercase font-black tracking-tighter mb-0.5">Pontos</p>
          <p className="text-sm font-black text-blue-800 leading-tight">{student.totalScore.toFixed(1)}</p>
        </div>
      </div>

    </motion.div>
  );
};

const SponsorsShowcase = ({ settings, unitName, scale }: { settings: RankSettings, unitName: string, scale: number }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Extract all unique sponsors (unit sponsor + grade sponsors)
  const allSponsors = useMemo(() => {
    const sponsors: Array<{ name: string; logo?: string; info?: string; phone?: string; address?: string }> = [];

    const isValidPartner = (name?: string, phone?: string, address?: string) => {
      if (!name) return false;
      const n = name.toUpperCase();
      // If name is placeholder, ONLY show if it has some real contact info
      if (n === 'APOIO INSTITUCIONAL' || n === 'GIZ' || n === '') {
        return !!(phone || address);
      }
      return true;
    };

    // 1. Add unit-wide sponsor if valid
    if (isValidPartner(settings.sponsorName, settings.sponsorPhone, settings.sponsorAddress)) {
      sponsors.push({
        name: settings.sponsorName || 'Parceiro Escola',
        logo: settings.sponsorLogoUrl,
        info: settings.sponsorInfo,
        phone: settings.sponsorPhone,
        address: settings.sponsorAddress
      });
    }

    // 2. Add all grade-specific sponsors (unique ones)
    if (settings.gradeConfigs) {
      Object.values(settings.gradeConfigs).forEach(config => {
        if (isValidPartner(config.sponsorName, config.sponsorPhone, config.sponsorAddress)) {
          const exists = sponsors.some(s => s.name.toLowerCase() === config.sponsorName?.toLowerCase());
          if (!exists) {
            sponsors.push({
              name: config.sponsorName || 'Parceiro Escola',
              logo: config.sponsorLogoUrl,
              info: config.sponsorInfo,
              phone: config.sponsorPhone,
              address: config.sponsorAddress
            });
          }
        }
      });
    }

    return sponsors;
  }, [settings]);

  useEffect(() => {
    if (allSponsors.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % allSponsors.length);
    }, 5000); // 5 seconds per sponsor in showcase
    return () => clearInterval(interval);
  }, [allSponsors.length]);

  if (allSponsors.length === 0) return null;

  const sponsor = allSponsors[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#001c3d] text-white p-20"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-blue-600/10 blur-[150px] rounded-full" />

      {/* Header Logo & Unit (Matching main design) */}
      <div className="absolute top-12 left-12 z-20 flex items-center space-x-6">
        <img
          src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
          alt="Logo"
          className="h-12 brightness-0 invert"
          crossOrigin="anonymous"
        />
        <div className="w-px h-10 bg-white/20" />
        <div>
          <h1 translate="no" className="text-3xl font-black tracking-tighter uppercase leading-none text-white">RANKING EXPANSIVO</h1>
          <p translate="no" className="text-sm font-bold text-blue-400 tracking-[0.2em] uppercase mt-1">{unitName}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center h-screen py-16 relative">
        <motion.div
          key={sponsor.name}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 1.05 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center'
          }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl"
        >
          <p className="text-blue-400 font-black tracking-[0.4em] uppercase mb-8 text-sm">Parceiro</p>

          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl mb-8 flex items-center justify-center min-w-[280px] min-h-[280px]">
            {sponsor.logo ? (
              <img
                src={sponsor.logo}
                alt={sponsor.name}
                className="h-32 object-contain"
                crossOrigin="anonymous"
                loading="eager"
                onError={(e) => {
                  console.log(`Failed to load showcase logo for ${sponsor.name}`);
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('flex-col');
                  const fallback = document.createElement('div');
                  fallback.innerHTML = `<span class="text-slate-400 font-bold">LOGOTIPO</span>`;
                  e.currentTarget.parentElement?.appendChild(fallback);
                }}
              />
            ) : (
              <Globe className="text-slate-200 h-20 w-20 opacity-20" />
            )}
          </div>

          <h2 translate="no" className="text-6xl font-black tracking-tighter uppercase mb-4 leading-tight">{sponsor.name}</h2>

          {sponsor.info && (
            <p translate="no" className="text-xl text-blue-200 font-bold uppercase tracking-widest mb-8 opacity-80 italic">
              "{sponsor.info}"
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4 w-full">
            {sponsor.address && (
              <div className="flex flex-col items-center space-y-2">
                <Building2 className="text-blue-400 h-5 w-5" />
                <p translate="no" className="text-base font-bold opacity-70 uppercase tracking-tight">{sponsor.address}</p>
              </div>
            )}
            {sponsor.phone && (
              <div className="flex flex-col items-center space-y-2">
                <Phone className="text-blue-400 h-5 w-5" />
                <p translate="no" className="text-3xl font-black text-blue-400 tracking-wider italic">{sponsor.phone}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Showcase step indicators */}
      <div className="absolute bottom-12 flex gap-3">
        {allSponsors.map((_: any, i: number) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-12 bg-blue-500' : 'w-3 bg-white/20'}`}
          />
        ))}
      </div>
    </motion.div>
  );
};
const RegulationView = ({ settings, unitName }: { settings: RankSettings, unitName: string }) => {
  const grades = ['6º Ano', '7º Ano', '8º Ano', '9º Ano', '1ª Série', '2ª Série', '3ª Série'];
  const gradeIds = ['grade_6_ano', 'grade_7_ano', 'grade_8_ano', 'grade_9_ano', 'grade_1_ser', 'grade_2_ser', 'grade_3_ser'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-50 text-slate-900 pb-20"
    >
      {/* Header Mobile */}
      <div className="bg-[#001c3d] text-white p-8 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <img src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png" alt="Logo" className="h-10 brightness-0 invert mb-6" />
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">Regulamento</h1>
          <p className="text-blue-400 font-bold text-sm tracking-widest uppercase">{unitName}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-8 relative z-20 space-y-6">
        {/* Como funciona */}
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Info className="w-5 h-5" />
            </div>
            <h2 className="font-black text-blue-950 uppercase tracking-tight">Como funciona o Ranking?</h2>
          </div>

          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            O Ranking Expansivo premia o desempenho global dos alunos, incentivando a excelência acadêmica, a pontualidade e o comportamento exemplar.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Notas', val: '60%', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Freq.', val: '30%', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Comp.', val: '10%', color: 'text-orange-600', bg: 'bg-orange-50' }
            ].map(item => (
              <div key={item.label} className={twMerge("p-3 rounded-2xl text-center", item.bg)}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                <p className={twMerge("text-xl font-black", item.color)}>{item.val}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
              <p className="text-xs text-slate-500 font-medium">Desempate: Aluno com a maior nota média.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
              <p className="text-xs text-slate-500 font-medium">Atualização: Os dados são sincronizados em tempo real.</p>
            </div>
          </div>
        </div>

        {/* Premiações */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Premiações por Série</h3>
          {gradeIds.map((id, index) => {
            const config = settings.gradeConfigs?.[id];
            if (!config || (!config.awards.rank1 && !config.awards.rank2 && !config.awards.rank3)) return null;

            return (
              <div key={id} className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Trophy size={60} />
                </div>
                <h4 className="text-lg font-black text-blue-950 uppercase mb-4">{grades[index]}</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-[10px] font-black">1</span>
                    <p className="text-sm font-bold text-slate-700">{config.awards.rank1 || '---'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black">2</span>
                    <p className="text-sm font-bold text-slate-700">{config.awards.rank2 || '---'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-black text-orange-700">3</span>
                    <p className="text-sm font-bold text-slate-700">{config.awards.rank3 || '---'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Texto Adicional */}
        {settings.regulationText && (
          <div className="bg-blue-950 text-white p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="text-xs font-black text-blue-300 uppercase tracking-widest mb-4">Informações Importantes</h3>
            <div className="text-sm leading-relaxed font-medium opacity-90 whitespace-pre-wrap">
              {settings.regulationText}
            </div>
          </div>
        )}

        {/* Footer Mobile */}
        <div className="text-center pt-8 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expansivo Rede de Ensino</p>
          <div className="w-12 h-1 bg-slate-200 mx-auto rounded-full" />
        </div>
      </div>
    </motion.div>
  );
};

function App() {
  const [isSmartTV, setIsSmartTV] = useState(false);

  useEffect(() => {
    // Smart TV Detection Logic
    const ua = navigator.userAgent.toLowerCase();
    const isSmartTVDetected = /webos|smarttv|tizen|viera|bravia/.test(ua);

    if (isSmartTVDetected) {
      document.body.classList.add('is-smart-tv');
      setIsSmartTV(true);
    }
  }, []);

  const [ranks, setRanks] = useState<Record<string, StudentRank[]>>({});
  const [settings, setSettings] = useState<RankSettings | null>(null);
  const [currentGradeIndex, setCurrentGradeIndex] = useState(0);
  const [unitName, setUnitName] = useState("Unidade...");
  const [scaleFactor, setScaleFactor] = useState(1);
  const [showcaseScale, setShowcaseScale] = useState(1);
  const isRegulationRoute = window.location.pathname.includes('/regulamento');

  // Dynamic Scaling Hook for Zoom/Resize Protection
  useEffect(() => {
    const handleResize = () => {
      const h = window.innerHeight;
      // Cards Scale: Header(112) + Footer(112) + Buffer(120) = 344px reserved
      // Base Height adjusted to ensure fit
      const availableForCards = h - 260;
      const computedCardScale = Math.min(1.15, Math.max(0.5, availableForCards / 525));
      setScaleFactor(computedCardScale);

      // Showcase Scale: Padding(128) + Buffer(80) = 208px reserved
      const availableForShowcase = h - 220;
      const computedShowcaseScale = Math.min(1, Math.max(0.5, availableForShowcase / 850));
      setShowcaseScale(computedShowcaseScale);
    };

    // Run immediately and on resize
    handleResize();
    window.addEventListener('resize', handleResize);

    // Optimization: Debounce not strictly needed for simple transform, 
    // but ensures TV doesn't run this often (TVs don't resize)
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get unit from URL (supports path like /zn or query ?u=zn)
  const path = window.location.pathname.replace('/', '').toLowerCase();
  const query = new URLSearchParams(window.location.search);
  const qUnit = query.get('u') || query.get('unit');

  const rawUnit = qUnit || path || "zn";

  // Normalize to canonical ID
  const unitId = rawUnit.startsWith('unit_') ? rawUnit : `unit_${rawUnit}`;

  const grades = useMemo(() => {
    const rawGrades = Object.keys(ranks);
    const academicOrder = ['6º', '7º', '8º', '9º', '1ª', '2ª', '3ª'];

    return rawGrades.sort((a, b) => {
      const idxA = academicOrder.findIndex(o => a.includes(o));
      const idxB = academicOrder.findIndex(o => b.includes(o));

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [ranks]);

  // Extra step for Sponsor Showcase
  const hasSponsors = useMemo(() => {
    const isValidPartner = (name?: string, phone?: string, address?: string) => {
      if (!name) return false;
      const n = name.toUpperCase();
      if (n === 'APOIO INSTITUCIONAL' || n === 'GIZ' || n === '') return !!(phone || address);
      return true;
    };
    if (!settings) return false;
    if (isValidPartner(settings.sponsorName, settings.sponsorPhone, settings.sponsorAddress)) return true;
    if (settings.gradeConfigs) {
      return Object.values(settings.gradeConfigs).some(c => isValidPartner(c.sponsorName, c.sponsorPhone, c.sponsorAddress));
    }
    return false;
  }, [settings]);

  // Count sponsors to determine duration
  const sponsorsCount = useMemo(() => {
    if (!settings) return 0;

    const isValidPartner = (name?: string, phone?: string, address?: string) => {
      if (!name) return false;
      const n = name.toUpperCase();
      if (n === 'APOIO INSTITUCIONAL' || n === 'GIZ' || n === '') return !!(phone || address);
      return true;
    };

    const seenNames = new Set<string>();
    let count = 0;

    // Unit sponsor
    if (isValidPartner(settings.sponsorName, settings.sponsorPhone, settings.sponsorAddress)) {
      const name = (settings.sponsorName || 'Parceiro Escola').toLowerCase();
      seenNames.add(name);
      count++;
    }

    // Grade sponsors
    if (settings.gradeConfigs) {
      Object.values(settings.gradeConfigs).forEach(config => {
        if (isValidPartner(config.sponsorName, config.sponsorPhone, config.sponsorAddress)) {
          const name = (config.sponsorName || 'Parceiro Escola').toLowerCase();
          if (!seenNames.has(name)) {
            seenNames.add(name);
            count++;
          }
        }
      });
    }
    return count;
  }, [settings]);

  const totalSteps = grades.length + (settings?.isEnabled && settings.showcaseEnabled && hasSponsors ? 1 : 0);
  const isShowcaseStep = currentGradeIndex === grades.length && settings?.showcaseEnabled;

  const currentGrade = !isShowcaseStep ? grades[currentGradeIndex] : null;

  // Grade matching logic for configs
  const currentGradeConfig = useMemo(() => {
    if (!settings?.gradeConfigs || !currentGrade) return null;
    return Object.entries(settings.gradeConfigs).find(([id]) => {
      const label = currentGrade.toLowerCase();
      if (id === 'grade_6_ano' && label.includes('6º')) return true;
      if (id === 'grade_7_ano' && label.includes('7º')) return true;
      if (id === 'grade_8_ano' && label.includes('8º')) return true;
      if (id === 'grade_9_ano' && label.includes('9º')) return true;
      if (id === 'grade_1_ser' && label.includes('1ª')) return true;
      if (id === 'grade_2_ser' && label.includes('2ª')) return true;
      if (id === 'grade_3_ser' && label.includes('3ª')) return true;
      return false;
    })?.[1] || null;
  }, [settings, currentGrade]);

  useEffect(() => {
    // Canonical units mapping
    const unitNames: Record<string, string> = {
      'unit_zn': 'Unidade Zona Norte',
      'unit_bs': 'Unidade Boa Sorte',
      'unit_ext': 'Unidade Extremoz',
      'unit_qui': 'Unidade Quintas'
    };
    setUnitName(unitNames[unitId] || "Unidade Escolhida");

    const unsubRanks = rankService.listenToRank(unitId, (newRanks) => {
      setRanks(newRanks);
    });

    const unsubSettings = rankService.listenToSettings(unitId, (s) => {
      setSettings(s);
    });

    return () => {
      unsubRanks();
      unsubSettings();
    };
  }, [unitId]);

  useEffect(() => {
    if (totalSteps <= 1) return;

    const interval = setInterval(() => {
      setCurrentGradeIndex((prev) => (prev + 1) % totalSteps);
    }, isShowcaseStep ? Math.max(5000, sponsorsCount * 5000) : 25000); // Dynamic: 5s per sponsor (min 5s), 25s per grade

    return () => clearInterval(interval);
  }, [totalSteps, isShowcaseStep]);

  const isLoading = !settings || !settings.isEnabled || grades.length === 0;

  return (
    <div className={twMerge(
      "h-screen w-full bg-slate-50 flex flex-col relative overflow-hidden",
      isSmartTV && "bg-[#f8fafc]" // Slightly lighter background for TVs to compensate for lack of blurs
    )}>
      {/* Global CSS Overrides for Smart TV and Animation Fixes */}
      <style>{`
        body.is-smart-tv {
          font-family: 'Inter', sans-serif !important;
          background-color: #001c3d !important;
          text-rendering: optimizeLegibility !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
        body.is-smart-tv * {
          font-family: 'Inter', sans-serif !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        body.is-smart-tv img {
          image-rendering: -webkit-optimize-contrast !important;
          image-rendering: crisp-edges !important;
        }
        body.is-smart-tv .blur-[150px], 
        body.is-smart-tv .blur-[100px] {
          display: none !important;
        }
        /* Fix for legacy WebOS space utilities */
        .flex.space-x-6 > * + * { margin-left: 1.5rem; }
        .flex.space-x-5 > * + * { margin-left: 1.25rem; }
        .flex.space-x-3 > * + * { margin-left: 0.75rem; }
        .flex.space-x-2 > * + * { margin-left: 0.5rem; }
        .flex.flex-col.space-y-8 > * + * { margin-top: 2rem; }
        .flex.flex-col.space-y-1 > * + * { margin-top: 0.25rem; }
        .flex.flex-col.space-y-0.5 > * + * { margin-top: 0.125rem; }

        /* Hardware Accelerated Sequential Entrance for Old TVs */
        @keyframes tvCardEntrance {
          0% { 
            opacity: 0; 
            transform: translateY(50px) scale(0.9);
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(var(--target-scale, 1));
          }
        }
      `}</style>
      {!isSmartTV && (
        <>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-yellow-100/30 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2" />
        </>
      )}

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(15px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f8fafc]"
          >
            {/* Background Glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full" />

            <div className="relative flex flex-col items-center">
              <motion.div
                animate={{
                  scale: [1, 1.02, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="mb-10 relative"
              >
                <img
                  src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                  alt="Logo Expansivo"
                  className="h-32 w-auto object-contain drop-shadow-xl"
                />
              </motion.div>

              <div className="text-center">
                <h1 className="text-2xl font-black text-[#001c3d] mb-4 uppercase tracking-tighter">
                  Carregando Ranking
                </h1>

                {/* Linear Progress Bar below the logo/text */}
                <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden relative mx-auto">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
                    initial={{ width: "0%", left: "-100%" }}
                    animate={{ width: "100%", left: "100%" }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </div>

                <p className="mt-4 text-slate-400 font-bold uppercase tracking-[0.3em] text-[9px] opacity-60">
                  Sincronizando ambiente escolar
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isRegulationRoute && settings ? (
        <RegulationView settings={settings} unitName={unitName} />
      ) : (
        !isLoading && settings && (
          <>
            <AnimatePresence mode="wait">
              {isShowcaseStep && (
                <SponsorsShowcase
                  settings={settings}
                  unitName={unitName}
                  scale={showcaseScale}
                />
              )}
            </AnimatePresence>

            {/* Header */}
            <header className="h-28 bg-white border-b border-slate-100 shadow-sm z-20 flex-shrink-0">
              <div className="max-w-[1440px] mx-auto w-full h-full px-12 md:px-20 flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <img
                    src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                    alt="Logo"
                    className="h-12"
                  />
                  <div className="w-px h-10 bg-slate-100" />
                  <div>
                    <h1 translate="no" className="text-3xl font-black tracking-tighter uppercase leading-none text-[#001c3d]">RANKING EXPANSIVO</h1>
                    <p translate="no" className="text-sm font-bold text-blue-600 tracking-[0.2em] uppercase mt-1">{unitName}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none">Série em destaque</p>
                    <div className="h-1.5 w-16 bg-blue-600 ml-auto mt-1.5 rounded-full" />
                  </div>
                  <h2 translate="no" className="text-4xl font-black text-[#001c3d] uppercase tracking-tighter ml-2 whitespace-nowrap">
                    {currentGrade || 'Patrocinadores'}
                  </h2>
                </div>
              </div>
            </header>

            {/* Main Rank Area */}
            <main className="flex-1 flex items-center justify-center p-12 z-20 overflow-hidden">
              {!currentGrade ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                      className="relative z-10"
                    >
                      <img
                        src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                        alt="Logo Expansivo"
                        className="h-24 opacity-20 grayscale"
                      />
                    </motion.div>
                    <div className="absolute inset-0 bg-blue-600/5 blur-xl rounded-full scale-150 animate-pulse" />
                  </div>
                  <p className="text-slate-300 font-bold uppercase tracking-[0.3em] text-[10px]">Aguardando sincronização...</p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center max-w-[1440px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentGrade}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex items-center justify-center gap-10 w-full"
                    >
                      {/* Score Cards Container */}
                      <div
                        className="flex items-end space-x-8"
                        style={{
                          transform: `scale(${scaleFactor})`,
                          transformOrigin: 'center center'
                        }}
                      >
                        {/* 2nd Place */}
                        {ranks[currentGrade]?.[1] && <RankCard student={ranks[currentGrade][1]} index={1} isSmartTV={isSmartTV} />}

                        {/* 1st Place */}
                        {ranks[currentGrade]?.[0] && <RankCard student={ranks[currentGrade][0]} index={0} isSmartTV={isSmartTV} />}

                        {/* 3rd Place */}
                        {ranks[currentGrade]?.[2] && <RankCard student={ranks[currentGrade][2]} index={2} isSmartTV={isSmartTV} />}
                      </div>

                      {/* Vertical Awards Legend */}
                      <AwardsLegend config={currentGradeConfig || undefined} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </main>

            <footer className="h-28 bg-[#001c3d] border-t border-white/5 z-20 flex-shrink-0">
              <div className="max-w-[1440px] mx-auto w-full h-full px-12 md:px-20 flex items-center justify-between relative">
                {/* Floating Badge on Border - Anchored to parent container's padding point */}
                <div className="absolute top-0 left-12 md:left-20 -translate-y-1/2 z-30">
                  <div className="bg-[#001c3d] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center">
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest italic leading-none">ATUALIZAÇÃO EM TEMPO REAL</span>
                    </div>
                  </div>
                </div>

                {/* 1. Left Section: Scoring Info */}
                <div className="flex flex-col min-w-0 flex-1 pr-6 pt-6">
                  <p className="text-[9px] lg:text-[10px] text-blue-400 font-black tracking-widest uppercase mb-1 truncate">
                    Composição dos Pontos
                  </p>
                  <p className="text-[10px] lg:text-[11px] text-white/70 font-bold uppercase leading-tight italic line-clamp-2">
                    60% Nota Média • 30% Frequência • 10% Comportamento
                  </p>
                  <p className="text-[8px] lg:text-[9px] text-blue-400/80 font-bold uppercase tracking-tight italic mt-0.5 truncate">
                    Desempate: Maior Nota Média
                  </p>
                </div>

                {/* 2. Center Section: QR Code & Regulation */}
                <div className="flex justify-center shrink-0">
                  <div className="flex items-center gap-6">
                    <div className="text-right shrink-0">
                      <p className="text-[9px] text-blue-400 font-extrabold uppercase tracking-widest leading-none mb-1">Regulamento</p>
                      <p className="text-[10px] text-white font-bold opacity-60 uppercase leading-tight italic">Escanear para ver<br />regras e prêmios</p>
                    </div>
                    <div className="shrink-0 p-1.5 bg-white rounded-lg shadow-xl transition-transform hover:scale-105">
                      <QRCodeSVG
                        value={settings?.regulationUrl || (window.location.origin + '/regulamento')}
                        size={84}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Right Section: Partner */}
                <div className="flex justify-end min-w-0 flex-1 pl-6">
                  <motion.div
                    key={currentGradeConfig?.sponsorName || settings?.sponsorName || 'default'}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center space-x-6"
                  >
                    {(() => {
                      const isValid = (val?: string) => {
                        if (!val) return false;
                        const v = val.trim().toUpperCase();
                        return v !== '' && v !== 'GIZ' && v !== 'APOIO INSTITUCIONAL';
                      };

                      const partnerName = isValid(currentGradeConfig?.sponsorName) ? currentGradeConfig?.sponsorName : (isValid(settings?.sponsorName) ? settings?.sponsorName : null);
                      const partnerInfo = isValid(currentGradeConfig?.sponsorInfo) ? currentGradeConfig?.sponsorInfo : (isValid(settings?.sponsorInfo) ? settings?.sponsorInfo : null);
                      const partnerLogo = currentGradeConfig?.sponsorLogoUrl || settings?.sponsorLogoUrl;

                      return (
                        <>
                          <div className="text-right">
                            <p className="text-xs text-blue-400 font-black tracking-[0.2em] uppercase mb-1">PARCEIRO</p>
                            {partnerName && (
                              <p translate="no" className="text-xl font-black text-white tracking-tighter leading-none uppercase">
                                {partnerName}
                              </p>
                            )}
                            {partnerInfo && (
                              <p translate="no" className="text-[9px] text-white/40 font-black uppercase mt-0.5">
                                {partnerInfo}
                              </p>
                            )}
                          </div>
                          <div className="px-10 py-5 bg-white rounded-3xl border border-white/10 shadow-xl flex items-center justify-center min-w-[360px] h-28 overflow-hidden">
                            {partnerLogo ? (
                              <img
                                src={partnerLogo}
                                alt="Partner"
                                className="max-h-20 w-auto object-contain p-2"
                                crossOrigin="anonymous"
                                loading="eager"
                                onError={(e) => {
                                  e.currentTarget.src = "https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png";
                                  e.currentTarget.style.opacity = "0.2";
                                }}
                              />
                            ) : (
                              <Globe className="text-slate-200 h-10 w-10 opacity-20" />
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </motion.div>
                </div>
              </div>
            </footer>
          </>
        )
      )}
    </div>
  );
}

export default App;
