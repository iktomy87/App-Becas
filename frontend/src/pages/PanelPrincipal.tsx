import './PanelPrincipal.css';
import { useState, useCallback }           from 'react';
import { createPortal }                    from 'react-dom';
import { usePanelPrincipal }             from '../hooks/usePanelPrincipal';
import { RankingTable, type RankingRow } from '../components/RankingTable';
import { StatCard }                      from '../components/StatCard';
import { DropzoneOverlay }               from '../components/DropzoneOverlay';
import type { ResultadoRanking }         from '../services/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRankingRow(r: ResultadoRanking): RankingRow {
  return {
    posicion: r.posicion ?? 0,
    nombre:   r.padron.nombreCompleto,
    dni:      r.padron.dni,
    legajo:   r.padron.legajo,
    carrera:  r.padron.especialidadCodigo?.toString() ?? '—',
    promedio: Number(r.padron.promedio).toFixed(2).replace('.', ','),
    factor:   Number(r.puntajeTotal).toFixed(2).replace('.', ','),
    prioridades: (r.postulaciones ?? []).map((p) => ({
      orden:       p.ordenPreferencia,
      propuestaId: p.propuestaId,
    })),
  };
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const BADGE_LABEL: Record<string, string> = {
  ABIERTA:    'Activo',
  CERRADA:    'Cerrado',
  EN_RANKING: 'En ranking',
  ASIGNADA:   'Asignada',
};

// ── Handler de módulo (sin estado) ────────────────────────────────────────────

function handleVerFicha(row: RankingRow) {
  console.warn('Ver ficha — pendiente de implementación', row.nombre);
}

// ── Componente ────────────────────────────────────────────────────────────────

export function PanelPrincipal() {
  const [dropzoneOpen, setDropzoneOpen] = useState(false);
  const [uploadType, setUploadType]     = useState<'planilla' | 'padron'>('planilla');
  const [uploading, setUploading]       = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; isError: boolean } | null>(null);

  const {
    convocatoria, ranking, rankingTotal, cargas, loading, error,
    cargarPlanilla, cargarPadron, uploadProgress
  } = usePanelPrincipal();

  const cargaVigente   = cargas.find((c) => c.vigente);
  const totalPlanillas = cargas.length;

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      if (uploadType === 'padron') {
        const res = await cargarPadron(file);
        setNotification({
          title: 'Padrón cargado',
          message: res?.mensaje || 'Se ha cargado el padrón correctamente.',
          isError: false,
        });
      } else {
        const res = await cargarPlanilla(file);
        if (res?.filasValidas > 0 && res?.filasError === 0) {
          setNotification({
            title: 'Planilla procesada con éxito',
            message: `Se procesaron ${res.filasValidas} filas correctamente.`,
            isError: false,
          });
        } else if (res?.filasValidas > 0 && res?.filasError > 0) {
          setNotification({
            title: 'Planilla procesada con errores',
            message: `Se procesaron ${res.filasValidas} filas, pero ${res.filasError} tuvieron errores y fueron descartadas.`,
            isError: true,
          });
        } else {
          setNotification({
            title: 'No se procesó ninguna fila',
            message: `Hubo ${res?.filasError ?? 0} errores. Asegurate de subir el padrón antes de cargar inscripciones.`,
            isError: true,
          });
        }
      }
    } catch (err: any) {
      setNotification({
        title: 'Error al procesar el archivo',
        message: err.message || 'No se pudo completar la operación.',
        isError: true,
      });
    } finally {
      setUploading(false);
    }
  }, [uploadType, cargarPadron, cargarPlanilla]);

  // ── Estados de carga / error ──────────────────────────────────────────────

  // ── Portal: siempre visible, independiente del estado de carga ──────────

  const notificationPortal = notification && createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', padding: '32px 30px', borderRadius: '14px',
        maxWidth: '420px', width: '90%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontSize: '44px', marginBottom: '12px' }}>
          {notification.isError ? '❌' : '✅'}
        </div>
        <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: notification.isError ? '#e2574c' : '#15803d' }}>
          {notification.title}
        </h2>
        <p style={{ margin: '0 0 26px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
          {notification.message}
        </p>
        <button className="btn solid" style={{ padding: '8px 28px' }} onClick={() => setNotification(null)}>
          Cerrar
        </button>
      </div>
    </div>,
    document.body,
  );

  const uploadingPortal = uploading && createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9998,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, border: '5px solid rgba(255,255,255,0.3)',
        borderTop: '5px solid #fff', borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <p style={{ color: '#fff', fontWeight: 600, fontSize: '15px', margin: 0, textAlign: 'center' }}>
        Procesando archivo…<br/>
        {uploadProgress?.rowsProcessed ? <span style={{fontSize: '13px', fontWeight: 'normal', opacity: 0.8}}>({uploadProgress.rowsProcessed} filas)</span> : null}
      </p>
    </div>,
    document.body,
  );

  if (loading) {
    return (
      <>
        {notificationPortal}
        {uploadingPortal}
        <div className="content">
          <div className="page-head">
            <div className="sk sk-h1" />
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="sk sk-btn" />
              <div className="sk sk-btn" />
            </div>
          </div>
          <div className="sk sk-conv" style={{ marginBottom: 22 }} />
          <div className="divider-orange" style={{ opacity: 0.2, marginBottom: 26 }} />
          <div className="layout">
            <div className="col-main">
              <div className="sk-table-wrap">
                <div className="sk-table-head">
                  {[28, 120, 64, 60, 60, 60, 90, 70].map((w, i) => (
                    <div key={i} className="sk" style={{ width: w, height: 11, borderRadius: 3 }} />
                  ))}
                </div>
                {Array.from({ length: 7 }).map((_, r) => (
                  <div key={r} className="sk-table-row">
                    <div className="sk" style={{ width: 22, height: 12, borderRadius: 3 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="sk" style={{ width: '55%', height: 13, borderRadius: 3 }} />
                      <div className="sk" style={{ width: '38%', height: 10, borderRadius: 3 }} />
                    </div>
                    {[52, 46, 46, 46, 80, 64].map((w, i) => (
                      <div key={i} className="sk" style={{ width: w, height: 12, borderRadius: 3 }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="col-side">
              {[1, 2].map((i) => (
                <div key={i} className="sk-stat-card">
                  <div className="sk" style={{ width: '65%', height: 11, borderRadius: 3, marginBottom: 12 }} />
                  <div className="sk" style={{ width: 52, height: 30, borderRadius: 4, marginBottom: 10 }} />
                  <div className="sk" style={{ width: '80%', height: 10, borderRadius: 3 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {notificationPortal}
        <div className="content">
          <p style={{ color: '#e2574c' }}>⚠ {error}</p>
        </div>
      </>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const convLabel = convocatoria
    ? `${convocatoria.nombre} — Cierre: ${formatFecha(convocatoria.fechaCierre)}`
    : 'Sin convocatoria activa';

  return (
    <div className="content">

      {/* Overlay de arrastrar y soltar */}
      <DropzoneOverlay
        isOpen={dropzoneOpen}
        onClose={() => setDropzoneOpen(false)}
        onFile={handleFile}
        title={uploadType === 'padron' ? 'Soltá tu Padrón Académico (maestro.xlsx)' : 'Soltá tu planilla de inscripciones'}
        sub={uploadType === 'padron' ? 'O hacé clic para buscar el archivo maestro en tu equipo' : 'O hacé clic para buscar tu planilla en tu equipo'}
      />

      {notificationPortal}
      {uploadingPortal}

      {/* Encabezado */}
      <div className="page-head">
        <h1 className="page-title">Panel principal</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn outline"
            onClick={() => {
              setUploadType('padron');
              setDropzoneOpen(true);
            }}
          >
            <span className="ic">⭱</span> Cargar Maestro
          </button>
          <button
            className="btn solid"
            onClick={() => {
              setUploadType('planilla');
              setDropzoneOpen(true);
            }}
          >
            <span className="ic">⭱</span> Cargar inscripciones
          </button>
        </div>
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

      {/* Layout: tabla + sidebar */}
      <div className="layout">

        {/* Tabla de ranking */}
        <div className="col-main">
          {ranking.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              No hay datos de ranking para esta convocatoria.
            </p>
          ) : (
            <RankingTable
              rows={ranking.map(toRankingRow)}
              emptyRows={Math.max(0, 3 - ranking.length)}
              onVerFicha={handleVerFicha}
            />
          )}
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="col-side">
          <StatCard
            label="Postulantes en ranking"
            value={rankingTotal}
            sub={convocatoria ? `Convocatoria ${convocatoria.nombre}` : undefined}
          />
          <StatCard
            label="Planillas cargadas"
            value={totalPlanillas}
            sub={
              cargaVigente
                ? `Vigente: ${new Date(cargaVigente.createdAt).toLocaleString('es-AR')}`
                : 'Sin planilla vigente'
            }
          />
          {cargaVigente && (
            <StatCard
              label="Filas procesadas"
              value={cargaVigente.filasValidas}
              sub={`${cargaVigente.filasError} errores · ${cargaVigente.filasAdvertencia} advertencias`}
            />
          )}
        </div>

      </div>
    </div>
  );
}
