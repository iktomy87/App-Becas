import './Topbar.css';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';

export type NavItem = {
  label: string;
  href: string;
};

interface TopbarProps {
  navItems?: NavItem[];
}

const DEFAULT_NAV: NavItem[] = [
  { label: 'Inicio',        href: '/' },
  { label: 'Inscripciones', href: '/inscripciones' },
  { label: 'Ranking',       href: '/ranking' },
];

interface IndicatorStyle {
  left:  number;
  width: number;
}

export function Topbar({ navItems = DEFAULT_NAV }: TopbarProps) {
  const location = useLocation();
  const [indicator, setIndicator] = useState<IndicatorStyle>({ left: 0, width: 0 });

  const navRef   = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  /** Mueve el indicador debajo del elemento dado */
  const moveTo = useCallback((el: HTMLAnchorElement | null) => {
    if (!el || !navRef.current) return;
    const navRect  = navRef.current.getBoundingClientRect();
    const linkRect = el.getBoundingClientRect();
    setIndicator({
      left:  linkRect.left - navRect.left,
      width: linkRect.width,
    });
  }, []);

  /** Posiciona el indicador en el item activo actual */
  const returnToActive = useCallback(() => {
    const activeIdx = navItems.findIndex((item) => {
      if (item.href === '/') {
        return location.pathname === '/';
      }
      return location.pathname.startsWith(item.href);
    });
    
    if (activeIdx >= 0) {
      moveTo(linkRefs.current[activeIdx]);
    } else if (linkRefs.current.length > 0) {
      // Si no hay ninguno activo, lo ocultamos o dejamos en 0
      setIndicator({ left: 0, width: 0 });
    }
  }, [navItems, location.pathname, moveTo]);

  // Inicializar indicador sin animación (useLayoutEffect evita el parpadeo)
  useLayoutEffect(() => {
    returnToActive();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  // Re-posicionar cuando cambia el item activo (URL)
  useEffect(() => {
    returnToActive();
  }, [returnToActive]);

  function handleMouseEnter(index: number) {
    moveTo(linkRefs.current[index]);
  }

  function handleMouseLeave() {
    returnToActive();
  }

  return (
    <>
      <header className="topbar">
        {/* Marca */}
        <div className="brand">
            <img src={"https://becassau.frre.utn.edu.ar/static/img/logo.png"} className="logo" alt="Logo" />
        </div>

        {/* Navegación con indicador deslizante */}
        <nav
          ref={navRef}
          className="nav"
          onMouseLeave={handleMouseLeave}
        >
          {navItems.map((item, index) => {
            const isActive = item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                to={item.href}
                ref={(el) => { linkRefs.current[index] = el; }}
                className={isActive ? 'active' : undefined}
                onMouseEnter={() => handleMouseEnter(index)}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Indicador naranja deslizante */}
          <span
            className="nav-indicator"
            style={{ 
              left: indicator.left, 
              width: indicator.width,
              opacity: indicator.width > 0 ? 1 : 0 
            }}
          />
        </nav>
      </header>

      <div className="topbar-divider" />
    </>
  );
}
