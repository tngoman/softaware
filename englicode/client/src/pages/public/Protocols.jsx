import React from 'react';
import { Link } from 'react-router-dom';

const protocols = [
  { id: 'time-index', num: '1', title: 'The Time Index', syntax: '[1–7]', desc: 'Universal digit for time units' },
  { id: 'deca-scale', num: '2', title: 'Deca-Scale Protocol', syntax: '[×10] [Index]', desc: 'Time shortcuts via base-10' },
  { id: 'clock-math', num: '3', title: 'Clock Math', syntax: '[H] [M÷10]', desc: 'Deca-Time & The Remainder' },
  { id: 'data-deca', num: '4', title: 'Data-Deca Protocol', syntax: '[Val] [10ⁿ]', desc: 'Universal currency scaling' },
  { id: 'proximity', num: '5', title: 'Proximity Scale', syntax: '[n] Index', desc: 'Replaces soon, later, a while' },
  { id: 'quantity', num: '6', title: 'Quantity Index', syntax: '[Val] [Scale]', desc: 'Replaces a few, a lot, tons' },
  { id: 'percentage', num: '7', title: 'Percentage State', syntax: '[n] 100', desc: 'Replaces almost, halfway, done' },
  { id: 'direction', num: '8', title: 'Direction Protocol', syntax: '[n] Index', desc: 'Metric compass + 3D vertical' },
];

export default function Protocols() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-wider mb-3">
          <span className="text-[var(--accent)]">◆</span> The Protocols
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
          Englicode replaces arbitrary cultural standards (like 12-hour clocks and local currencies) with 
          strict, mathematically compressed metric systems. Before you can speak the language, you must understand the rules.
        </p>
      </div>

      {/* Protocol Directory */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-12">
        {protocols.map((p) => (
          <button
            key={p.id}
            onClick={() => scrollTo(p.id)}
            className="group text-left bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 hover:border-[var(--accent)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 rounded px-1.5 py-0.5 font-mono">{p.num}</span>
              <span className="text-[10px] font-mono text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">{p.syntax}</span>
            </div>
            <div className="text-xs font-bold tracking-wider text-[var(--text-primary)] mb-0.5 leading-tight">{p.title}</div>
            <div className="text-[10px] text-[var(--text-secondary)] leading-snug">{p.desc}</div>
          </button>
        ))}
      </div>

      <div className="space-y-16">
        
        {/* Foundation: The Time Index */}
        <section id="time-index" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            1. The Time Index
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4">
            We assign a permanent, universal digit to standard units of time, scaling from smallest to largest. 
            This acts as the mathematical lock for all time-based rules.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 1, label: 'Seconds' },
              { id: 2, label: 'Minutes' },
              { id: 3, label: 'Hours' },
              { id: 4, label: 'Days' },
              { id: 5, label: 'Weeks' },
              { id: 6, label: 'Months' },
              { id: 7, label: 'Years' },
            ].map((t) => (
              <div key={t.id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-3 flex items-center gap-3">
                <span className="text-[var(--accent)] font-mono font-bold text-lg">{t.id}</span>
                <span className="text-xs tracking-wider text-[var(--text-secondary)] uppercase">{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Time Protocol */}
        <section id="deca-scale" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            2. The Deca-Scale Protocol (Time Shortcuts)
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
            Rule: <code>[Multiplier of 10] [Time Index]</code><br/>
            Instead of standard time chunks, the first number acts as a base-10 multiplier for the chosen Time Index.
          </p>
          <div className="space-y-4">
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">1.5 2</span>
                <span className="text-[var(--text-secondary)]">→ 1.5 × 10 = 15 Minutes</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "I'll be there in a 1.5 2."
              </blockquote>
            </div>
            
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">3 2</span>
                <span className="text-[var(--text-secondary)]">→ 3 × 10 = 30 Minutes</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "Give me a 3 2, I need to finish this."
              </blockquote>
            </div>

            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">2 4</span>
                <span className="text-[var(--text-secondary)]">→ 2 × 10 = 20 Days</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "The project is due in a 2 4."
              </blockquote>
            </div>
          </div>
        </section>

        {/* Conversational Time Protocol */}
        <section id="clock-math" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            3. Clock Math: Deca-Time & The Remainder
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
            Traditional clocks are subjective. Englicode forces you to either compress the minutes into a decimal 
            or state the mathematical remainder until the next hour.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[var(--bg-tertiary)] border border-[var(--accent)]/30 p-5 rounded">
              <h3 className="text-sm font-bold tracking-wider mb-2">Deca-Time</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">
                Rule: <code>[Hour in 24h format] [Minutes / 10]</code><br/>
              </p>
              <div className="font-mono text-[var(--accent)] text-lg mb-1">13 5.2</div>
              <div className="text-xs text-[var(--text-primary)] mb-2">1:52 PM</div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                The hour is 13:00. 52 minutes divided by 10 is 5.2.
              </p>
            </div>

            <div className="bg-[var(--bg-tertiary)] border border-[var(--accent)]/30 p-5 rounded">
              <h3 className="text-sm font-bold tracking-wider mb-2">The Remainder</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-4">
                Rule: <code>[Minutes Remaining] to [Target Hour]</code><br/>
              </p>
              <div className="font-mono text-[var(--accent)] text-lg mb-1">8 to 14</div>
              <div className="text-xs text-[var(--text-primary)] mb-2">1:52 PM</div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                There are 8 minutes remaining until the 14th hour (2:00 PM).
              </p>
            </div>
          </div>
        </section>

        {/* Currency Protocol */}
        <section id="data-deca" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            4. The Data-Deca Protocol (Universal Currency)
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
            Rule: <code>[Value] [Power of 10]</code><br/>
            Money completely transcends local economies (Dollars, Rands, Euros). The second digit represents the data storage scale (number of zeros).
          </p>
          
          <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-tertiary)] text-[10px] tracking-widest text-[var(--text-secondary)] uppercase">
                <tr>
                  <th className="p-3 font-medium">Syntax</th>
                  <th className="p-3 font-medium">Index</th>
                  <th className="p-3 font-medium">Meaning</th>
                  <th className="p-3 font-medium hidden md:table-cell">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">4 1</td>
                  <td className="p-3 text-[var(--text-secondary)]">Tens (0)</td>
                  <td className="p-3">40</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"That ticket cost me a 4 1."</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">1.5 2</td>
                  <td className="p-3 text-[var(--text-secondary)]">Hundreds (00)</td>
                  <td className="p-3">150</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"Dinner out is usually a 1.5 2."</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">5 3</td>
                  <td className="p-3 text-[var(--text-secondary)]">Kilos (000)</td>
                  <td className="p-3">5,000</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"A new laptop is going to be at least a 5 3."</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">3.5 6</td>
                  <td className="p-3 text-[var(--text-secondary)]">Megs (000,000)</td>
                  <td className="p-3">3,500,000</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"They're selling that property for a 3.5 6."</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">2 9</td>
                  <td className="p-3 text-[var(--text-secondary)]">Gigs (Billion)</td>
                  <td className="p-3">2,000,000,000</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"The company just bought them out for a solid 2 9."</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Proximity Scale */}
        <section id="proximity" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            5. The Proximity Scale (Replacing "Soon," "Later," "A while")
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
            Vague time words are the enemy of logic. We use the Time Index (1–7) as a standalone urgency level.<br/>
            Rule: <code>[Urgency] Index</code>
          </p>
          <div className="space-y-4">
            <div className="bg-[var(--bg-secondary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">1 Index</span>
                <span className="text-[var(--text-secondary)]">→ Seconds — I'm doing it right now</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "I'm on it, give me a 1 Index."
              </blockquote>
            </div>
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">3 Index</span>
                <span className="text-[var(--text-secondary)]">→ Hours — Sometime today</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "I'll have that report in a 3 Index."
              </blockquote>
            </div>
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">5 Index</span>
                <span className="text-[var(--text-secondary)]">→ Weeks — Don't expect it this morning</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "We'll settle the invoice in a 5 Index."
              </blockquote>
            </div>
          </div>
        </section>

        {/* Quantity Index */}
        <section id="quantity" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            6. The Quantity Index (Replacing "A few," "A lot," "Tons")
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
            Port the Data-Deca scale to physical counts. Eliminates vague words like "several" or "massive amounts."<br/>
            Rule: <code>[Value] [Scale]</code> — Scale tells you the order of magnitude.
          </p>
          <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-tertiary)] text-[10px] tracking-widest text-[var(--text-secondary)] uppercase">
                <tr>
                  <th className="p-3 font-medium">Syntax</th>
                  <th className="p-3 font-medium">Scale</th>
                  <th className="p-3 font-medium">Meaning</th>
                  <th className="p-3 font-medium hidden md:table-cell">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">3 1</td>
                  <td className="p-3 text-[var(--text-secondary)]">Tens</td>
                  <td className="p-3">~30</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"There were like 3 1 people at the meetup."</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">5 2</td>
                  <td className="p-3 text-[var(--text-secondary)]">Hundreds</td>
                  <td className="p-3">500</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"We've got 5 2 units in stock."</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-[var(--accent)]">2 3</td>
                  <td className="p-3 text-[var(--text-secondary)]">Thousands</td>
                  <td className="p-3">2,000</td>
                  <td className="p-3 text-[11px] text-[var(--text-secondary)] italic hidden md:table-cell">"The concert had 2 3 attendees."</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-3 leading-relaxed">
            It standardizes guesstimation. You aren't being precise — you're giving the order of magnitude.
          </p>
        </section>

        {/* Percentage State */}
        <section id="percentage" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            7. The Percentage State (Replacing "Almost," "Halfway," "Finished")
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
            Apply bandwidth logic to any task or status.<br/>
            Rule: <code>[Progress] 100</code>
          </p>
          <div className="space-y-4">
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">0 100</span>
                <span className="text-[var(--text-secondary)]">→ Empty / gone / not started</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "How's the coffee?" "It's 0 100."
              </blockquote>
            </div>
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">45 100</span>
                <span className="text-[var(--text-secondary)]">→ About halfway</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "The upload is 45 100."
              </blockquote>
            </div>
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">90 100</span>
                <span className="text-[var(--text-secondary)]">→ Nearly finished</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "Are you ready to leave?" "90 100."
              </blockquote>
            </div>
          </div>
        </section>

        {/* Direction Protocol */}
        <section id="direction" className="scroll-mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-2">
            8. The Direction Protocol (Radial Index)
          </h2>
          <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
            Replace the 12-hour clock face with a 360° circle divided into <strong>10 metric sectors</strong>. Each sector = 36°.<br/>
            Rule: <code>[Sector] Index</code> — where 0 = Dead Ahead (North/Forward).
          </p>

          {/* Horizontal compass table */}
          <div className="mb-6">
            <div className="text-[10px] text-[var(--accent)] tracking-widest uppercase mb-3">The Horizontal Map (Compass)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { idx: '0', label: 'Dead Ahead', deg: '0°', clock: '12 o\'clock' },
                { idx: '2.5', label: 'Hard Right', deg: '90°', clock: '3 o\'clock' },
                { idx: '5', label: 'Dead Behind', deg: '180°', clock: '6 o\'clock' },
                { idx: '7.5', label: 'Hard Left', deg: '270°', clock: '9 o\'clock' },
              ].map((d) => (
                <div key={d.idx} className="bg-[var(--bg-tertiary)] border border-[var(--accent)]/30 rounded-lg p-3">
                  <div className="text-lg font-mono font-bold text-[var(--accent)] mb-1">{d.idx}</div>
                  <div className="text-xs font-bold tracking-wider text-[var(--text-primary)] mb-0.5">{d.label}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">{d.deg} · replaces {d.clock}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Vertical axis */}
          <div className="mb-6">
            <div className="text-[10px] text-[var(--accent)] tracking-widest uppercase mb-3">3D Upgrade: Vertical Index</div>
            <p className="text-sm text-[var(--text-primary)] mb-3 leading-relaxed">
              Standard clock directions fail if the target is above or below you. Add a secondary number for elevation.<br/>
              Syntax: <code>[Horizontal] [Vertical]</code> — vertical ranges from <strong>-5</strong> (deep below) to <strong>+5</strong> (high above). <strong>0</strong> = level.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: '+5', label: 'Zenith', desc: 'Directly above' },
                { val: '0', label: 'Level', desc: 'Same plane' },
                { val: '-5', label: 'Nadir', desc: 'Directly below' },
              ].map((v) => (
                <div key={v.val} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-3 text-center">
                  <div className="text-lg font-mono font-bold text-[var(--accent)]">{v.val}</div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">{v.label}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">{v.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Examples */}
          <div className="space-y-4">
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">2.5 Index</span>
                <span className="text-[var(--text-secondary)]">→ 90° to your right (replaces "3 o'clock")</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "Contact at 2.5 Index."
              </blockquote>
            </div>
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">0 5</span>
                <span className="text-[var(--text-secondary)]">→ Dead Ahead, directly above (Zenith)</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "Object is 0 5 — look straight up."
              </blockquote>
            </div>
            <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded text-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold">2.5 -2</span>
                <span className="text-[var(--text-secondary)]">→ 90° right and slightly below your level</span>
              </div>
              <blockquote className="text-[12px] text-[var(--text-secondary)] italic">
                "Target at 2.5 -2."
              </blockquote>
            </div>
          </div>

          {/* Why */}
          <div className="mt-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-[10px] text-[var(--accent)] tracking-widest uppercase mb-2">Why This Is Proof of Logic</div>
            <ul className="space-y-1.5 text-[12px] text-[var(--text-secondary)] leading-relaxed">
              <li className="pl-4 relative before:content-['›'] before:absolute before:left-0 before:text-[var(--accent)]">
                <strong className="text-[var(--text-primary)]">Metric Universalism:</strong> You calculate a percentage of rotation, not imagine a clock face.
              </li>
              <li className="pl-4 relative before:content-['›'] before:absolute before:left-0 before:text-[var(--accent)]">
                <strong className="text-[var(--text-primary)]">Precision:</strong> Clock directions are chunky (30° per hour). Englicode allows decimals — 2.7 Index is much more precise than "between 3 and 4 o'clock."
              </li>
              <li className="pl-4 relative before:content-['›'] before:absolute before:left-0 before:text-[var(--accent)]">
                <strong className="text-[var(--text-primary)]">Cross-Platform:</strong> Works for a person walking, a drone in 3D space, or a developer mapping a UI coordinate system.
              </li>
            </ul>
          </div>
        </section>

      </div>

      <div className="mt-16 text-center">
        <Link
          to="/index"
          className="inline-block px-6 py-3 rounded bg-[var(--accent)] text-[var(--bg-primary)] text-xs font-bold tracking-widest uppercase hover:bg-[var(--accent-hover)] transition-colors no-underline"
        >
          View The Index
        </Link>
      </div>
    </div>
  );
}
