/**
 * Site Builder HTML Template Engine
 *
 * Generates professional, responsive landing pages from site data.
 * Uses Tailwind CSS CDN for styling — no external CSS files needed.
 *
 * The AI model (qwen2.5:3b) is too small to reliably produce well-styled HTML
 * from scratch. This template guarantees:
 *   - Correct Tailwind CDN loading
 *   - Responsive layout
 *   - Proper visual hierarchy
 *   - Widget + contact form placement
 *   - Professional design with the site's theme colour
 */

interface SiteData {
  businessName: string;
  tagline: string;
  heroSubtitle?: string;
  ctaText?: string;
  aboutText: string;
  services: string[];
  serviceDescriptions?: string[];
  logoUrl: string;
  heroImageUrl: string;
  clientId: string;
  contactEmail?: string;
  contactPhone?: string;
  themeColor?: string;
}

/* ── SVG icon bank (Heroicons, stroke style) ─────────────────────────── */
const SERVICE_ICONS = [
  // paintbrush / design
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/></svg>`,
  // card / rectangle
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>`,
  // globe / web
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>`,
  // photo / image
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>`,
  // cog / settings
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  // chart bar
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`,
  // megaphone
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"/></svg>`,
  // star
  `<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>`,
];

/* Accent-colour palettes keyed to icon backgrounds */
const ACCENT_PALETTES = [
  { bg: 'bg-blue-100',   text: 'text-blue-600',    hoverBg: 'bg-blue-600' },
  { bg: 'bg-purple-100', text: 'text-purple-600',  hoverBg: 'bg-purple-600' },
  { bg: 'bg-emerald-100',text: 'text-emerald-600', hoverBg: 'bg-emerald-600' },
  { bg: 'bg-amber-100',  text: 'text-amber-600',   hoverBg: 'bg-amber-600' },
  { bg: 'bg-rose-100',   text: 'text-rose-600',    hoverBg: 'bg-rose-600' },
  { bg: 'bg-cyan-100',   text: 'text-cyan-600',    hoverBg: 'bg-cyan-600' },
  { bg: 'bg-indigo-100', text: 'text-indigo-600',  hoverBg: 'bg-indigo-600' },
  { bg: 'bg-teal-100',   text: 'text-teal-600',    hoverBg: 'bg-teal-600' },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Grid columns helper ─────────────────────────────────────────────── */
function gridCols(count: number): string {
  if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
}

/* ── Main export ─────────────────────────────────────────────────────── */
export function generateSiteHtml(data: SiteData): string {
  const {
    businessName,
    tagline,
    heroSubtitle,
    ctaText,
    aboutText,
    services,
    logoUrl,
    heroImageUrl,
    clientId,
    themeColor = '#0044cc',
  } = data;

  const year = new Date().getFullYear();
  const safeName = escapeHtml(businessName);
  const safeTagline = escapeHtml(tagline);
  const safeHeroSubtitle = heroSubtitle ? escapeHtml(heroSubtitle) : '';
  const safeCta = ctaText ? escapeHtml(ctaText) : 'Get in Touch';
  const safeAbout = escapeHtml(aboutText);

  /* ── Hero background ──────────────────────────────────────────────── */
  const heroBg = heroImageUrl
    ? `<div class="absolute inset-0">
    <img src="${escapeHtml(heroImageUrl)}" alt="${safeName}" class="w-full h-full object-cover" />
    <div class="absolute inset-0 bg-gradient-to-br from-gray-900/80 via-blue-900/70 to-indigo-900/60"></div>
  </div>`
    : `<div class="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-800 to-purple-900"></div>`;

  /* ── Navigation bar with logo ─────────────────────────────────────── */
  const navLogo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeName}" class="h-10 w-10 rounded-lg object-cover" />`
    : '';

  /* ── Hero logo (large, centred) ────────────────────────────────────── */
  const heroLogo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeName} logo" class="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl shadow-2xl object-cover ring-4 ring-white/20" />`
    : '';

  /* ── Services cards ───────────────────────────────────────────────── */
  const serviceCards = services.map((s, i) => {
    const icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
    const palette = ACCENT_PALETTES[i % ACCENT_PALETTES.length];
    const safeSvc = escapeHtml(s);
    const desc = data.serviceDescriptions?.[i];
    const safeDesc = desc ? escapeHtml(desc) : '';
    return `
      <div class="group bg-gray-50 rounded-2xl p-8 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div class="w-16 h-16 mx-auto mb-5 rounded-xl ${palette.bg} ${palette.text} flex items-center justify-center group-hover:${palette.hoverBg} group-hover:text-white transition-colors duration-300">
          ${icon}
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">${safeSvc}</h3>
        ${safeDesc ? `<p class="text-gray-500 text-sm leading-relaxed">${safeDesc}</p>` : ''}
      </div>`;
  }).join('\n');

  /* ── Contact form ─────────────────────────────────────────────────── */
  const contactForm = `
      <form action="https://api.softaware.net.za/api/v1/leads/submit" method="POST" class="space-y-5">
        <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
        <input type="text" name="bot_check_url" style="display:none" tabindex="-1" autocomplete="off">
        <div>
          <input name="name" type="text" placeholder="Your Name" required
                 class="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition">
        </div>
        <div>
          <input name="email" type="email" placeholder="Email Address" required
                 class="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition">
        </div>
        <div>
          <textarea name="message" placeholder="Tell us about your project..." required rows="4"
                    class="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition resize-none"></textarea>
        </div>
        <button type="submit"
                class="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
          Send Message
        </button>
      </form>`;

  /* ── Widget script — only include when a real assistant is selected ── */
  const isRealAssistant = clientId && clientId !== 'preview' && /^(assistant-|staff-assistant-|[0-9a-f]{8}-)/i.test(clientId);
  const widgetScript = isRealAssistant
    ? `<script src="https://softaware.net.za/api/assistants/widget.js" data-assistant-id="${escapeHtml(clientId)}" defer></script>`
    : '';

  /* ── Full HTML ────────────────────────────────────────────────────── */
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeName} — ${safeTagline}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: { brand: '${themeColor}' }
    }
  }
}
</script>
</head>
<body class="bg-gray-50 text-gray-800 font-sans antialiased">

<!-- ═══ NAV ═══ -->
<nav class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
  <div class="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
    <a href="#" class="flex items-center gap-3">
      ${navLogo}
      <span class="text-lg font-bold text-gray-900">${safeName}</span>
    </a>
    <div class="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
      <a href="#about" class="hover:text-gray-900 transition-colors">About</a>
      <a href="#services" class="hover:text-gray-900 transition-colors">Services</a>
      <a href="#contact" class="bg-gray-900 text-white px-5 py-2 rounded-full hover:bg-gray-800 transition-colors">${safeCta}</a>
    </div>
  </div>
</nav>

<!-- ═══ HERO ═══ -->
<section class="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-16">
  ${heroBg}
  <div class="relative z-10 text-center px-6 max-w-4xl mx-auto">
    ${heroLogo}
    <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight drop-shadow-lg">
      ${safeName}
    </h1>
    <p class="mt-4 text-xl sm:text-2xl text-blue-100 font-light max-w-2xl mx-auto">
      ${safeTagline}
    </p>
    ${safeHeroSubtitle ? `<p class="mt-3 text-base sm:text-lg text-blue-200/80 max-w-xl mx-auto">${safeHeroSubtitle}</p>` : ''}
    <div class="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
      <a href="#contact"
         class="inline-block bg-white text-gray-900 font-semibold px-8 py-3 rounded-full shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all duration-300">
        ${safeCta}
      </a>
      <a href="#services"
         class="inline-block border-2 border-white/50 text-white font-semibold px-8 py-3 rounded-full hover:bg-white/10 transition-all duration-300">
        Our Services
      </a>
    </div>
  </div>
</section>

<!-- ═══ ABOUT ═══ -->
<section id="about" class="py-20 px-6">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">About Us</h2>
    <div class="w-16 h-1 bg-blue-600 mx-auto mb-8 rounded-full"></div>
    <p class="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
      ${safeAbout}
    </p>
  </div>
</section>

<!-- ═══ SERVICES ═══ -->
<section id="services" class="py-20 px-6 bg-white">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-14">
      <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">What We Do</h2>
      <div class="w-16 h-1 bg-blue-600 mx-auto mb-4 rounded-full"></div>
      <p class="text-gray-500">Professional services tailored to your needs</p>
    </div>
    <div class="grid ${gridCols(services.length)} gap-8">
${serviceCards}
    </div>
  </div>
</section>

<!-- ═══ CONTACT ═══ -->
<section id="contact" class="py-20 px-6 bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900">
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-12">
      <h2 class="text-3xl sm:text-4xl font-bold text-white mb-2">Let\u2019s Work Together</h2>
      <div class="w-16 h-1 bg-blue-400 mx-auto mb-4 rounded-full"></div>
      <p class="text-blue-200">Tell us about your project and we\u2019ll get back to you</p>
    </div>
    <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-8 sm:p-10 max-w-lg mx-auto">
${contactForm}
    </div>
  </div>
</section>

<!-- ═══ FOOTER ═══ -->
<footer class="bg-gray-950 text-gray-400 py-8 px-6 text-center">
  <p class="text-sm">&copy; ${year} ${safeName}. All rights reserved.</p>
  <p class="text-xs mt-2 text-gray-600">Powered by <a href="https://softaware.net.za" class="hover:text-blue-400 transition-colors">SoftAware</a></p>
</footer>

${widgetScript}
</body>
</html>`;
}
