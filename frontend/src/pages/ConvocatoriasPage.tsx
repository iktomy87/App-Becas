import { useState, useEffect } from 'react';
import { convocatoriasService } from '../services/convocatorias.service';
import type { Convocatoria, CreateConvocatoriaDto, EstadoConvocatoria } from '../services/types';
import './ConvocatoriasPage.css';
import './PanelPrincipal.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const ESTADO_LABEL: Record<EstadoConvocatoria, string> = {
  ABIERTA:    'Abierta',
  CERRADA:    'Cerrada',
  EN_RANKING: 'En ranking',
  ASIGNADA:   'Asignada',
};

const ESTADO_CLASS: Record<EstadoConvocatoria, string> = {
  ABIERTA:    'badge-abierta',
  CERRADA:    'badge-cerrada',
  EN_RANKING: 'badge-ranking',
  ASIGNADA:   'badge-asignada',
};

// ─── Formulario modal ─────────────────────────────────────────────────────────

interface FormData {
  nombre:        string;
  fechaApertura: string;
  fechaCierre:   string;
}

const FORM_EMPTY: FormData = {
  nombre:        '',
  fechaApertura: '',
  fechaCierre:   '',
};

function toISODate(isoString: string) {
  return isoString ? isoString.slice(0, 10) : '';
}

interface ModalProps {
  editando: Convocatoria | null;
  onClose: () => void;
  onGuardado: () => void;
}

function ConvocatoriaModal({ editando, onClose, onGuardado }: ModalProps) {
  const [form, setForm] = useState<FormData>(
    editando
      ? {
          nombre:        editando.nombre,
          fechaApertura: toISODate(editando.fechaApertura),
          fechaCierre:   toISODate(editando.fechaCierre),
        }
      : FORM_EMPTY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim() || !form.fechaApertura || !form.fechaCierre) {
      setError('Completá todos los campos.');
      return;
    }
    if (form.fechaCierre <= form.fechaApertura) {
      setError('La fecha de cierre debe ser posterior a la de apertura.');
      return;
    }
    setSaving(true);
    try {
      const dto: CreateConvocatoriaDto = {
        nombre:        form.nombre.trim(),
        fechaApertura: new Date(form.fechaApertura).toISOString(),
        fechaCierre:   new Date(form.fechaCierre).toISOString(),
      };
      if (editando) {
        await convocatoriasService.actualizar(editando.id, dto);
      } else {
        await convocatoriasService.crear(dto);
      }
      onGuardado();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar la convocatoria.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">
            {editando ? 'Editar convocatoria' : 'Nueva convocatoria'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="conv-nombre">Nombre</label>
            <input
              id="conv-nombre"
              name="nombre"
              type="text"
              placeholder="Ej: Becas 2025 – 1er cuatrimestre"
              value={form.nombre}
              onChange={handleChange}
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="conv-apertura">Fecha de apertura</label>
              <input
                id="conv-apertura"
                name="fechaApertura"
                type="date"
                value={form.fechaApertura}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="conv-cierre">Fecha de cierre</label>
              <input
                id="conv-cierre"
                name="fechaCierre"
                type="date"
                value={form.fechaCierre}
                onChange={handleChange}
              />
            </div>
          </div>

          {error && <p className="form-error">⚠ {error}</p>}

          <div className="modal-footer">
            <button
              type="button"
              className="btn outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn solid"
              disabled={saving}
            >
              {saving ? 'Guardando…' : (editando ? 'Guardar cambios' : 'Crear convocatoria')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConvocatoriasPage() {
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [modalOpen, setModalOpen]         = useState(false);
  const [editando, setEditando]           = useState<Convocatoria | null>(null);
  const [q, setQ]                         = useState('');
  const [filtroEstado, setFiltroEstado]   = useState<EstadoConvocatoria | ''>('');

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await convocatoriasService.listar();
      setConvocatorias(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar convocatorias.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const handleNueva = () => {
    setEditando(null);
    setModalOpen(true);
  };

  const handleEditar = (conv: Convocatoria) => {
    setEditando(conv);
    setModalOpen(true);
  };

  const handleGuardado = () => {
    setModalOpen(false);
    setEditando(null);
    void cargar();
  };

  const handleCerrar = () => {
    setModalOpen(false);
    setEditando(null);
  };

  // ── Filtro local ──────────────────────────────────────────────────────────
  const filtradas = convocatorias.filter((c) => {
    const matchQ = q.trim() === '' ||
      c.nombre.toLowerCase().includes(q.toLowerCase());
    const matchEstado = filtroEstado === '' || c.estado === filtroEstado;
    return matchQ && matchEstado;
  });

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="content convocatorias-page">
        <div className="page-head">
          <div className="sk sk-h1" />
          <div className="sk sk-btn" />
        </div>
        <div className="sk sk-conv" style={{ marginBottom: 22 }} />
        <div className="divider-orange" style={{ opacity: 0.2, marginBottom: 20 }} />

        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div className="sk" style={{ flex: 1, maxWidth: 340, height: 36, borderRadius: 6 }} />
          <div className="sk" style={{ width: 150, height: 36, borderRadius: 6 }} />
        </div>

        <div className="sk-table-wrap">
          <div className="sk-table-head">
            {[180, 100, 110, 110, 90].map((w, i) => (
              <div key={i} className="sk" style={{ width: w, height: 11, borderRadius: 3 }} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, r) => (
            <div key={r} className="sk-table-row">
              <div className="sk" style={{ flex: 2, height: 14, borderRadius: 3 }} />
              {[90, 90, 90, 70].map((w, i) => (
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
      <main className="content convocatorias-page">
        <p className="error-text">⚠ {error}</p>
      </main>
    );
  }

  return (
    <main className="content convocatorias-page">
      {/* Encabezado */}
      <div className="page-head">
        <h1 className="page-title">Convocatorias</h1>
        <button className="btn solid" id="btn-nueva-convocatoria" onClick={handleNueva}>
          <span className="ic">＋</span> Nueva convocatoria
        </button>
      </div>

      <div className="divider-orange" />

      <p style={{ color: 'var(--text-gray)', fontSize: '13px', margin: '0 0 20px 0' }}>
        Total de convocatorias: {convocatorias.length}
      </p>

      {/* Filtros */}
      <div className="filters">
        <input
          type="text"
          id="conv-busqueda"
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="select-like"
          id="conv-filtro-estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoConvocatoria | '')}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="ABIERTA">Abierta</option>
          <option value="CERRADA">Cerrada</option>
          <option value="EN_RANKING">En ranking</option>
          <option value="ASIGNADA">Asignada</option>
        </select>
        <div className="spacer" />
      </div>

      {/* Tabla */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Apertura</th>
              <th>Cierre</th>
              <th>Creada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  {q || filtroEstado
                    ? 'Sin resultados para los filtros aplicados.'
                    : 'No hay convocatorias cargadas.'}
                </td>
              </tr>
            ) : (
              filtradas.map((conv) => (
                <tr key={conv.id}>
                  <td>
                    <p className="conv-nombre">{conv.nombre}</p>
                    <p className="conv-id">ID: {conv.id}</p>
                  </td>
                  <td>
                    <span className={`badge-estado ${ESTADO_CLASS[conv.estado]}`}>
                      {ESTADO_LABEL[conv.estado]}
                    </span>
                  </td>
                  <td>{formatFecha(conv.fechaApertura)}</td>
                  <td>{formatFecha(conv.fechaCierre)}</td>
                  <td>{formatFecha(conv.createdAt)}</td>
                  <td className="actions-cell">
                    <button
                      className="ver-ficha"
                      id={`btn-editar-${conv.id}`}
                      onClick={() => handleEditar(conv)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <ConvocatoriaModal
          editando={editando}
          onClose={handleCerrar}
          onGuardado={handleGuardado}
        />
      )}
    </main>
  );
}
