import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const exists = async (file) => access(path.join(root, file)).then(() => true, () => false);

export const canonicalSurfaces = Object.freeze({
  login: 'portal-login.html',
  onboarding: 'portal-premium-onboarding.html',
  anamnesis: 'anamnese-premium.html',
  home: 'portal-premium-home.html',
  nutrition: 'portal-premium-nutrition-plan.html',
  progression: 'portal-progressao.html',
  weeklyFeedback: 'portal-premium-weekly-feedback.html',
});

export async function collectPremiumStudentUxEvidence() {
  const source = Object.fromEntries(await Promise.all(Object.entries(canonicalSurfaces).map(async ([key, file]) => [key, await read(file)])));
  const homeLinks = [...source.home.matchAll(/<a\b[^>]*href=['"]([^'"]+)['"][^>]*>[\s\S]*?<\/a>/gi)]
    .map((match) => match[1]);
  const localHomeLinks = homeLinks.filter((href) => !/^(?:https?:|mailto:|tel:|#)/i.test(href));
  const destinations = Object.fromEntries(await Promise.all(localHomeLinks.map(async (href) => [href, await exists(href.split('#')[0])])));

  return {
    sourceFiles: canonicalSurfaces,
    viewports: [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }],
    homeLinks,
    destinations,
    checks: {
      allCanonicalSurfacesExist: (await Promise.all(Object.values(canonicalSurfaces).map(exists))).every(Boolean),
      homeLocalDestinationsExist: Object.values(destinations).every(Boolean),
      allSurfacesDeclareViewport: Object.values(source).every((html) => /<meta\s+name=['"]viewport['"]/i.test(html)),
      lifecycleCopyPresent: ['AWAITING_ANAMNESIS', 'UNDER_REVIEW', 'READY_TO_RELEASE', 'ENDED'].every((state) => source.onboarding.includes(state)),
      weeklyFeedbackHasHomeReturn: /href=['"]portal-premium-home\.html['"]/.test(source.weeklyFeedback),
      weeklyFeedbackApprovedQuestionnaire: !/\b(?:waist|abdomen)\b/i.test(source.weeklyFeedback),
      mutationDoubleSubmitGuards: /submitting=true/.test(source.anamnesis) && /isSubmitting=true/.test(await read('public/assets/js/portal-premium-weekly-feedback.js')),
      nutritionHasHomeReturn: /(?:href=['"]portal-premium-home\.html['"]|\bnav\s*\()/i.test(source.nutrition),
      progressionHasSubmitLock: /save\.disabled\s*=\s*true/.test(source.progression),
      progressionHasControlledHistoryError: /async function loadHist\(\)\s*\{\s*try\b/m.test(source.progression) || /loadHist\(\)\.catch\b/.test(source.progression),
      homeHasVisibleAccessLoading: !/body\s*\{\s*visibility\s*:\s*hidden\s*\}/i.test(source.home),
    },
    frozenFindingIds: ['UX-PREM-001', 'UX-PREM-002', 'UX-PREM-003', 'UX-PREM-004'],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const evidence = await collectPremiumStudentUxEvidence();
  const requiredChecks = ['allCanonicalSurfacesExist', 'homeLocalDestinationsExist', 'allSurfacesDeclareViewport', 'lifecycleCopyPresent', 'weeklyFeedbackHasHomeReturn', 'weeklyFeedbackApprovedQuestionnaire', 'mutationDoubleSubmitGuards', 'nutritionHasHomeReturn', 'progressionHasSubmitLock', 'progressionHasControlledHistoryError', 'homeHasVisibleAccessLoading'];
  const failed = requiredChecks.filter((key) => !evidence.checks[key]);
  console.log(JSON.stringify(evidence, null, 2));
  if (failed.length) {
    console.error(`F6.0 AUDIT EVIDENCE INVALID: ${failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('F6.0 STUDENT UX AUDIT: UX_GAPS_FOUND (evidence VALIDATED)');
  }
}
