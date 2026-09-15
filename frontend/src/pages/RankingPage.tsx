import './RankingPage.css';
import './PanelPrincipal.css';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { rankingService } from '../services/ranking.service';
import type { ResultadoRanking } from '../services/types';

export function RankingPage() {
  const { convocatoriaId = '0408ab9c-363b-4b5f-9dc0-aeefdc2bc631' } = useParams(); // hardcoded fallback for dev if needed
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoRanking[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const res = await rankingService.listar(convocatoriaId, 1, 1000);
      setResultados(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, [convocatoriaId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const res = await rankingService.importar(convocatoriaId, file);
      alert(`Orden de mérito importado:\n${res.filasValidas} filas válidas\n${res.filasError} filas descartadas.`);
      await fetchRanking(); // recargar tabla
    } catch (err: any) {
      alert(`Error al importar: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="content ranking-main">
        {/* Header skeleton */}
        <div className="page-head">
          <div className="sk sk-h1" />
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="sk sk-btn" />
            <div className="sk sk-btn" />
          </div>
        </div>
        <div className="sk sk-conv" style={{ marginBottom: 22 }} />
        <div className="divider-orange" style={{ opacity: 0.2, marginBottom: 20 }} />

        {/* Filters skeleton */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div className="sk" style={{ flex: 1, maxWidth: 340, height: 36, borderRadius: 6 }} />
          <div className="sk" style={{ width: 130, height: 36, borderRadius: 6 }} />
          <div className="sk" style={{ width: 130, height: 36, borderRadius: 6 }} />
          <div style={{ flex: 1 }} />
          <div className="sk" style={{ width: 100, height: 36, borderRadius: 6 }} />
        </div>

        {/* Table skeleton */}
        <div className="sk-table-wrap">
          <div className="sk-table-head">
            {[28, 130, 64, 60, 60, 60, 60, 60, 90].map((w, i) => (
              <div key={i} className="sk" style={{ width: w, height: 11, borderRadius: 3 }} />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, r) => (
            <div key={r} className="sk-table-row">
              <div className="sk" style={{ width: 22, height: 12, borderRadius: 3 }} />
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="sk" style={{ width: '55%', height: 13, borderRadius: 3 }} />
                <div className="sk" style={{ width: '38%', height: 10, borderRadius: 3 }} />
              </div>
              {[52, 46, 52, 46, 46, 46, 80].map((w, i) => (
                <div key={i} className="sk" style={{ width: w, height: 12, borderRadius: 3 }} />
              ))}
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="content ranking-main">
      <div className="page-head">
        <h1 className="page-title">Ranking</h1>
        <div className="actions">
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button className="btn outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <span className="ic">⭱</span> {uploading ? 'Calculando...' : 'Calcular con antecedentes'}
          </button>
          <button className="btn outline">
            <span className="ic">⭳</span> Descargar planilla
          </button>
        </div>
      </div>

      <div className="conv-row">
        <span className="conv-label">Convocatoria Activa</span>
        <span className="badge">Activo</span>
      </div>

      <div className="divider-orange" />

      <p className="updated" style={{ color: 'var(--text-gray)', fontSize: '13px', margin: '0 0 20px 0' }}>
        Resultados totales: {resultados.length} estudiantes
      </p>

      <div className="filters">
        <input type="text" placeholder="Buscar por nombre, legajo o DNI" />
        <div className="select-like">
          Todos los tipos
          <svg viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </div>
        <div className="select-like">
          Todas las carreras
          <svg viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </div>
        <div className="spacer"></div>
        <div className="select-like columns-select">
          Columnas
          <svg viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Estudiante</th>
              <th>Carrera</th>
              <th>Promedio</th>
              <th>Factor (Puntaje)</th>
              <th>Cursadas</th>
              <th>Aprobadas</th>
              <th>Aplazos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {resultados.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>No hay resultados de ranking cargados. Usa "Cargar orden de mérito".</td>
              </tr>
            ) : (
              resultados.sort((a, b) => Number(b.puntajeTotal) - Number(a.puntajeTotal)).map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>
                    <p className="student-name">{r.padron?.nombreCompleto}</p>
                    <p className="student-meta">DNI: {r.padron?.dni} - Leg. {r.padron?.legajo}</p>
                  </td>
                  <td>-</td>
                  <td>{r.padron?.promedio}</td>
                  <td className="factor-cell">{Number(r.puntajeTotal).toFixed(2)}</td>
                  <td>{r.padron?.regularizadas}</td>
                  <td>{r.padron?.aprobadas}</td>
                  <td>{r.padron?.aplazos}</td>
                  <td>
                    <button className="ver-ficha">Ver ficha</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
