import type { AppLanguage } from '../types';

export interface TranslationBundle {
  appName: string;
  toolkit: string;
  calculusQuiz: string;
  practice: string;
  calculusLab: string;
  flashcards: string;
  notebook: string;
  arena: string;
  assistant: string;
  dashboard: string;
  matrixOperators: string;
  seriesIntegrals: string;
  formulaLibrary: string;
  aboutDeveloper: string;
  partialDerivative: string;
  gradient: string;
  directionalDerivative: string;
  maximaMinima: string;
  linearApproximation: string;
  vectorField: string;
  calculate: string;
  clearAll: string;
  evaluate: string;
  result: string;
  steps: string;
  share: string;
  exportPdf: string;
  saveToNotebook: string;
  guestBanner: string;
  offlineBanner: string;
  settingsTitle: string;
  languageLabel: string;
  guestModeLabel: string;
}

const EN: TranslationBundle = {
  appName: 'Derivify',
  toolkit: 'Calculus Toolkit',
  calculusQuiz: 'Calculus Quiz',
  practice: 'Practice',
  calculusLab: '3D Calculus Lab',
  flashcards: 'Formula Flashcards',
  notebook: 'Math Notebook',
  arena: 'Challenges & Leaderboard',
  assistant: 'AI Calculus Assistant',
  dashboard: 'Learning Dashboard',
  matrixOperators: 'Jacobian, Hessian & Laplacian',
  seriesIntegrals: 'Series & Multiple Integrals',
  formulaLibrary: 'Formula Library',
  aboutDeveloper: 'About Developer',
  partialDerivative: 'Partial Derivative',
  gradient: 'Gradient',
  directionalDerivative: 'Directional Derivative',
  maximaMinima: 'Maxima & Minima Test',
  linearApproximation: 'Linear Approximation',
  vectorField: 'Vector Field',
  calculate: 'Calculate',
  clearAll: 'Clear All',
  evaluate: 'Evaluate',
  result: 'Result',
  steps: 'Steps',
  share: 'Share',
  exportPdf: 'PDF',
  saveToNotebook: 'Save Note',
  guestBanner: 'Guest Mode active — changes are kept for this session only and will not alter your saved profile.',
  offlineBanner: 'Offline mode active — symbolic calculations, 3D graphs, quizzes, flashcards, notebook, and local IndexedDB storage continue to work seamlessly.',
  settingsTitle: 'Calculator & Study Settings',
  languageLabel: 'Language',
  guestModeLabel: 'Guest Mode',
};

const HI: TranslationBundle = {
  appName: 'Derivify',
  toolkit: 'कैलकुलस टूलकिट',
  calculusQuiz: 'कैलकुलस क्विज़',
  practice: 'अभ्यास',
  calculusLab: '3D कैलकुलस लैब',
  flashcards: 'फ़ॉर्मूला फ़्लैशकार्ड',
  notebook: 'गणित नोटबुक',
  arena: 'चुनौतियाँ और लीडरबोर्ड',
  assistant: 'AI कैलकुलस सहायक',
  dashboard: 'लर्निंग डैशबोर्ड',
  matrixOperators: 'जैकोबियन, हेसियन और लाप्लासियन',
  seriesIntegrals: 'श्रेणी और बहु-समाकलन',
  formulaLibrary: 'फ़ॉर्मूला लाइब्रेरी',
  aboutDeveloper: 'डेवलपर परिचय',
  partialDerivative: 'आंशिक अवकलज',
  gradient: 'ग्रेडिएंट',
  directionalDerivative: 'दिशात्मक अवकलज',
  maximaMinima: 'उच्चिष्ट और निम्निष्ट परीक्षण',
  linearApproximation: 'रैखिक सन्निकटन',
  vectorField: 'सदिश क्षेत्र',
  calculate: 'गणना करें',
  clearAll: 'साफ़ करें',
  evaluate: 'मान निकालें',
  result: 'परिणाम',
  steps: 'चरण',
  share: 'साझा करें',
  exportPdf: 'PDF',
  saveToNotebook: 'नोट सहेजें',
  guestBanner: 'अतिथि मोड सक्रिय है — बदलाव केवल इस सत्र के लिए रखे जाएंगे और आपकी सहेजी गई प्रोफ़ाइल नहीं बदलेंगे।',
  offlineBanner: 'ऑफ़लाइन मोड सक्रिय — प्रतीकात्मक गणना, 3D ग्राफ़, क्विज़, फ़्लैशकार्ड, नोटबुक और स्थानीय स्टोरेज बिना इंटरनेट काम करते रहेंगे।',
  settingsTitle: 'कैलकुलेटर और अध्ययन सेटिंग्स',
  languageLabel: 'भाषा / Language',
  guestModeLabel: 'अतिथि मोड (Guest Mode)',
};

export function getTranslations(lang: AppLanguage): TranslationBundle {
  return lang === 'hi' ? HI : EN;
}
