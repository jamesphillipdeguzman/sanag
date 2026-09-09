import type { Municipality } from '@/types';
import { getRecoveryColor, getRecoveryStatusColor } from '@/data/mockData';
import { ArrowUpDown } from 'lucide-react';

interface MunicipalityTableProps {
  municipalities: Municipality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

type SortKey = 'recoveryScore' | 'name' | 'province' | 'estimatedDaysToRecover';

export default function MunicipalityTable({ municipalities, selectedId, onSelect }: MunicipalityTableProps) {
  const sorted = [...municipalities]
    .sort((a, b) => a.recoveryScore - b.recoveryScore)
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Municipal Resilience Index</h3>
          <p className="text-xs text-ink-400 mt-0.5">Recovery scores ranked from lowest to highest</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-ink-400">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>Sorted by score</span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3 text-xs font-medium text-ink-400 uppercase tracking-wider">Municipality</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-ink-400 uppercase tracking-wider hidden sm:table-cell">Province</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-ink-400 uppercase tracking-wider hidden md:table-cell">Population</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-ink-400 uppercase tracking-wider">Status</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-ink-400 uppercase tracking-wider">Score</th>
              <th className="text-right px-3 py-3 text-xs font-medium text-ink-400 uppercase tracking-wider hidden lg:table-cell">Days to Recover</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-ink-400 uppercase tracking-wider">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const isSelected = m.id === selectedId;
              return (
                <tr
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  className={`border-b border-white/5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-ocean-500/10'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getRecoveryColor(m.recoveryScore) }}
                      />
                      <span className="font-medium text-white">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-300 hidden sm:table-cell">{m.province}</td>
                  <td className="px-3 py-3 text-ink-400 hidden md:table-cell">{m.population.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-md"
                      style={{
                        color: getRecoveryStatusColor(m.status),
                        backgroundColor: `${getRecoveryStatusColor(m.status)}15`,
                      }}
                    >
                      {m.status === 'restored' ? 'Restored' :
                       m.status === 'recovering' ? 'Recovering' :
                       m.status === 'warning' ? 'Limited' : 'Critical'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-bold text-base" style={{ color: getRecoveryColor(m.recoveryScore) }}>
                      {m.recoveryScore}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-ink-400 hidden lg:table-cell">
                    {m.estimatedDaysToRecover === 0 ? '—' : `${m.estimatedDaysToRecover}d`}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-ink-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${m.recoveryScore}%`,
                            backgroundColor: getRecoveryColor(m.recoveryScore),
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
