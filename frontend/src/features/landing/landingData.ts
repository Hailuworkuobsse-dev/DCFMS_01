export type LandingStat = {
  value: string;
  labelKey: string;
};

export type LandingFeature = {
  titleKey: string;
  descriptionKey: string;
};

export const landingStats: LandingStat[] = [
  { value: '63%', labelKey: 'landing.stats.contractGrowth' },
  { value: '2.4M', labelKey: 'landing.stats.producersReached' },
  { value: '1.1M ha', labelKey: 'landing.stats.hectaresCovered' },
  { value: '98.7%', labelKey: 'landing.stats.complianceScore' },
];

export const landingFeatures: LandingFeature[] = [
  { titleKey: 'landing.features.userManagement.title', descriptionKey: 'landing.features.userManagement.description' },
  { titleKey: 'landing.features.contractManagement.title', descriptionKey: 'landing.features.contractManagement.description' },
  { titleKey: 'landing.features.accessToFinance.title', descriptionKey: 'landing.features.accessToFinance.description' },
  { titleKey: 'landing.features.supportMonitoring.title', descriptionKey: 'landing.features.supportMonitoring.description' },
  { titleKey: 'landing.features.grievanceResolution.title', descriptionKey: 'landing.features.grievanceResolution.description' },
  { titleKey: 'landing.features.analyticsReporting.title', descriptionKey: 'landing.features.analyticsReporting.description' },
];

export const landingStakeholders = [
  'landing.stakeholders.farmers',
  'landing.stakeholders.cooperatives',
  'landing.stakeholders.contractors',
  'landing.stakeholders.financialInstitutions',
  'landing.stakeholders.governmentAuthorities',
  'landing.stakeholders.fieldAgents',
];

export const landingSteps = [
  'landing.steps.register',
  'landing.steps.contract',
  'landing.steps.monitoring',
  'landing.steps.settle',
];

export const landingFaq = [
  { questionKey: 'landing.faq.q1', answerKey: 'landing.faq.a1' },
  { questionKey: 'landing.faq.q2', answerKey: 'landing.faq.a2' },
  { questionKey: 'landing.faq.q3', answerKey: 'landing.faq.a3' },
  { questionKey: 'landing.faq.q4', answerKey: 'landing.faq.a4' },
  { questionKey: 'landing.faq.q5', answerKey: 'landing.faq.a5' },
];
