import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store';
import { useAppSettings } from '../../hooks/useAppSettings';
import { getApiBaseUrl } from '../../config/app';

// Consumer-friendly features for PLG
const consumerFeatures = [
  {
    icon: '🌐',
    title: "Just Give Us Your Website — We'll Make It Smart",
    description: 'Share your website URL and we\'ll read every page to create an AI assistant that knows your business inside and out. No technical setup required.',
  },
  {
    icon: '⚡',
    title: 'From Idea to Website in Under 5 Minutes',
    description: 'Answer a few questions about your business and watch as AI creates a beautiful, professional website with a built-in assistant. Perfect for new businesses.',
  },
  {
    icon: '📧',
    title: 'Never Miss Another Customer',
    description: 'Every visitor question gets captured and sent straight to your email. Your AI assistant works 24/7, even when you\'re sleeping.',
  },
  {
    icon: '💬',
    title: 'Conversations That Convert',
    description: 'Your AI assistant doesn\'t just answer questions — it guides visitors toward becoming customers with smart, helpful responses.',
  },
  {
    icon: '📱',
    title: 'Works Everywhere, Instantly',
    description: 'Add our chat widget to any website with just one line of code. Works on WordPress, Shopify, or any platform you use.',
  },
  {
    icon: '📊',
    title: 'See What Your Visitors Really Want',
    description: 'Get insights into what questions people ask most, helping you improve your business and create content that matters.',
  },
];

// Consumer-friendly steps
const consumerSteps = [
  {
    number: '01',
    title: 'Get Started in 2 Minutes',
    description: 'Choose your path: Add a smart chat widget to your existing website, or let AI build you a beautiful new site from scratch.',
  },
  {
    number: '02',
    title: 'Your AI Learns Your Business',
    description: 'Our AI reads your website or documents to understand what you do, creating personalized responses that sound like you.',
  },
  {
    number: '03',
    title: 'Start Capturing Leads',
    description: 'Watch as visitors engage with your AI assistant, get their questions answered instantly, and convert into customers.',
  },
];

// Helper to format price from cents to Rands
const formatPrice = (cents: number): string => {
  if (cents === 0) return 'Free';
  const rands = cents / 100;
  return `R${rands.toLocaleString('en-ZA')}`;
};

const formatStorage = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 / 1024 / 1024)} GB Storage`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB Storage`;
  return `${Math.round(bytes / 1024)} KB Storage`;
};

interface PricingPlan {
  id: string;
  name: string;
  tier: string;
  priceMonthly: number;
  priceAnnually: number;
  trialDays: number;
  features: { items: string[] };
  isActive: boolean;
  description: string;
  cta: string;
  popular?: boolean;
}


const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    priceMonthly: 0,
    priceAnnually: 0,
    trialDays: 0,
    features: {
      items: [
        '1 Site & 1 AI Widget',
        '5 MB Storage',
        '500 AI Messages/month',
        '50 Knowledge Pages',
        'Single Page Site',
      ],
    },
    isActive: true,
    description: 'Test the platform — free forever',
    cta: 'Get Started',
  },
  {
    id: 'starter',
    name: 'Starter',
    tier: 'starter',
    priceMonthly: 34900,
    priceAnnually: 349000,
    features: {
      items: [
        '3 Sites & 3 AI Widgets',
        '50 MB Storage',
        '2,000 AI Messages/month',
        '200 Knowledge Pages',
        'Classic CMS (Multi-Page)',
        'Remove Branding',
      ],
    },
    isActive: true,
    description: 'Perfect for freelancers',
    cta: 'Start 14-Day Free Trial',
    popular: true,
    trialDays: 14,
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    priceMonthly: 69900,
    priceAnnually: 699000,
    trialDays: 0,
    features: {
      items: [
        '10 Sites & 10 AI Widgets',
        '200 MB Storage',
        '5,000 AI Messages/month',
        '500 Knowledge Pages',
        'E-commerce Ready',
        'Custom Knowledge Categories',
      ],
    },
    isActive: true,
    description: 'For growing agencies',
    cta: 'Get Started',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    tier: 'advanced',
    priceMonthly: 149900,
    priceAnnually: 1499000,
    trialDays: 0,
    features: {
      items: [
        '25 Sites & 25 AI Widgets',
        '1 GB Storage',
        '20,000 AI Messages/month',
        '2,000 Knowledge Pages',
        'Full Web App Builder',
        'API Webhooks',
      ],
    },
    isActive: true,
    description: 'For established agencies',
    cta: 'Get Started',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    priceMonthly: 0,
    priceAnnually: 0,
    trialDays: 0,
    features: {
      items: [
        'Unlimited Sites & Widgets',
        '5 GB+ Storage',
        'Unlimited AI Messages',
        'Unlimited Knowledge Pages',
        'Headless Architecture',
        'Omnichannel & Custom Middleware',
      ],
    },
    isActive: true,
    description: 'Bespoke AI solutions for your organisation',
    cta: 'Contact Sales',
  },
];

function mapPackageToPlan(pkg: any): PricingPlan {
  const limits = pkg?.limits || {};
  const featureItems = Array.isArray(pkg?.features) && pkg.features.length > 0
    ? pkg.features
    : [
        `${limits.maxSites ?? 0} Site${(limits.maxSites ?? 0) === 1 ? '' : 's'} & ${limits.maxWidgets ?? 0} AI Widget${(limits.maxWidgets ?? 0) === 1 ? '' : 's'}`,
        formatStorage(limits.maxStorageBytes ?? 0),
        `${(limits.maxActionsPerMonth ?? 0).toLocaleString('en-ZA')} AI Actions/month`,
        `${(limits.maxKnowledgePages ?? 0).toLocaleString('en-ZA')} Knowledge Pages`,
        String(limits.allowedSiteType || 'single_page').replace(/_/g, ' '),
      ];

  return {
    id: String(pkg.id ?? pkg.slug),
    name: pkg.name,
    tier: pkg.slug,
    priceMonthly: pkg.priceMonthly ?? 0,
    priceAnnually: pkg.priceAnnually ?? 0,
    trialDays: pkg.slug === 'starter' ? 14 : 0,
    features: { items: featureItems },
    isActive: true,
    description: pkg.description || 'Flexible package',
    cta: pkg.ctaText || 'Get Started',
    popular: Boolean(pkg.featured),
  };
}

/** Convert API package to the plan shape the LandingPage components expect */
const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAppStore();
  const { logoUrl, siteName } = useAppSettings();
  const [dynamicPricingPlans, setDynamicPricingPlans] = useState<PricingPlan[]>([]);

  // Dynamic pricing from database — falls back to hardcoded arrays
  useEffect(() => {
    let cancelled = false;

    const loadPackages = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/public/packages`, { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.success && Array.isArray(data.packages) && data.packages.length > 0) {
          setDynamicPricingPlans(data.packages.map(mapPackageToPlan));
        }
      } catch (error) {
        console.warn('Failed to load public packages, using fallback pricing.', error);
      }
    };

    loadPackages();
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePricingPlans = dynamicPricingPlans.length > 0 ? dynamicPricingPlans : pricingPlans;


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={siteName}
                  className="h-9 w-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#how-it-works" className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">
                How It Works
              </a>
              <a href="#pricing" className="text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium">
                Pricing
              </a>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-5 py-2 bg-picton-blue text-white font-semibold text-sm rounded-lg hover:bg-picton-blue/90 transition-colors shadow-sm"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium hidden sm:block"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2 bg-picton-blue text-white font-semibold text-sm rounded-lg hover:bg-picton-blue/90 transition-colors shadow-sm"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-picton-blue/10 border border-picton-blue/20 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-picton-blue font-medium">AI Assistant for Your Business</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-gray-900">
                Turn Every Website{' '}
                <span className="text-picton-blue">Visitor Into a</span>{' '}
                Customer
              </h1>

              <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
                Get started in 2 minutes with our free AI assistant. No coding required —
                just paste one line and watch your website come alive with intelligent conversations
                that capture leads while you sleep.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to="/register?trial=true"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 transition-colors shadow-md"
                >
                  Start 14-Day Free Trial
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Or Start Free Forever
                </Link>
              </div>
            </div>

            {/* Right — Demo Visual */}
            <div className="relative lg:pl-8">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 overflow-hidden">
                {/* Browser mockup header */}
                <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-lg px-3 py-1 text-xs text-gray-400 text-center">
                    www.yourbusiness.co.za
                  </div>
                </div>

                {/* Website preview */}
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-xl">
                    <div className="w-full h-28 bg-gradient-to-br from-picton-blue/20 to-blue-100 rounded-xl" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-700 shadow-sm border border-slate-100">
                        <div className="font-bold text-gray-900 mb-1">Your Business Name</div>
                        <div className="text-gray-500">Professional services that deliver results</div>
                      </div>
                    </div>
                  </div>

                  {/* Chat widget demo */}
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <div className="bg-picton-blue text-white rounded-2xl rounded-br-md px-4 py-2 text-sm max-w-xs shadow-sm">
                        Hi! How can I help you today? ✨
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-gray-700 rounded-2xl rounded-bl-md px-4 py-2 text-sm max-w-xs">
                        What services do you offer?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-picton-blue/10 text-picton-blue rounded-2xl px-4 py-2 text-sm">
                        <div className="flex gap-1 items-center">
                          <div className="w-1.5 h-1.5 bg-picton-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-picton-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-picton-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mini feature badges */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                      <div className="text-xl mb-1">📧</div>
                      <div className="text-xs text-gray-500 font-medium">Lead Capture</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                      <div className="text-xl mb-1">⚡</div>
                      <div className="text-xs text-gray-500 font-medium">Instant Setup</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-picton-blue/10 border border-picton-blue/20 text-sm text-picton-blue font-medium mb-4">
              ✨ Simple &amp; Powerful
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to{' '}
              <span className="text-picton-blue">Grow Your Business</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Whether you're starting from scratch or want to make your existing website smarter, we've got you covered.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {consumerFeatures.map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-picton-blue/30 transition-all duration-200"
              >
                <div className="w-12 h-12 bg-picton-blue/10 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Get started in minutes, whether you have a website or just an idea.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {consumerSteps.map((step, index) => (
              <div key={index} className="relative text-center md:text-left">
                {index !== consumerSteps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-picton-blue/40 to-transparent" />
                )}
                <div className="relative z-10 w-14 h-14 bg-picton-blue text-white rounded-xl flex items-center justify-center mb-5 mx-auto md:mx-0 shadow-md">
                  <span className="text-lg font-bold">{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent{' '}
              <span className="text-picton-blue">Pricing</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Start free and grow as your business grows. No hidden fees, no long-term contracts.
            </p>
          </div>

          {/* Consumer Plans */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-20">
            {visiblePricingPlans.filter(p => p.tier !== 'enterprise').map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col relative bg-white rounded-xl border p-6 ${
                  plan.tier === 'starter'
                    ? 'border-picton-blue shadow-lg ring-1 ring-picton-blue/20'
                    : 'border-slate-200 shadow-sm'
                }`}
              >
                {plan.tier === 'starter' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-picton-blue text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    14-Day Free Trial
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-gray-500 text-sm">{plan.description}</p>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    {plan.priceMonthly > 0 ? (
                      <>
                        <span className="text-3xl font-bold text-gray-900">{formatPrice(plan.priceMonthly)}</span>
                        <span className="text-gray-400 text-sm">/mo</span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-gray-900">Free</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 mb-6">
                  <ul className="space-y-3">
                    {plan.features.items.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <svg className="w-5 h-5 text-picton-blue mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={plan.tier === 'starter' ? '/register?trial=true' : '/register'}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors mt-auto text-center ${
                    plan.tier === 'starter'
                      ? 'bg-picton-blue hover:bg-picton-blue/90 text-white shadow-md'
                      : plan.tier === 'pro' || plan.tier === 'advanced'
                      ? 'bg-gray-900 hover:bg-gray-800 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-gray-700 border border-slate-200'
                  }`}
                >
                  {plan.cta || 'Get Started'}
                </Link>
              </div>
            ))}
          </div>

          {/* Enterprise Pricing */}
          <div className="border-t border-slate-200 pt-16 mt-4">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-sm text-gray-600 font-medium mb-4">
                🏢 Enterprise Solutions
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                Advanced Integration &amp;{' '}
                <span className="text-picton-blue">Custom Architecture</span>
              </h3>
              <p className="text-gray-500 max-w-2xl mx-auto">
                For organisations requiring headless deployments, omnichannel endpoints, and custom middleware solutions.
              </p>
            </div>

            <div className="max-w-lg mx-auto">
              {visiblePricingPlans.filter((p) => p.tier === 'enterprise').map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col relative bg-white rounded-xl border border-slate-200 shadow-sm p-8"
                >
                  <div className="mb-5">
                    <h4 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h4>
                    <p className="text-gray-500 text-sm">{plan.description}</p>
                  </div>

                  <div className="mb-5">
                    <span className="text-3xl font-bold text-gray-900">Custom</span>
                  </div>

                  <div className="flex-1 mb-6">
                    <ul className="space-y-3">
                      {plan.features.items.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <svg className="w-5 h-5 text-picton-blue mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    to="/register"
                    className="w-full py-3 rounded-lg font-semibold text-sm transition-colors mt-auto text-center bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    Contact Sales
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={siteName}
                  className="h-7 w-auto opacity-60"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} {siteName}. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
