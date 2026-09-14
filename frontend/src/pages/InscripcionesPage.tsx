import { useState, useEffect } from 'react';
import { importacionService } from '../services/importacion.service';
import { convocatoriasService } from '../services/convocatorias.service';
import type { Convocatoria } from '../services/types';
import './InscripcionesPage.css';
import './PanelPrincipal.css';

export function InscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<any[]>([]);
  const [convocatoria, setConvocatoria] = useState<Convocatoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const convocatorias = await convocatoriasService.listar();
        const activa = convocatorias.find(
          (c) => c.estado === 'ABIERTA' || c.estado === 'EN_RANKING',
        ) ?? convocatorias[0] ?? null;

        if (cancelled) return;
        setConvocatoria(activa);

        if (activa) {
          const data = await importacionService.listarInscripciones(activa.id);
          if (!cancelled) setInscripciones(data || []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar inscripciones');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);


  if (loading) {
    return (
      <main className="content inscripciones-page">
        {/* Header skeleton */}
        <div className="page-head">
          <div className="sk sk-h1" />
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
            {[120, 80, 70, 70, 70, 70, 90, 70].map((w, i) => (
              <div key={i} className="sk" style={{ width: w, height: 11, borderRadius: 3 }} />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, r) => (
            <div key={r} className="sk-table-row">
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="sk" style={{ width: '60%', height: 13, borderRadius: 3 }} />
                <div className="sk" style={{ width: '40%', height: 10, borderRadius: 3 }} />
              </div>
              {[70, 56, 46, 46, 46, 80, 64].map((w, i) => (
                <div key={i} className="sk" style={{ width: w, height: 12, borderRadius: 3 }} />
              ))}
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return <div className="inscripciones-page"><p className="error-text">⚠ {error}</p></div>;
  }

  const convLabel = convocatoria
    ? `${convocatoria.nombre} — Cierre: ${new Date(convocatoria.fechaCierre).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    : 'Sin convocatoria activa';

  const BADGE_LABEL: Record<string, string> = {
    ABIERTA:    'Activo',
    CERRADA:    'Cerrado',
    EN_RANKING: 'En ranking',
    ASIGNADA:   'Asignada',
  };

  return (
    <main className="content inscripciones-page">
      {/* Encabezado */}
      <div className="page-head">
        <h1 className="page-title">Inscripciones</h1>
      </div>

      {/* Convocatoria activa */}
      <div className="conv-row">
        <span className="conv-label">{convLabel}</span>
        {convocatoria && (
          <span className="badge">
            {BADGE_LABEL[convocatoria.estado] ?? convocatoria.estado}
          </span>
        )}
      </div>

      <div className="divider-orange" />

      <p className="updated" style={{ color: 'var(--text-gray)', fontSize: '13px', margin: '0 0 20px 0' }}>
        Total de inscripciones cargadas: {inscripciones.length}
      </p>

      {/* Barra de filtros */}
      <div className="filters">
        <input type="text" placeholder="Buscar por nombre, legajo o DNI" />
        <select className="select-like">
          <option>Todos los tipos</option>
        </select>
        <select className="select-like">
          <option>Todas las carreras</option>
        </select>
        <div className="spacer"></div>
        <select className="select-like columns-select">
          <option>Columnas</option>
        </select>
      </div>

      {/* Tabla de Datos */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Carrera</th>
              <th>Promedio</th>
              <th>Cursadas</th>
              <th>Aprobadas</th>
              <th>Aplazos</th>
              <th>Prioridades</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inscripciones.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-message">No hay inscripciones para mostrar.</td>
              </tr>
            ) : (
              inscripciones.map((insc) => (
                <tr key={insc.id}>
                  <td>
                    <p className="student-name">{insc.nombreCompleto}</p>
                    <p className="student-meta">DNI {insc.dni} - Leg. {insc.legajo}</p>
                  </td>
                  <td>{insc.especialidadCodigo ?? '—'}</td>
                  <td>{insc.promedio != null ? Number(insc.promedio).toFixed(2).replace('.', ',') : '—'}</td>
                  <td>{insc.cursando ?? '—'}</td>
                  <td>{insc.aprobadas ?? '—'}</td>
                  <td>{insc.aplazos ?? '—'}</td>
                  <td>
                    <div className="priorities">
                      {(insc.postulaciones || []).map((p: any) => (
                        <div key={p.id}>
                          {p.ordenPreferencia}° - {p.propuesta?.idExterno || p.propuestaId}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="actions-cell">
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

