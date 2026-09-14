import './RankingTable.css';

export type Prioridad = {
  orden: number;
  propuestaId: string;
};

export type RankingRow = {
  posicion: number;
  nombre: string;
  dni: string;
  legajo: string;
  carrera: string;
  promedio: string;
  factor: string;
  prioridades: Prioridad[];
};

interface RankingTableProps {
  rows: RankingRow[];
  emptyRows?: number;          // filas vacías de relleno
  onVerFicha?: (row: RankingRow) => void;
}

export function RankingTable({ rows, emptyRows = 2, onVerFicha }: RankingTableProps) {
  return (
    <table className="ranking-table">
      <thead>
        <tr>
          <th style={{ width: 60  }}>Pos.</th>
          <th style={{ width: 230 }}>Estudiante</th>
          <th style={{ width: 110 }}>Carrera</th>
          <th style={{ width: 110 }}>Promedio</th>
          <th style={{ width: 90  }}>Factor</th>
          <th>Prioridades</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.posicion}>
            <td>{row.posicion}</td>

            <td>
              <div className="stud-name">{row.nombre}</div>
              <div className="stud-sub">
                DNI {row.dni} - Leg. {row.legajo}
              </div>
            </td>

            <td>{row.carrera}</td>
            <td>{row.promedio}</td>
            <td className="factor-val">{row.factor}</td>

            <td>
              <div className="prio-row">
                <div className="prio-list">
                  {row.prioridades.map((p) => (
                    <span key={p.orden}>
                      {p.orden}° - {p.propuestaId}
                      <br />
                    </span>
                  ))}
                </div>
                <button
                  className="btn-mini"
                  onClick={() => onVerFicha?.(row)}
                >
                  Ver ficha
                </button>
              </div>
            </td>
          </tr>
        ))}

        {/* Filas vacías de relleno */}
        {Array.from({ length: emptyRows }).map((_, i) => (
          <tr key={`empty-${i}`} className="row-empty">
            <td /><td /><td /><td /><td /><td />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

