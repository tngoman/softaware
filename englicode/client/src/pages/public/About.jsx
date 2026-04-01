import React from 'react';

export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-16">
      <div className="mb-12 border-b border-[var(--border)] pb-6">
        <div className="text-xs font-semibold tracking-widest mb-4 uppercase" style={{ color: 'var(--accent)' }}>
          System Overview
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-wide mb-6">
          The Platform Definition
        </h1>
        <p className="text-sm text-[var(--accent)] leading-relaxed font-mono">
          Englicode is a gamified cognitive gym and crowdsourced dictionary built around a new, mathematically compressed dialect of English.
        </p>
      </div>

      <div className="space-y-12 text-base leading-loose" style={{ color: 'var(--text-secondary)' }}>
        <section>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-wider mb-4">
            The Concept
          </h2>
          <p>
            It replaces traditional, culturally bloated systems of time, currency, and status with highly efficient metric protocols and tech-adjacent logic.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-wider mb-4">
            The Mission
          </h2>
          <p>
            To promote active logical thinking in the AI age. Englicode transforms everyday communication into a real-time logic puzzle, forcing the brain to calculate, translate, and compress data before speaking. It is designed to stretch the mind, filter out passive communication, and build a community of fast-processing thinkers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-wider mb-6">
            The Three Core Pillars
          </h2>
          <div className="space-y-8">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-6 rounded-lg">
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-3">
                <span className="text-[var(--accent)]">1.</span> A Cognitive Training Engine
              </h3>
              <p>
                At its core, Englicode is an educational tool. It breaks users out of their ingrained Base-60 (clock time) and cultural biases, forcing them to learn universal metric logic like the Deca-Scale and the Time Index. Through rapid-fire translation quizzes, users train their brains to parse syntax and math simultaneously.
              </p>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-6 rounded-lg">
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-3">
                <span className="text-[var(--accent)]">2.</span> An Open-Source Cipher
              </h3>
              <p>
                Englicode is a living, breathing cryptographic dictionary. Unlike traditional language platforms that dictate what words mean, this platform relies on a strict, community-governed "Pull Request" system. Users who have proven their mathematical logic can submit and vote on new protocol terms and scaling expressions. If the math holds and the community agrees, it becomes official Englicode canon.
              </p>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-6 rounded-lg">
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-3">
                <span className="text-[var(--accent)]">3.</span> A Proof-of-Logic Social Network
              </h3>
              <p>
                The platform gamifies cognitive flexibility. Users don't just learn; they earn a verifiable Processing Speed rank (ranging from Analog to Overclocked). By mastering the quizzes and actively contributing high-integrity logic to the dictionary, users build a shareable profile that acts as a digital flex—a verifiable proof of their cognitive bandwidth.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[var(--accent)]/5 border-l-2 border-[var(--accent)] p-6 rounded-r-lg mt-12">
          <h2 className="text-base font-bold text-[var(--text-primary)] tracking-wider mb-4">
            The Value Proposition
          </h2>
          <p className="font-bold mb-4 px-3 py-1 inline-block text-sm" style={{ color: 'var(--accent)', background: 'var(--bg-primary)' }}>
            People will join for the meme, but they will stay for the mental stretch.
          </p>
          <p className="mb-0">
            Englicode offers the immediate dopamine hit of being part of an "in-group" that speaks a secret, highly efficient code. To outsiders, the language sounds like pure chaos ("I'll be there in a 1.5 2, the task is 90 100"). But to the initiated, Englicode is flawlessly logical. It appeals directly to developers, internet culture enthusiasts, and anyone who wants to prove their brain processes data a little bit faster than the rest.
          </p>
        </section>
      </div>
    </div>
  );
}
