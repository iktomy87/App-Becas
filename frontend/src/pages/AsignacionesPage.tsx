import { useState, useEffect } from 'react';
import { asignacionService } from '../services/asignacion.service';
import { convocatoriasService } from '../services/convocatorias.service';
import { seleccionarConvocatoriaActiva } from '../hooks/convocatoriaActiva';
import type {
  AsignacionResumen,
  Convocatoria,
  ResultadoAsignacion,
  TipoPropuesta,
} from '../services/types';
import './AsignacionesPage.css';
import './PanelPrincipal.css';

// Las filas son compactas; con 166 postulantes una página de 25 deja ver bien
// cada sección sin scroll eterno.
const PAGE_SIZE = 25;

const TIPO_LABEL: Record<TipoPropuesta, string> = {
  SERVICIO: 'Servicio',
  INVESTIGACION: 'Investigación',
};

const BADGE_LABEL: Record<string, string> = {
  ABIERTA: 'Activo',
  CERRADA: 'Cerrado',
  EN_RANKING: 'En ranking',
  ASIGNADA: 'Asignada',
};

/** El padrón guarda `"Apellido, Nombre"` con las comillas CSV del maestro. */
function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/^"+|"+$/g, '');
}

export function AsignacionesPage() {
  const [convocatoria, setConvocatoria] = useState<Convocatoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  // Sin corrida vigente no hay nada que mostrar (sí se puede ejecutar).
  const [sinCorrida, setSinCorrida] = useState(false);
  // Se incrementa tras ejecutar la asignación para forzar la recarga de ambas
  // secciones aunque la página y el estado no hayan cambiado.
  const [revision, setRevision] = useState(0);

  const [resumen, setResumen] = useState<AsignacionResumen | null>(null);

  const [asignados, setAsignados] = useState<ResultadoAsignacion[]>([]);
  const [totalAsig, setTotalAsig] = useState(0);
  const [pageAsig, setPageAsig] = useState(1);

  const [noAsignados, setNoAsignados] = useState<ResultadoAsignacion[]>([]);
  const [totalNoAsig, setTotalNoAsig] = useState(0);
  const [pageNoAsig, setPageNoAsig] = useState(1);

  // Id del resultado que se está removiendo (deshabilita su botón mientras tanto).
  const [removiendo, setRemoviendo] = useState<string | null>(null);

  // Resolver la convocatoria activa con la misma regla que las demás pantallas.
  useEffect(() => {
    let cancelled = false;
    async function resolver() {
      try {
        const conv = seleccionarConvocatoriaActiva(
          await convocatoriasService.listar(),
        );
        if (cancelled) return;
        setConvocatoria(conv ?? null);
        if (!conv) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar asignaciones',
          );
          setLoading(false);
        }
      }
    }
    void resolver();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sección Asignados (determina también el resumen y el estado "sin corrida").
  useEffect(() => {
    if (!convocatoria) return;
    const convId = convocatoria.id;
    let cancelled = false;
    async function cargar() {
      try {
        const res = await asignacionService.listar(
          convId,
          pageAsig,
          PAGE_SIZE,
          'ASIGNADO',
        );
        if (cancelled) return;
        if (!res) {
          setSinCorrida(true);
          setAsignados([]);
          setTotalAsig(0);
          return;
        }
        setSinCorrida(false);
        setResumen(res.resumen);
        setAsignados(res.data);
        setTotalAsig(res.total);
        // Si tras quitar un asignado la última página quedó vacía, retroceder.
        if (res.total > 0 && res.data.length === 0 && pageAsig > 1) {
          setPageAsig(pageAsig - 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar asignaciones',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void cargar();
    return () => {
      cancelled = true;
    };
  }, [convocatoria, pageAsig, revision]);

  // Sección No asignados (paginación independiente de la anterior).
  useEffect(() => {
    if (!convocatoria) return;
    const convId = convocatoria.id;
    let cancelled = false;
    async function cargar() {
      try {
        const res = await asignacionService.listar(
          convId,
          pageNoAsig,
          PAGE_SIZE,
          'NO_ASIGNADO',
        );
        if (cancelled) return;
        if (!res) {
          setNoAsignados([]);
          setTotalNoAsig(0);
          return;
        }
        setResumen(res.resumen);
        setNoAsignados(res.data);
        setTotalNoAsig(res.total);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar asignaciones',
          );
        }
      }
    }
    void cargar();
    return () => {
      cancelled = true;
    };
  }, [convocatoria, pageNoAsig, revision]);

  const ejecutar = async () => {
    if (!convocatoria) return;
    if (
      !confirm(
        '¿Ejecutar la asignación? Se invalida la corrida anterior y se vuelve a asignar a todos los postulantes.',
      )
    )
      return;
    setEjecutando(true);
    try {
      const res = await asignacionService.ejecutar(convocatoria.id);
      alert(
        `Asignación ejecutada: ${res.asignados} asignados, ${res.noAsignados} no asignados.`,
      );
      setPageAsig(1);
      setPageNoAsig(1);
      setRevision((r) => r + 1);
    } catch (err) {
      const mensaje =
        err instanceof Error && err.message ? err.message : 'falló';
      alert(`Error al ejecutar la asignación: ${mensaje}`);
    } finally {
      setEjecutando(false);
    }
  };

  const descargar = () => {
    if (convocatoria) asignacionService.descargarReporte(convocatoria.id);
  };

  // Quitar a un asignado de su área: el backend libera la vacante e intenta
  // ubicarlo en otra de sus preferencias; si no hay cupo, queda NO asignado.
  const remover = async (r: ResultadoAsignacion) => {
    if (!convocatoria) return;
    const nombre = limpiarNombre(r.padron?.nombreCompleto ?? '') || 'el estudiante';
    const area = r.propuesta?.dependencia || r.propuesta?.titulo || 'su área';
    if (
      !confirm(
        `¿Eliminar la asignación de ${nombre} en "${area}"?\n\n` +
          'Se intentará reasignarlo a otra de sus preferencias. Si no hay cupo ' +
          'en ninguna, quedará como NO asignado.',
      )
    )
      return;

    setRemoviendo(r.id);
    try {
      const res = await asignacionService.remover(convocatoria.id, r.id);
      if (res.estado === 'ASIGNADO') {
        const nueva =
          res.propuesta?.dependencia || res.propuesta?.titulo || 'otra área';
        alert(
          `${nombre} fue reasignado a "${nueva}" (preferencia ${res.preferenciaSatisfecha}).`,
        );
      } else {
        alert(
          `${nombre} quedó como NO asignado: no había cupo en sus otras preferencias.`,
        );
      }
      setRevision((v) => v + 1);
    } catch (err) {
      const mensaje = err instanceof Error && err.message ? err.message : 'falló';
      alert(`Error al eliminar la asignación: ${mensaje}`);
    } finally {
      setRemoviendo(null);
    }
  };

  const totalPaginasAsig = Math.max(1, Math.ceil(totalAsig / PAGE_SIZE));
  const totalPaginasNoAsig = Math.max(1, Math.ceil(totalNoAsig / PAGE_SIZE));

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="content asignaciones-page">
        <div className="page-head">
          <div className="sk sk-h1" />
        </div>
        <div className="sk sk-conv" style={{ marginBottom: 22 }} />
        <div className="divider-orange" style={{ opacity: 0.2, marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[140, 140, 140].map((w, i) => (
            <div key={i} className="sk" style={{ width: w, height: 72, borderRadius: 10 }} />
          ))}
        </div>
        <div className="sk-table-wrap">
          <div className="sk-table-head">
            {[80, 80, 240, 200, 90].map((w, i) => (
              <div key={i} className="sk" style={{ width: w, height: 11, borderRadius: 3 }} />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="sk-table-row">
              {[70, 60, 220, 180, 70].map((w, i) => (
                <div key={i} className="sk" style={{ width: w, height: 12, borderRadius: 3 }} />
              ))}
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <div className="asignaciones-page">
        <p className="error-text">⚠ {error}</p>
      </div>
    );
  }

  const convLabel = convocatoria
    ? `${convocatoria.nombre} — Cierre: ${new Date(convocatoria.fechaCierre).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    : 'Sin convocatoria activa';

  return (
    <main className="content asignaciones-page">
      {/* Encabezado */}
      <div className="page-head">
        <h1 className="page-title">Asignaciones</h1>
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

      {/* Resumen de la corrida */}
      {resumen && (
        <div className="asig-summary">
          <div className="asig-stat">
            <span className="asig-stat-num">{resumen.totalPostulantes}</span>
            <span className="asig-stat-label">Postulantes</span>
          </div>
          <div className="asig-stat">
            <span className="asig-stat-num ok">{resumen.totalAsignados}</span>
            <span className="asig-stat-label">Asignados</span>
          </div>
          <div className="asig-stat">
            <span className="asig-stat-num warn">{resumen.totalNoAsignados}</span>
            <span className="asig-stat-label">No asignados</span>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="asig-actions">
        <button
          className="btn solid"
          onClick={ejecutar}
          disabled={ejecutando || !convocatoria}
        >
          <span className="ic">▶</span>
          {ejecutando ? 'Ejecutando...' : 'Ejecutar asignación'}
        </button>
        <button
          className="btn outline"
          onClick={descargar}
          disabled={!convocatoria || sinCorrida}
        >
          <span className="ic">⭳</span>
          Descargar Excel
        </button>
      </div>

      {!convocatoria ? (
        <div className="asig-empty">
          No hay una convocatoria activa. Creá o abrí una convocatoria para
          ejecutar la asignación.
        </div>
      ) : sinCorrida ? (
        <div className="asig-empty">
          Todavía no se ejecutó la asignación para esta convocatoria. Volvé a
          importar solicitudes e inscripciones y ejecutá la asignación.
        </div>
      ) : (
        <>
          {/* Sección Asignados */}
          <h2 className="section-title">
            Asignados <span className="section-count">{totalAsig}</span>
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Legajo</th>
                  <th>Apellido y Nombre</th>
                  <th>Área / Proyecto</th>
                  <th>Tipo</th>
                  <th>Pref.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {asignados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-message">
                      No hay estudiantes asignados.
                    </td>
                  </tr>
                ) : (
                  asignados.map((r) => (
                    <tr key={r.id}>
                      <td>{r.padron?.dni ?? '—'}</td>
                      <td>{r.padron?.legajo ?? '—'}</td>
                      <td>
                        <p className="student-name">
                          {limpiarNombre(r.padron?.nombreCompleto ?? '')}
                        </p>
                      </td>
                      <td>
                        <p className="student-name">
                          {r.propuesta?.dependencia ||
                            r.propuesta?.titulo ||
                            '—'}
                        </p>
                        {r.propuesta?.idExterno && (
                          <p className="student-meta">
                            Cód. {r.propuesta.idExterno}
                          </p>
                        )}
                      </td>
                      <td>
                        {r.propuesta ? TIPO_LABEL[r.propuesta.tipo] : '—'}
                      </td>
                      <td>{r.preferenciaSatisfecha ?? '—'}</td>
                      <td>
                        <button
                          className="btn-quitar"
                          onClick={() => remover(r)}
                          disabled={removiendo === r.id}
                          title="Eliminar al estudiante de esta área y reubicarlo"
                        >
                          {removiendo === r.id ? 'Quitando…' : 'Eliminar'}
                        </button>
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
              disabled={pageAsig <= 1}
              onClick={() => setPageAsig(pageAsig - 1)}
            >
              ← Anterior
            </button>
            <span>
              Página {pageAsig} de {totalPaginasAsig} · {totalAsig}{' '}
              {totalAsig === 1 ? 'asignado' : 'asignados'}
            </span>
            <button
              className="btn outline"
              disabled={pageAsig >= totalPaginasAsig}
              onClick={() => setPageAsig(pageAsig + 1)}
            >
              Siguiente →
            </button>
          </div>

          {/* Sección No asignados */}
          <h2 className="section-title">
            No asignados <span className="section-count warn">{totalNoAsig}</span>
          </h2>
          <p className="section-hint">
            Postulantes que no obtuvieron ninguna de sus preferencias por falta
            de vacantes.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Legajo</th>
                  <th>Apellido y Nombre</th>
                </tr>
              </thead>
              <tbody>
                {noAsignados.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-message">
                      No hay estudiantes sin asignar.
                    </td>
                  </tr>
                ) : (
                  noAsignados.map((r) => (
                    <tr key={r.id}>
                      <td>{r.padron?.dni ?? '—'}</td>
                      <td>{r.padron?.legajo ?? '—'}</td>
                      <td>
                        <p className="student-name">
                          {limpiarNombre(r.padron?.nombreCompleto ?? '')}
                        </p>
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
              disabled={pageNoAsig <= 1}
              onClick={() => setPageNoAsig(pageNoAsig - 1)}
            >
              ← Anterior
            </button>
            <span>
              Página {pageNoAsig} de {totalPaginasNoAsig} · {totalNoAsig}{' '}
              {totalNoAsig === 1 ? 'no asignado' : 'no asignados'}
            </span>
            <button
              className="btn outline"
              disabled={pageNoAsig >= totalPaginasNoAsig}
              onClick={() => setPageNoAsig(pageNoAsig + 1)}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </main>
  );
}