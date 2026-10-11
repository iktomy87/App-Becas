import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { propuestasService } from '../services/propuestas.service';
import { convocatoriasService } from '../services/convocatorias.service';
import { seleccionarConvocatoriaActiva } from '../hooks/convocatoriaActiva';
import type { Convocatoria, Propuesta } from '../services/types';
import './PropuestasPage.css';
import './PanelPrincipal.css';

// Filas por página: las filas de propuestas son compactas (como las del
// ranking, a diferencia de las inscripciones que muestran prioridades).
const PAGE_SIZE = 50;

const TIPO_LABEL: Record<string, string> = {
  SERVICIO:      'Servicio',
  INVESTIGACION: 'Investigación',
};

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR:  'Borrador',
  PUBLICADA: 'Publicada',
};

export function PropuestasPage() {
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [qAplicada, setQAplicada] = useState('');
  const [convocatoria, setConvocatoria] = useState<Convocatoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  // Se incrementa tras una importación para forzar la recarga de la tabla
  // aunque la página y la búsqueda aplicada no hayan cambiado.
  const [revision, setRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolver la convocatoria activa con la misma regla que usan el panel,
  // `/inscripciones` y `/ranking`.
  useEffect(() => {
    let cancelled = false;
    async function resolver() {
      try {
        const conv = seleccionarConvocatoriaActiva(
          await convocatoriasService.listar(),
        );
        if (cancelled) return;
        setConvocatoria(conv ?? null);
        // Sin convocatoria no se dispara el fetch de datos que bajaría `loading`.
        if (!conv) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar propuestas',
          );
          setLoading(false);
        }
      }
    }
    void resolver();
    return () => { cancelled = true; };
  }, []);

  // La búsqueda se aplica recién con Enter (no en cada tecla): el fetch sigue
  // usando la última búsqueda aplicada hasta que el usuario la confirme. Al
  // aplicarla se vuelve a la primera página porque es un conjunto nuevo.
  const aplicarBusqueda = () => {
    setQAplicada(q.trim());
    setPage(1);
  };

  // Cargar la página actual de propuestas de la convocatoria (pagina en el
  // backend, igual que `/inscripciones` y `/ranking`).
  useEffect(() => {
    if (!convocatoria) return;
    const convId = convocatoria.id;
    let cancelled = false;
    async function cargar() {
      setLoading(true);
      try {
        const res = await propuestasService.listar(
          convId,
          page,
          PAGE_SIZE,
          qAplicada,
        );
        if (cancelled) return;
        setPropuestas(res.data);
        setTotal(res.total);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar propuestas',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void cargar();
    return () => { cancelled = true; };
  }, [convocatoria, page, qAplicada, revision]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Importar las propuestas desde el XLS de solicitudes del backend.
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !convocatoria) return;

    setImportando(true);
    try {
      const res = await propuestasService.importarXls(convocatoria.id, file);
      alert(
        `Solicitudes importadas: ${res.importadas} propuestas nuevas.`,
      );
      // Volver a la primera página y limpiar búsquedas para ver las nuevas.
      setPage(1);
      setQAplicada('');
      setQ('');
      setRevision((r) => r + 1);
    } catch (err) {
      const mensaje =
        err instanceof Error && err.message ? err.message : 'falló la carga';
      alert(`Error al importar: ${mensaje}`);
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="content propuestas-page">
        {/* Header skeleton */}
        <div className="page-head">
          <div className="sk sk-h1" />
        </div>
        <div className="sk sk-conv" style={{ marginBottom: 22 }} />
        <div className="divider-orange" style={{ opacity: 0.2, marginBottom: 20 }} />

        {/* Filters skeleton */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div className="sk" style={{ flex: 1, maxWidth: 340, height: 36, borderRadius: 6 }} />
          <div style={{ flex: 1 }} />
          <div className="sk" style={{ width: 160, height: 36, borderRadius: 20 }} />
        </div>

        {/* Table skeleton */}
        <div className="sk-table-wrap">
          <div className="sk-table-head">
            {[60, 180, 90, 140, 80, 120, 90].map((w, i) => (
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
    return <div className="propuestas-page"><p className="error-text">⚠ {error}</p></div>;
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
    <main className="content propuestas-page">
      {/* Encabezado */}
      <div className="page-head">
        <h1 className="page-title">Propuestas</h1>
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
        Total de propuestas cargadas: {total}
      </p>

      {/* Barra de filtros */}
      <div className="filters">
        <input
          type="text"
          placeholder="Buscar por código, título o responsable (Enter)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') aplicarBusqueda();
          }}
        />
        <div className="spacer"></div>
        <input
          type="file"
          accept=".xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <button
          className="btn outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importando || !convocatoria}
        >
          <span className="ic">⭱</span>
          {importando ? 'Importando...' : 'Importar solicitudes (XLSX)'}
        </button>
      </div>

      {/* Tabla de propuestas */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Título</th>
              <th>Tipo</th>
              <th>Responsable</th>
              <th>Vacantes</th>
              <th>Especialidades</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {propuestas.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-message">
                  {qAplicada
                    ? `Sin resultados para «${qAplicada}»`
                    : 'No hay propuestas cargadas. Importá el archivo de solicitudes (XLSX) para crearlas.'}
                </td>
              </tr>
            ) : (
              propuestas.map((p) => (
                <tr key={p.id}>
                  <td>
                    <p className="student-name">{p.idExterno}</p>
                  </td>
                  <td title={`Propuesta ${p.idExterno}`}>
                    <p className="student-name">{p.titulo || '—'}</p>
                    {p.dependencia && (
                      <p className="student-meta">{p.dependencia}</p>
                    )}
                  </td>
                  <td>{TIPO_LABEL[p.tipo] ?? p.tipo}</td>
                  <td>
                    <p className="student-name">{p.responsableNombre || '—'}</p>
                    {p.responsableEmail && (
                      <p className="student-meta">{p.responsableEmail}</p>
                    )}
                  </td>
                  <td>
                    {p.vacantesDisponibles} / {p.vacantesTotal}
                  </td>
                  <td>{p.especialidades ?? '—'}</td>
                  <td>
                    <span className={`estado-badge ${p.estado.toLowerCase()}`}>
                      {ESTADO_LABEL[p.estado] ?? p.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="paginacion">
        <button
          className="btn outline"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ← Anterior
        </button>
        <span>
          Página {page} de {totalPaginas} · {total}{' '}
          {total === 1 ? 'propuesta' : 'propuestas'}
        </span>
        <button
          className="btn outline"
          disabled={page >= totalPaginas}
          onClick={() => setPage(page + 1)}
        >
          Siguiente →
        </button>
      </div>
    </main>
  );
}