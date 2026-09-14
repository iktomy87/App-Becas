import { Routes, Route } from 'react-router-dom';
import './styles/global.css';
import { Topbar } from './components/Topbar';
import { PanelPrincipal } from './pages/PanelPrincipal';
import { RankingPage } from './pages/RankingPage';
import { InscripcionesPage } from './pages/InscripcionesPage';

function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<PanelPrincipal />} />
        <Route path="/inscripciones" element={<InscripcionesPage />} />
        <Route path="/ranking" element={<RankingPage />} />
      </Routes>
    </>
  );
}

export default App;
