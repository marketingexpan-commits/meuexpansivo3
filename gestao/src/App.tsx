import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Matriculas } from './pages/Matriculas';
import { Financeiro } from './pages/Financeiro';
import { FinanceiroConfig } from './pages/FinanceiroConfig';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/matriculas" element={<Matriculas />} />
          <Route path="/financeiro" element={<Navigate to="/financeiro/receitas" replace />} />
          <Route path="/financeiro/receitas" element={<Financeiro />} />
          <Route path="/financeiro/pagamentos" element={<Financeiro />} />
          <Route path="/financeiro/fluxo" element={<Financeiro />} />
          <Route path="/financeiro/config" element={<FinanceiroConfig />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}
export default App;
