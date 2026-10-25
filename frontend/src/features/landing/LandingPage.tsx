import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ChevronDown,
  FileBarChart,
  HandCoins,
  Leaf,
  Menu,
  ShieldCheck,
  Sprout,
  Users,
  Wheat,
  X,
} from 'lucide-react';
import { landingFaq, landingFeatures, landingStakeholders, landingStats, landingSteps } from './landingData';

interface LandingPageProps {
  onLoginNavigate: () => void;
}

const handleNavigation = (id: string) => {
  if (typeof document === 'undefined') return;
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const featureIcons = [Users, FileBarChart, HandCoins, Sprout, ShieldCheck, Leaf];
const valueCards = [
  { icon: Wheat, key: 'landing.valueContracts' },
  { icon: ShieldCheck, key: 'landing.valueTransparency' },
  { icon: HandCoins, key: 'landing.valueFinance' },
  { icon: FileBarChart, key: 'landing.valueOversight' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginNavigate }) => {
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!mobileMenuOpen || event.key !== 'Escape') return;
      setMobileMenuOpen(false);
      const trigger = navRef.current?.querySelector<HTMLButtonElement>('[data-mobile-menu-trigger="true"]');
      trigger?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const languageToggle = () => {
    const next = i18n.language === 'am' ? 'en' : 'am';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
  };

  const navItems = useMemo(
    () => [
      { href: '#features', label: 'landing.nav.features' },
      { href: '#stakeholders', label: 'landing.nav.stakeholders' },
      { href: '#how-it-works', label: 'landing.nav.howItWorks' },
      { href: '#faq', label: 'landing.nav.faq' },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-stone-900 focus:text-white focus:px-4 focus:py-2"
      >
        {t('landing.skipToContent', 'Skip to main content')}
      </a>

      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur-sm">
        <div className="h-1 w-full flex">
          <div className="flex-1 bg-forest-700" />
          <div className="flex-1 bg-harvest-500" />
          <div className="flex-1 bg-rose-700" />
        </div>

        <nav ref={navRef} aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => handleNavigation('top')} className="flex items-center gap-3 text-left" aria-label={t('landing.brand', 'DCFMS home')}>
            <div className="flex h-10 w-10 items-center justify-center border border-forest-900 bg-forest-800 font-bold text-sm text-harvest-400">
              ATI
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-stone-900">DCFMS</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                {t('landing.institute', 'Agricultural Transformation Institute')}
              </div>
            </div>
          </button>

          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-stone-700 transition-colors hover:text-stone-950">
                {t(item.label, item.label)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={languageToggle}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
              aria-label={t('landing.switchLanguage', 'Switch language')}
            >
              <span>{i18n.language === 'am' ? 'EN' : 'አማ'}</span>
            </button>

            <button
              type="button"
              onClick={onLoginNavigate}
              className="hidden rounded-md bg-forest-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800 sm:inline-flex"
            >
              {t('landing.login', 'Log In')}
            </button>

            <button
              type="button"
              data-mobile-menu-trigger="true"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white p-2 text-stone-700 lg:hidden"
              aria-label={t('landing.toggleMenu', 'Toggle navigation menu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div className="border-t border-stone-200 bg-white lg:hidden" role="dialog" aria-modal="false">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-2 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
                >
                  {t(item.label, item.label)}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLoginNavigate();
                }}
                className="mt-2 inline-flex items-center justify-center rounded-md bg-forest-700 px-4 py-2 text-sm font-semibold text-white"
              >
                {t('landing.login', 'Log In')}
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="overflow-hidden">
        <section id="top" className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-agri-200 bg-agri-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-agri-800">
                <Leaf className="h-3.5 w-3.5" />
                {t('landing.badge', 'Transparent. Inclusive. Accountable.')}
              </div>
              <h1 className="mt-6 text-4xl font-black tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
                {t('landing.hero.title', 'Digitizing Ethiopia’s Contract Farming, End to End')}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-stone-700">
                {t(
                  'landing.hero.subtitle',
                  'Building trust, transparency, and access to finance for farmers, cooperatives, and agribusiness partners across Ethiopia.'
                )}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onLoginNavigate}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-forest-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-forest-800"
                >
                  {t('landing.login', 'Log In')}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigation('features')}
                  className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-5 py-3 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50"
                >
                  {t('landing.learnMore', 'Learn More')}
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-5 text-xs font-medium text-stone-600">
                <span>{t('landing.trust.title', 'An initiative of ATI')}</span>
                <span className="h-1 w-1 rounded-full bg-stone-400" aria-hidden="true" />
                <span>{t('landing.trust.collaboration', 'in collaboration with MoA, MoTRI, and ECC')}</span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-agri-50 via-white to-harvest-50 p-6 shadow-[0_25px_60px_rgba(22,38,18,0.08)]">
                <div className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                        {t('landing.platformPulse', 'Platform Pulse')}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-stone-900">DCFMS</h2>
                    </div>
                    <span className="rounded-full bg-agri-100 px-2 py-1 text-[10px] font-semibold text-agri-800">
                      {t('landing.live', 'Live')}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">{t('landing.cardContracts', 'Contracts')}</p>
                      <p className="mt-2 text-2xl font-black text-stone-900">1.3K</p>
                      <p className="mt-1 text-xs text-stone-600">{t('landing.cardContractsMeta', 'Seasonal registrations')}</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">{t('landing.cardFarmers', 'Producers')}</p>
                      <p className="mt-2 text-2xl font-black text-stone-900">42K</p>
                      <p className="mt-1 text-xs text-stone-600">{t('landing.cardFarmersMeta', 'Verified & linked')}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {[{ label: 'Contract visibility', value: '94%' }, { label: 'Finance readiness', value: '88%' }, { label: 'Audit trail', value: '100%' }].map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-xs text-stone-600">
                          <span>{t(`landing.${item.label.replace(/\s+/g, '')}`, item.label)}</span>
                          <span className="font-semibold text-stone-800">{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-200">
                          <div className="h-2 rounded-full bg-gradient-to-r from-forest-600 to-harvest-500" style={{ width: item.value }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="value-proposition" className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">{t('landing.valueTitle', 'Why DCFMS')}</p>
              <h2 id="value-proposition" className="mt-3 text-3xl font-black text-stone-900 sm:text-4xl">
                {t('landing.valueHeading', 'A practical system for better contracts, stronger trust, and faster growth.')}
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {valueCards.map(({ icon: Icon, key }) => (
                <article key={key} className="rounded-2xl border border-stone-200 bg-stone-50 p-6 shadow-sm">
                  <div className="mb-5 inline-flex rounded-xl bg-forest-100 p-3 text-forest-800">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900">{t(key, key)}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{t(`${key}Description`, `${key}Description`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">{t('landing.featuresTitle', 'Core modules')}</p>
            <h2 id="features-heading" className="mt-3 text-3xl font-black text-stone-900 sm:text-4xl">
              {t('landing.featuresHeading', 'Everything needed to manage contract farming decisions in one place.')}
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {landingFeatures.map(({ titleKey, descriptionKey }, index) => {
              const Icon = featureIcons[index % featureIcons.length];
              return (
                <article key={titleKey} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-0.5">
                  <div className="mb-4 inline-flex rounded-xl bg-harvest-50 p-3 text-harvest-700">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900">{t(titleKey)}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{t(descriptionKey)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="stakeholders" aria-labelledby="stakeholders-heading" className="border-y border-stone-200 bg-stone-100/80">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">{t('landing.stakeholdersTitle', 'Who it serves')}</p>
              <h2 id="stakeholders-heading" className="mt-3 text-3xl font-black text-stone-900 sm:text-4xl">
                {t('landing.stakeholdersHeading', 'Built for the full agricultural value chain.')}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {landingStakeholders.map((key) => (
                <article key={key} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 h-10 w-10 rounded-full bg-agri-100 text-agri-800 flex items-center justify-center">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900">{t(key)}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">{t('landing.howTitle', 'How it works')}</p>
            <h2 id="how-heading" className="mt-3 text-3xl font-black text-stone-900 sm:text-4xl">
              {t('landing.howHeading', 'From registration to settlement, every step is visible.')}
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {landingSteps.map((key, index) => (
              <div key={key} className="relative rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-forest-700 text-base font-black text-white">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold text-stone-900">{t(key)}</h3>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="impact-heading" className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">{t('landing.impactTitle', 'Impact')}</p>
              <h2 id="impact-heading" className="mt-3 text-3xl font-black text-stone-900 sm:text-4xl">
                {t('landing.impactHeading', 'Measurable progress for a more resilient food system.')}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {landingStats.map((stat) => (
                <div key={stat.labelKey} className="rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center">
                  <div className="text-3xl font-black text-stone-900">{stat.value}</div>
                  <div className="mt-2 text-sm text-stone-600">{t(stat.labelKey)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="security-heading" className="bg-forest-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-agri-300">{t('landing.securityTitle', 'Security & compliance')}</p>
              <h2 id="security-heading" className="mt-3 text-3xl font-black sm:text-4xl">{t('landing.securityHeading', 'Protected by Ethiopia’s digital governance framework.')}</h2>
              <p className="mt-5 text-base leading-7 text-stone-200">
                {t(
                  'landing.securityBody',
                  'DCFMS aligns with Proclamation No. 1321/2024 (Data Protection), Proclamation No. 1205/2020 (E-Transactions), and Proclamation No. 1289/2023 (Agricultural Production Contracts). Data is protected with encryption, role-based access controls, and immutable audit trails for accountable service delivery.'
                )}
              </p>
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest-700">{t('landing.faqTitle', 'FAQ')}</p>
            <h2 id="faq-heading" className="mt-3 text-3xl font-black text-stone-900 sm:text-4xl">
              {t('landing.faqHeading', 'Questions from institutions, farmers, and oversight teams.')}
            </h2>
          </div>

          <div className="space-y-4">
            {landingFaq.map((item, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <div key={item.questionKey} className="rounded-2xl border border-stone-200 bg-white">
                  <h3>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={isExpanded}
                      aria-controls={`faq-panel-${index}`}
                      onClick={() => setExpandedFaq(isExpanded ? null : index)}
                    >
                      <span className="text-base font-semibold text-stone-900">{t(item.questionKey)}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-stone-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                  </h3>
                  {isExpanded && (
                    <div id={`faq-panel-${index}`} className="border-t border-stone-200 px-5 py-4 text-sm leading-6 text-stone-600">
                      {t(item.answerKey)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-stone-200 bg-agri-50">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 px-4 py-14 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black text-stone-900 sm:text-4xl">
              {t('landing.ctaHeading', 'Ready to see the full DCFMS workflow?')}
            </h2>
            <p className="max-w-2xl text-base text-stone-600">
              {t('landing.ctaBody', 'Access is provisioned through your institution or cooperative.')}
            </p>
            <button
              type="button"
              onClick={onLoginNavigate}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-forest-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-forest-800"
            >
              {t('landing.login', 'Log In')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-forest-900 bg-forest-800 text-sm font-bold text-harvest-400">ATI</div>
              <div>
                <div className="text-base font-black text-stone-900">DCFMS</div>
              </div>
            </div>
            <p className="max-w-xs text-sm leading-6 text-stone-600">{t('landing.footerDescription', 'Digital contract farming infrastructure for transparent agricultural value chains in Ethiopia.')}</p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-stone-500">{t('landing.footerAbout', 'About')}</h3>
            <ul className="mt-4 space-y-2 text-sm text-stone-600">
              <li><a href="#top" className="hover:text-stone-900">{t('landing.footerHome', 'Home')}</a></li>
              <li><a href="#features" className="hover:text-stone-900">{t('landing.footerFeatures', 'Features')}</a></li>
              <li><a href="#stakeholders" className="hover:text-stone-900">{t('landing.footerStakeholders', 'Stakeholders')}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-stone-500">{t('landing.footerSupport', 'Support')}</h3>
            <ul className="mt-4 space-y-2 text-sm text-stone-600">
              <li><a href="#faq" className="hover:text-stone-900">{t('landing.footerFaq', 'FAQ')}</a></li>
              <li><a href="#how-it-works" className="hover:text-stone-900">{t('landing.footerProcess', 'How it works')}</a></li>
              <li><button type="button" onClick={onLoginNavigate} className="text-left hover:text-stone-900">{t('landing.login', 'Log In')}</button></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-stone-500">{t('landing.footerLanguage', 'Language')}</h3>
            <button
              type="button"
              onClick={languageToggle}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              {i18n.language === 'am' ? 'English' : 'አማርኛ'}
            </button>
          </div>
        </div>
        <div className="border-t border-stone-200">
          <div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-2 px-4 py-4 text-sm text-stone-500 sm:flex-row sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} DCFMS. {t('landing.copyright', 'All rights reserved.')}</p>
            <p className="text-xs uppercase tracking-[0.18em]">{t('landing.proclamation', 'Proclamation 1289/2023')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
