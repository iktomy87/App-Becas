import { Routes, Route } from 'react-router-dom';
import './styles/global.css';
import { Topbar } from './components/Topbar';
import { PanelPrincipal } from './pages/PanelPrincipal';
import { RankingPage } from './pages/RankingPage';
import { InscripcionesPage } from './pages/InscripcionesPage';
import { PropuestasPage } from './pages/PropuestasPage';
import { ConvocatoriasPage } from './pages/ConvocatoriasPage';

function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<PanelPrincipal />} />
        <Route path="/convocatorias" element={<ConvocatoriasPage />} />
        <Route path="/inscripciones" element={<InscripcionesPage />} />
        <Route path="/propuestas" element={<PropuestasPage />} />
        <Route path="/ranking" element={<RankingPage />} />
      </Routes>
    </>
  );
}

export default App;
