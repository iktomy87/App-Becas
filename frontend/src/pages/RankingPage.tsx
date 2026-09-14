import './RankingPage.css';
import './PanelPrincipal.css';
import { useState, useEffect } from 'react';

export function RankingPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: reemplazar por fetch real al endpoint de ranking
    const timer = setTimeout(() => setLoading(false), 0);
    return () => clearTimeout(timer);
  }, []);

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
          <button className="btn solid">
            <span className="ic">⭱</span> Cargar inscripciones
          </button>
          <button className="btn outline">
            <span className="ic">⭳</span> Descargar planilla
          </button>
        </div>
      </div>

      <div className="conv-row">
        <span className="conv-label">Convocatoria 202x — Cierre: 20/06/2028</span>
        <span className="badge">Activo</span>
      </div>

      <div className="divider-orange" />

      <p className="updated" style={{ color: 'var(--text-gray)', fontSize: '13px', margin: '0 0 20px 0' }}>
        Última actualización: 20/06/2028
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
              <th>Factor</th>
              <th>Cursadas</th>
              <th>Aprobadas</th>
              <th>Aplazos</th>
              <th>Prioridades</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <p className="student-name">Brizuela Silvestri, Yoel Elián</p>
                <p className="student-meta">DNI: 44154651 - Leg. 27055</p>
              </td>
              <td>ISI</td>
              <td>7,81</td>
              <td className="factor-cell">17,30</td>
              <td>46</td>
              <td>42</td>
              <td>0</td>
              <td>
                <div className="priorities">
                  <div>1° - 112618324505568</div>
                  <div>2° - 11051121314338064</div>
                  <div>3° - 1112121953573970</div>
                  <div>4° - 1128111635975267</div>
                  <div>5° - 1125100938631176</div>
                </div>
                <button className="ver-ficha">Ver ficha</button>
              </td>
            </tr>
            <tr className="empty-row"><td colSpan={9}></td></tr>
            <tr className="empty-row"><td colSpan={9}></td></tr>
            <tr className="empty-row"><td colSpan={9}></td></tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
