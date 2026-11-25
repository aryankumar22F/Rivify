import type { AppLanguage } from '../types';

export interface TranslationBundle {
  appName: string;
  toolkit: string;
  calculusQuiz: string;
  practice: string;
  calculusLab: string;
  flashcards: string;
  notebook: string;
  dashboard: string;
  mathSolver: string;
  graphingCalculator: string;
  scientificCalculator: string;
  differentialEquations: string;
  linearAlgebra: string;
  numericalMethods: string;
  probabilityStatistics: string;
  complexNumbers: string;
  mathScanner: string;
  examPrep: string;
  exportStudio: string;
  discreteMath: string;
  fourierLaplace: string;
  advancedGeometry: string;
  operationsResearch: string;
  mathWhiteboard: string;
  equationEditor: string;
  formulaDerivation: string;
  graphAnimation: string;
  smartRevision: string;
  virtualClassroom: string;
  questionPaper: string;
  researchWorkspace: string;
  unitConverter: string;
  matrixVisualizer: string;
  mathHistory: string;
  offlineMode: string;
  limitsContinuity: string;
  optimizationLab: string;
  vectorTheorems: string;
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
  appName: 'RIVIFY',
  toolkit: 'Engineering Math Toolkit',
  calculusQuiz: 'Practice & Quizzes',
  practice: 'Practice',
  calculusLab: '3D Calculus Lab',
  flashcards: 'Formula Flashcards',
  notebook: 'Math Notebook',
  dashboard: 'Learning Dashboard',
  mathSolver: 'Math Problem Solver',
  graphingCalculator: 'Graphing Calculator',
  scientificCalculator: 'Scientific Calculator',
  differentialEquations: 'Differential Equations Lab',
  linearAlgebra: 'Linear Algebra Lab',
  numericalMethods: 'Numerical Methods Lab',
  probabilityStatistics: 'Probability & Statistics',
  complexNumbers: 'Complex Numbers Lab',
  mathScanner: 'Math Scanner',
  examPrep: 'Exam Preparation Center',
  exportStudio: 'Math Export Studio',
  discreteMath: 'Discrete Mathematics Lab',
  fourierLaplace: 'Fourier & Laplace Transform',
  advancedGeometry: 'Advanced Geometry Lab',
  operationsResearch: 'Operations Research Lab',
  mathWhiteboard: 'Math Whiteboard',
  equationEditor: 'Equation Editor',
  formulaDerivation: 'Formula Derivation Engine',
  graphAnimation: 'Graph Animation Studio',
  smartRevision: 'Smart Revision System',
  virtualClassroom: 'Virtual Mathematics Classroom',
  questionPaper: 'Question Paper Generator',
  researchWorkspace: 'Research Workspace',
  unitConverter: 'Unit Converter',
  matrixVisualizer: 'Matrix Visualizer',
  mathHistory: 'Mathematical History',
  offlineMode: 'Offline Mathematics Mode',
  limitsContinuity: 'Limits & Continuity',
  optimizationLab: 'Optimization & Lagrange',
  vectorTheorems: 'Theorems, Diff & Potential',
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
  offlineBanner: 'Offline mode active — symbolic calculations, 3D graphs, scientific calculator, quizzes, flashcards, notebook, and local IndexedDB storage continue to work seamlessly.',
  settingsTitle: 'Calculator & Study Settings',
  languageLabel: 'Language',
  guestModeLabel: 'Guest Mode',
};

const HI: TranslationBundle = {
  appName: 'RIVIFY',
  toolkit: 'इंजीनियरिंग गणित टूलकिट',
  calculusQuiz: 'अभ्यास और क्विज़',
  practice: 'अभ्यास',
  calculusLab: '3D कैलकुलस लैब',
  flashcards: 'फ़ॉर्मूला फ़्लैशकार्ड',
  notebook: 'गणित नोटबुक',
  dashboard: 'लर्निंग डैशबोर्ड',
  mathSolver: 'गणित समस्या सॉल्वर',
  graphingCalculator: 'ग्राफ़िंग कैलकुलेटर',
  scientificCalculator: 'वैज्ञानिक कैलकुलेटर',
  differentialEquations: 'अवकल समीकरण लैब (ODE/PDE)',
  linearAlgebra: 'रैखिक बीजगणित लैब',
  numericalMethods: 'संख्यात्मक विधियाँ लैब',
  probabilityStatistics: 'प्रायिकता और सांख्यिकी',
  complexNumbers: 'सम्मिश्र संख्या लैब',
  mathScanner: 'मैथ स्कैनर (OCR)',
  examPrep: 'परीक्षा तैयारी केंद्र',
  exportStudio: 'मैथ एक्सपोर्ट स्टूडियो',
  discreteMath: 'विविक्त गणित लैब (Discrete)',
  fourierLaplace: 'फूरियर और लाप्लास रूपांतरण',
  advancedGeometry: 'उन्नत ज्यामिति लैब',
  operationsResearch: 'संक्रिया विज्ञान लैब (OR)',
  mathWhiteboard: 'गणित व्हाइटबोर्ड',
  equationEditor: 'समीकरण संपादक (LaTeX)',
  formulaDerivation: 'सूत्र व्युत्पत्ति इंजन',
  graphAnimation: 'ग्राफ़ एनीमेशन स्टूडियो',
  smartRevision: 'स्मार्ट पुनरीक्षण प्रणाली',
  virtualClassroom: 'वर्चुअल गणित कक्षा',
  questionPaper: 'प्रश्न पत्र जनरेटर',
  researchWorkspace: 'शोध कार्यक्षेत्र (Research)',
  unitConverter: 'इकाई परिवर्तक (Units)',
  matrixVisualizer: 'मैट्रिक्स विज़ुअलाइज़र',
  mathHistory: 'गणितीय इतिहास',
  offlineMode: 'ऑफ़लाइन गणित मोड',
  limitsContinuity: 'सीमा और सातत्य (Limits)',
  optimizationLab: 'इष्टतमीकरण और लैग्रेंज',
  vectorTheorems: 'प्रमेय, चेन रूल व विभव',
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
  offlineBanner: 'ऑफ़लाइन मोड सक्रिय — प्रतीकात्मक गणना, 3D ग्राफ़, वैज्ञानिक कैलकुलेटर, क्विज़, फ़्लैशकार्ड, नोटबुक और स्थानीय स्टोरेज बिना इंटरनेट काम करते रहेंगे।',
  settingsTitle: 'कैलकुलेटर और अध्ययन सेटिंग्स',
  languageLabel: 'भाषा / Language',
  guestModeLabel: 'अतिथि मोड (Guest Mode)',
};

export function getTranslations(lang: AppLanguage): TranslationBundle {
  return lang === 'hi' ? HI : EN;
}
