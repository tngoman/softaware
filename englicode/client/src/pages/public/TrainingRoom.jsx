import { useState } from 'react';
import TimeIndexTraining from '../../components/training/TimeIndexTraining';
import DecaScaleTraining from '../../components/training/DecaScaleTraining';
import ClockMathTraining from '../../components/training/ClockMathTraining';
import DataDecaTraining from '../../components/training/DataDecaTraining';
import ProximityTraining from '../../components/training/ProximityTraining';
import QuantityTraining from '../../components/training/QuantityTraining';
import PercentageTraining from '../../components/training/PercentageTraining';

export default function TrainingRoom() {
  const [activeProtocol, setActiveProtocol] = useState('percentage');

  const protocols = [
    { id: 'time-index', num: '1', title: 'Time Index', component: TimeIndexTraining },
    { id: 'deca-scale', num: '2', title: 'Deca-Scale', component: DecaScaleTraining },
    { id: 'clock-math', num: '3', title: 'Clock Math', component: ClockMathTraining },
    { id: 'data-deca', num: '4', title: 'Data-Deca', component: DataDecaTraining },
    { id: 'proximity', num: '5', title: 'Proximity Scale', component: ProximityTraining },
    { id: 'quantity', num: '6', title: 'Quantity Index', component: QuantityTraining },
    { id: 'percentage', num: '7', title: 'Percentage State', component: PercentageTraining },
  ];

  const ActiveComponent = protocols.find(p => p.id === activeProtocol)?.component;

  return (
    <div className="max-w-5xl mx-auto px-5 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          <span className="text-[var(--accent)]">◆</span> Training Room
        </h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Master the protocols through interactive examples and mental math shortcuts.
        </p>
      </div>

      {/* Protocol Selector */}
      <div className="mb-8 flex flex-wrap gap-2">
        {protocols.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProtocol(p.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border-2"
            style={activeProtocol === p.id
              ? { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' }
              : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
            }
          >
            <span className="font-mono font-bold">{p.num}</span> {p.title}
          </button>
        ))}
      </div>

      {/* Active Protocol Content */}
      {ActiveComponent && <ActiveComponent />}
    </div>
  );
}
