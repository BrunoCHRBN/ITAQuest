import { useState, useMemo } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { MathRenderer } from './MathRenderer';

interface ConstantItem {
  name: string;
  symbol: string;
  value: string;
  category: 'fisica' | 'quimica' | 'matematica';
  notes?: string;
}

const OFFICIAL_CONSTANTS: ConstantItem[] = [
  // Constantes Físicas
  {
    name: 'Aceleração da gravidade ao nível do mar',
    symbol: '$g$',
    value: '$9{,}80\\text{ m/s}^2$',
    category: 'fisica',
    notes: 'Adotar $10\\text{ m/s}^2$ somente quando explicitado na prova',
  },
  {
    name: 'Velocidade da luz no vácuo',
    symbol: '$c$',
    value: '$3{,}00 \\times 10^8\\text{ m/s}$',
    category: 'fisica',
  },
  {
    name: 'Carga elementar',
    symbol: '$e$',
    value: '$1{,}60 \\times 10^{-19}\\text{ C}$',
    category: 'fisica',
  },
  {
    name: 'Massa do elétron',
    symbol: '$m_e$',
    value: '$9{,}11 \\times 10^{-31}\\text{ kg}$',
    category: 'fisica',
  },
  {
    name: 'Massa do próton / nêutron',
    symbol: '$m_p \\approx m_n$',
    value: '$1{,}67 \\times 10^{-27}\\text{ kg}$',
    category: 'fisica',
  },
  {
    name: 'Constante gravitacional de Newton',
    symbol: '$G$',
    value: '$6{,}67 \\times 10^{-11}\\text{ N}\\cdot\\text{m}^2/\\text{kg}^2$',
    category: 'fisica',
  },
  {
    name: 'Constante de Planck',
    symbol: '$h$',
    value: '$6{,}63 \\times 10^{-34}\\text{ J}\\cdot\\text{s}$',
    category: 'fisica',
  },
  {
    name: 'Permissividade elétrica do vácuo',
    symbol: '$\\varepsilon_0$',
    value: '$8{,}85 \\times 10^{-12}\\text{ F/m}$',
    category: 'fisica',
    notes: '$1/(4\\pi\\varepsilon_0) = 8{,}99 \\times 10^9\\text{ N}\\cdot\\text{m}^2/\\text{C}^2$',
  },
  {
    name: 'Permeabilidade magnética do vácuo',
    symbol: '$\\mu_0$',
    value: '$4\\pi \\times 10^{-7}\\text{ T}\\cdot\\text{m/A}$',
    category: 'fisica',
  },
  {
    name: 'Constante de Boltzmann',
    symbol: '$k_B$',
    value: '$1{,}38 \\times 10^{-23}\\text{ J/K}$',
    category: 'fisica',
  },
  {
    name: 'Constante de Stefan-Boltzmann',
    symbol: '$\\sigma$',
    value: '$5{,}67 \\times 10^{-8}\\text{ W/(m}^2\\cdot\\text{K}^4)$',
    category: 'fisica',
  },
  {
    name: 'Pressão atmosférica padrão (1 atm)',
    symbol: '$1\\text{ atm}$',
    value: '$1{,}013 \\times 10^5\\text{ Pa} = 760\\text{ mmHg}$',
    category: 'fisica',
  },
  {
    name: 'Massa específica da água pura',
    symbol: '$\\rho_{água}$',
    value: '$1{,}00 \\times 10^3\\text{ kg/m}^3 = 1{,}00\\text{ g/cm}^3$',
    category: 'fisica',
  },
  {
    name: 'Calor específico da água líquida',
    symbol: '$c_{água}$',
    value: '$1{,}00\\text{ cal/(g}\\cdot^\\circ\\text{C)} = 4{,}18\\text{ kJ/(kg}\\cdot\\text{K)}$',
    category: 'fisica',
  },
  {
    name: 'Calor latente de fusão do gelo',
    symbol: '$L_f$',
    value: '$333\\text{ kJ/kg} \\approx 80\\text{ cal/g}$',
    category: 'fisica',
  },
  {
    name: 'Calor latente de vaporização da água',
    symbol: '$L_v$',
    value: '$2{,}26 \\times 10^3\\text{ kJ/kg} \\approx 540\\text{ cal/g}$',
    category: 'fisica',
  },

  // Constantes Químicas
  {
    name: 'Constante universal dos gases ideais',
    symbol: '$R$',
    value: '$8{,}314\\text{ J/(mol}\\cdot\\text{K)} = 0{,}0821\\text{ atm}\\cdot\\text{L/(mol}\\cdot\\text{K)}$',
    category: 'quimica',
    notes: '$R \\approx 62{,}3\\text{ mmHg}\\cdot\\text{L/(mol}\\cdot\\text{K)}$',
  },
  {
    name: 'Constante de Avogadro',
    symbol: '$N_A$',
    value: '$6{,}022 \\times 10^{23}\\text{ mol}^{-1}$',
    category: 'quimica',
  },
  {
    name: 'Constante de Faraday',
    symbol: '$F$',
    value: '$96.485\\text{ C/mol} \\approx 96.500\\text{ C/mol}$',
    category: 'quimica',
  },
  {
    name: 'Volume molar de gás ideal nas CNTP (0°C, 1 atm)',
    symbol: '$V_m$',
    value: '$22{,}4\\text{ L/mol}$',
    category: 'quimica',
    notes: '$22{,}7\\text{ L/mol}$ nas condições normais IUPAC (0°C, 1 bar)',
  },
  {
    name: 'Produto iônico da água a 25°C',
    symbol: '$K_w$',
    value: '$1{,}00 \\times 10^{-14}$',
    category: 'quimica',
  },

  // Massas molares
  {
    name: 'Massas molares fundamentais (g/mol)',
    symbol: '$M$',
    value: '$\\text{H: } 1{,}01; \\; \\text{He: } 4{,}00; \\; \\text{C: } 12{,}01; \\; \\text{N: } 14{,}01; \\; \\text{O: } 16{,}00; \\; \\text{Na: } 22{,}99; \\; \\text{Mg: } 24{,}31; \\; \\text{Al: } 26{,}98; \\; \\text{S: } 32{,}07; \\; \\text{Cl: } 35{,}45; \\; \\text{K: } 39{,}10; \\; \\text{Ca: } 40{,}08; \\; \\text{Fe: } 55{,}85; \\; \\text{Cu: } 63{,}55; \\; \\text{Ag: } 107{,}87$',
    category: 'quimica',
    notes: 'Valores arredondados adotados habitualmente na 1ª fase',
  },

  // Relações Matemáticas
  {
    name: 'Fórmulas de adição trigonométrica',
    symbol: '$\\sin(a \\pm b), \\cos(a \\pm b)$',
    value: '$\\sin(a \\pm b) = \\sin a \\cos b \\pm \\sin b \\cos a$\n$$\\cos(a \\pm b) = \\cos a \\cos b \\mp \\sin a \\sin b$$',
    category: 'matematica',
  },
  {
    name: 'Fórmula de De Moivre (Números Complexos)',
    symbol: '$z^n$',
    value: '$[r(\\cos\\theta + i\\sin\\theta)]^n = r^n(\\cos n\\theta + i\\sin n\\theta)$',
    category: 'matematica',
  },
  {
    name: 'Soma e Produto das raízes (Girard para grau 3)',
    symbol: '$P(x) = ax^3+bx^2+cx+d$',
    value: '$x_1+x_2+x_3 = -b/a; \\; x_1x_2+x_2x_3+x_3x_1 = c/a; \\; x_1x_2x_3 = -d/a$',
    category: 'matematica',
  },
];

interface ConstantsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConstantsDrawer({ isOpen, onClose }: ConstantsDrawerProps) {
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<'all' | 'fisica' | 'quimica' | 'matematica'>('all');

  const filteredConstants = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return OFFICIAL_CONSTANTS.filter((item) => {
      const matchCat = category === 'all' || item.category === category;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q))
      );
    });
  }, [filter, category]);

  if (!isOpen) return null;

  return (
    <div className="constants-drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Folha oficial de constantes">
      <div className="constants-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="constants-drawer-header">
          <div className="constants-header-copy">
            <div className="constants-eyebrow">
              <BookOpen size={14} /> FOLHA OFICIAL DE CONSTANTES · ITA
            </div>
            <h3>Dados Gerais e Constantes Físico-Químicas</h3>
            <p>Valores de referência padronizados para resolução do exame vestibular do ITA.</p>
          </div>
          <button
            type="button"
            className="subtle-icon close-drawer-btn"
            onClick={onClose}
            aria-label="Fechar folha de constantes"
            title="Fechar (C ou Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter bar */}
        <div className="constants-filter-bar">
          <div className="constants-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Pesquisar por constante, grandeza ou símbolo..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Pesquisar constantes"
            />
            {filter && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setFilter('')}
                aria-label="Limpar pesquisa"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="constants-category-tabs">
            <button
              type="button"
              className={`cat-tab ${category === 'all' ? 'active' : ''}`}
              onClick={() => setCategory('all')}
            >
              Todas ({OFFICIAL_CONSTANTS.length})
            </button>
            <button
              type="button"
              className={`cat-tab ${category === 'fisica' ? 'active' : ''}`}
              onClick={() => setCategory('fisica')}
            >
              Física
            </button>
            <button
              type="button"
              className={`cat-tab ${category === 'quimica' ? 'active' : ''}`}
              onClick={() => setCategory('quimica')}
            >
              Química
            </button>
            <button
              type="button"
              className={`cat-tab ${category === 'matematica' ? 'active' : ''}`}
              onClick={() => setCategory('matematica')}
            >
              Matemática
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="constants-table-wrapper">
          <table className="constants-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>Grandeza / Constante</th>
                <th style={{ width: '22%' }}>Símbolo</th>
                <th style={{ width: '40%' }}>Valor Padronizado</th>
              </tr>
            </thead>
            <tbody>
              {filteredConstants.map((item, idx) => (
                <tr key={idx} className="constant-row">
                  <td className="constant-name-cell">
                    <div className="constant-title">{item.name}</div>
                    {item.notes && (
                      <div className="constant-note">
                        <MathRenderer text={item.notes} inline />
                      </div>
                    )}
                  </td>
                  <td className="constant-symbol-cell">
                    <MathRenderer text={item.symbol} inline />
                  </td>
                  <td className="constant-value-cell">
                    <MathRenderer text={item.value} />
                  </td>
                </tr>
              ))}
              {filteredConstants.length === 0 && (
                <tr>
                  <td colSpan={3} className="constants-empty-cell">
                    Nenhuma constante encontrada para os termos pesquisados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="constants-drawer-footer">
          <span>
            <b>Atalho:</b> Pressione <kbd>C</kbd> para abrir/fechar a qualquer momento durante a resolução.
          </span>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Fechar folha
          </button>
        </div>
      </div>
    </div>
  );
}
