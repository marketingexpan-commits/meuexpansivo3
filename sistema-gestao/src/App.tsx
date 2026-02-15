import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Matriculas } from './pages/Matriculas';
import { Financeiro } from './pages/Financeiro';
import { FinanceiroConfig } from './pages/FinanceiroConfig';
import GradeHoraria from './pages/GradeHoraria';
import Disciplinas from './pages/Disciplinas';
import AcademicConfig from './pages/AcademicConfig';
import Unidades from './pages/Unidades';
import { Professores } from './pages/Professores';
import { Coordenadores } from './pages/Coordenadores';
import { MuralDigital } from './pages/MuralDigital';
import { SchoolConfig } from './pages/SchoolConfig';
import AdminUnidades from './pages/AdminUnidades';
import { RematriculaPage } from './pages/RematriculaPage.tsx';
import { DirectorMessages } from './pages/DirectorMessages';
import { Porteiros } from './pages/Porteiros';
import RankingConfig from './pages/RankingConfig';



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/matriculas" element={<Matriculas />} />
          <Route path="/diretoria/mensagens" element={<DirectorMessages />} />
          <Route path="/rematricula" element={<RematriculaPage />} />
          <Route path="/financeiro" element={<Navigate to="/financeiro/receitas" replace />} />
          <Route path="/financeiro/receitas" element={<Financeiro />} />
          <Route path="/financeiro/pagamentos" element={<Financeiro />} />
          <Route path="/financeiro/fluxo" element={<Financeiro />} />
          <Route path="/financeiro/eventos" element={<Financeiro />} />
          <Route path="/financeiro/config" element={<FinanceiroConfig />} />
          <Route path="/grade-horaria" element={<GradeHoraria />} />
          <Route path="/config/disciplinas" element={<Disciplinas />} />
          <Route path="/config/series" element={<AcademicConfig />} />
          <Route path="/config/coordenadores" element={<Coordenadores />} />
          <Route path="/config/professores" element={<Professores />} />
          <Route path="/config/unidades" element={<Unidades />} />
          <Route path="/config/mural-digital" element={<MuralDigital />} />
          <Route path="/config/escola" element={<SchoolConfig />} />
          <Route path="/config/admin-unidades" element={<AdminUnidades />} />
          <Route path="/config/porteiros" element={<Porteiros />} />
          <Route path="/config/ranking" element={<RankingConfig />} />

        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}
export default App;
