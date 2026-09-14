import './DropzoneOverlay.css';
import { useState, useEffect, useRef } from 'react';

const ACCEPTED_EXT = '.xlsx,.xls,.csv';

interface DropzoneOverlayProps {
  /** Controla si el overlay está abierto (accionado desde el botón del padre) */
  isOpen: boolean;
  onClose: () => void;
  /** Llamado con el archivo elegido o soltado */
  onFile: (file: File) => void;
  title?: string;
  sub?: string;
}

/**
 * Overlay de arrastrar-y-soltar para planillas Excel/CSV.
 *
 * Se muestra de dos formas:
 *  1. Cuando el padre pone isOpen=true (clic en "Cargar planilla").
 *  2. Automáticamente cuando el usuario arrastra un archivo sobre la ventana.
 *
 * Gestiona los eventos de window para:
 *  - Mostrar el overlay al detectar un drag.
 *  - Prevenir que el navegador intente abrir el archivo si se suelta fuera de la zona.
 */
export function DropzoneOverlay({ isOpen, onClose, onFile, title, sub }: DropzoneOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [isOver,  setIsOver]  = useState(false); // archivo encima de la zona interior
  const fileInputRef          = useRef<HTMLInputElement>(null);

  /**
   * Usamos un contador en lugar de un booleano para manejar correctamente los
   * eventos dragenter/dragleave cuando el cursor pasa por elementos hijo:
   * cada dragenter incrementa, cada dragleave decrementa.
   */
  const dragCounter = useRef(0);

  // ── Sincronizar visibilidad con la prop isOpen ───────────────────────────
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    }
  }, [isOpen]);

  // ── Listeners a nivel window ─────────────────────────────────────────────
  useEffect(() => {
    function handleWindowDragEnter(e: DragEvent) {
      e.preventDefault();
      dragCounter.current += 1;
      if (dragCounter.current === 1) setVisible(true);
    }

    function handleWindowDragOver(e: DragEvent) {
      // OBLIGATORIO: sin esto el navegador no permite soltar el archivo
      e.preventDefault();
    }

    function handleWindowDragLeave() {
      dragCounter.current -= 1;
      // Solo cerramos si el drag salió completamente de la ventana
      if (dragCounter.current === 0 && !isOpen) {
        setVisible(false);
      }
    }

    function handleWindowDrop(e: DragEvent) {
      e.preventDefault(); // evita que el browser abra el archivo en la pestaña
      dragCounter.current = 0;
      // Si se soltó fuera de nuestra zona y el overlay no fue abierto por botón
      if (!isOpen) setVisible(false);
    }

    window.addEventListener('dragenter',  handleWindowDragEnter);
    window.addEventListener('dragover',   handleWindowDragOver);
    window.addEventListener('dragleave',  handleWindowDragLeave);
    window.addEventListener('drop',       handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter',  handleWindowDragEnter);
      window.removeEventListener('dragover',   handleWindowDragOver);
      window.removeEventListener('dragleave',  handleWindowDragLeave);
      window.removeEventListener('drop',       handleWindowDrop);
    };
  }, [isOpen]);

  // ── Acciones ─────────────────────────────────────────────────────────────

  function close() {
    dragCounter.current = 0;
    setVisible(false);
    setIsOver(false);
    onClose();
  }

  function processFile(file: File) {
    close();
    onFile(file);
  }

  // ── Eventos de la zona interior ──────────────────────────────────────────

  function handleZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  }

  function handleZoneDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
  }

  function handleZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    // Clic en el fondo oscuro cierra el overlay
    <div className="dropzone-overlay" onClick={close}>

      <div
        className={`dropzone-zone${isOver ? ' dropzone-zone--over' : ''}`}
        onClick={(e) => e.stopPropagation()}   // evita cerrar al hacer clic dentro
        onDragOver={handleZoneDragOver}
        onDragLeave={handleZoneDragLeave}
        onDrop={handleZoneDrop}
      >
        {/* Input oculto para selección manual */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXT}
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {/* Botón cerrar */}
        <button className="dropzone-close" onClick={close} aria-label="Cerrar">✕</button>

        {/* Ícono */}
        <div className="dropzone-icon" aria-hidden="true">📊</div>

        {/* Textos */}
        <p className="dropzone-title">
          {isOver ? '¡Soltá el archivo!' : (title || 'Soltá tu archivo de Excel aquí')}
        </p>
        <p className="dropzone-sub">
          {isOver
            ? 'Suelta el archivo para cargarlo'
            : (sub || 'O hacé clic en el botón para buscarlo en tu equipo')}
        </p>

        {/* Tags de formato */}
        <div className="dropzone-formats">
          <span className="dropzone-tag">XLSX</span>
          <span className="dropzone-tag">XLS</span>
          <span className="dropzone-tag">CSV</span>
        </div>

        {/* Botón seleccionar archivo */}
        <button
          className="dropzone-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Seleccionar archivo
        </button>
      </div>
    </div>
  );
}

