import './RankingPage.css';
import './PanelPrincipal.css';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { rankingService } from '../services/ranking.service';
import { convocatoriasService } from '../services/convocatorias.service';
import { especialidadesService } from '../services/especialidades.service';
import { seleccionarConvocatoriaActiva } from '../hooks/convocatoriaActiva';
import type { Convocatoria, Especialidad, ResultadoRanking } from '../services/types';

export function RankingPage() {
  const { convocatoriaId: paramId } = useParams();
  const [convocatoria, setConvocatoria] = useState<Convocatoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resultados, setResultados] = useState<ResultadoRanking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [qAplicada, setQAplicada] = useState('');
  const [carrera, setCarrera] = useState('');
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convocatoriaId = convocatoria?.id;

  // La ruta `/ranking` no declara `:convocatoriaId`, así que `useParams()` llega
  // vacío. Antes esto caía a un UUID hardcodeado que no existe en la base: la
  // API respondía 200 con `data: []` —sin ningún error— y la página mostraba
  // "no hay resultados" para siempre. Ahora se resuelve la convocatoria activa
  // con la misma regla que usa el panel principal, o la de la URL si algún día
  // se navega con parámetro.
  useEffect(() => {
    let cancelled = false;

    async function resolver() {
      try {
        const conv = paramId
          ? await convocatoriasService.obtener(paramId)
          : seleccionarConvocatoriaActiva(await convocatoriasService.listar());
        if (cancelled) return;
        setConvocatoria(conv ?? null);
        // Sin convocatoria no va a haber fetch de ranking que baje `loading`.
        if (!conv) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setLoading(false);
        }
      }
    }

    void resolver();
    return () => { cancelled = true; };
  }, [paramId]);

  // Filas por página: las filas de ranking son compactas; 50 sigue el default
  // del backend (que ya paginaba el endpoint pero la pantalla pedía 1000).
  const PAGE_SIZE = 50;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Opciones del dropdown de carrera, desde el catálogo del backend. Si el GET
  // falla el dropdown queda solo con "Todas las carreras" (no tumba la página).
  useEffect(() => {
    let cancelled = false;
    async function cargarEspecialidades() {
      try {
        const es = await especialidadesService.listar();
        if (!cancelled) setEspecialidades(es);
      } catch {
        // sin opciones de carrera
      }
    }
    void cargarEspecialidades();
    return () => { cancelled = true; };
  }, []);

  // La búsqueda se aplica recién con Enter (no en cada tecla): el fetch sigue
  // usando la última búsqueda aplicada hasta que el usuario la confirme. Al
  // aplicarla se vuelve a la primera página porque es un conjunto nuevo.
  const aplicarBusqueda = () => {
    setQAplicada(q.trim());
    setPage(1);
  };

  const fetchRanking = async () => {
    if (!convocatoriaId) return;
    setLoading(true);
    try {
      const res = await rankingService.listar(
        convocatoriaId,
        page,
        PAGE_SIZE,
        qAplicada,
        carrera,
      );
      setResultados(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRanking();
  }, [convocatoriaId, page, qAplicada, carrera]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !convocatoriaId) return;
    
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
          <button className="btn outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || !convocatoriaId}>
            <span className="ic">⭱</span> {uploading ? 'Calculando...' : 'Calcular con antecedentes'}
          </button>
          <button className="btn outline">
            <span className="ic">⭳</span> Descargar planilla
          </button>
        </div>
      </div>

      <div className="conv-row">
        <span className="conv-label">
          {convocatoria ? convocatoria.nombre : 'Sin convocatoria activa'}
        </span>
        {convocatoria && <span className="badge">Activo</span>}
      </div>

      <div className="divider-orange" />

      <p className="updated" style={{ color: 'var(--text-gray)', fontSize: '13px', margin: '0 0 20px 0' }}>
        Resultados totales: {total} estudiantes
      </p>

      <div className="filters">
        <input
          type="text"
          placeholder="Buscar por nombre, legajo o DNI (Enter)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') aplicarBusqueda();
          }}
        />
        <div className="select-like">
          Todos los tipos
          <svg viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </div>
        <select
          className="select-like"
          value={carrera}
          onChange={(e) => {
            setCarrera(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por carrera"
        >
          <option value="">Todas las carreras</option>
          {especialidades.map((es) => (
            <option key={es.codigo} value={String(es.codigo)}>
              {es.nombre} (Esp. {es.codigo})
            </option>
          ))}
        </select>
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>
                  {qAplicada
                    ? `Sin resultados para «${qAplicada}»`
                    : carrera
                      ? 'Sin resultados para la carrera seleccionada.'
                      : 'No hay resultados de ranking cargados. Usa "Cargar orden de mérito".'}
                </td>
              </tr>
            ) : (
              resultados.map((r) => (
                <tr key={r.id}>
                  {/* La posición la calcula el backend al desempatar; antes se
                      re-ordenaba en el cliente y se pintaba el índice del
                      array, que no coincide con el ranking real. */}
                  <td>{r.posicion ?? '—'}</td>
                  <td>
                    <p className="student-name">{r.padron?.nombreCompleto}</p>
                    <p className="student-meta">DNI: {r.padron?.dni} - Leg. {r.padron?.legajo}</p>
                  </td>
                  <td>
                    {r.padron?.especialidad
                      ?? (r.padron?.especialidadCodigo != null
                        ? `Esp. ${r.padron.especialidadCodigo}`
                        : '—')}
                  </td>
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
          {total === 1 ? 'estudiante' : 'estudiantes'}
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
