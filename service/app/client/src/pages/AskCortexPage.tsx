import AskCortex from '@/components/AskCortex';

const SUGGESTIONS = [
  'Which departments have the highest attrition, and what is driving it?',
  'Is there a gender pay gap, and where is it largest?',
  'How healthy is our recruiting pipeline and time-to-fill?',
  'Where should we focus learning investment next?',
  'How are 2025 performance ratings and high-potentials distributed?',
  'Give me a one-paragraph workforce briefing for the CHRO.',
];

export default function AskCortexPage() {
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-gray-600">
        Ask Cortex reads a live, cross-functional fact set from SAP_PEOPLE_360 — workforce, compensation, attrition,
        performance, learning and recruiting from SAP SuccessFactors via SAP BDC — and answers using only those facts.
      </p>
      <AskCortex topic="general" label="Run workforce briefing" suggestions={SUGGESTIONS} startOpen />
    </div>
  );
}
