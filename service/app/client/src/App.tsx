import { useState } from 'react';
import { FilterProvider } from '@/hooks/useFilters';
import Sidebar, { NAV_ITEMS, type PageId } from '@/components/Sidebar';
import Overview from '@/pages/Overview';
import Headcount from '@/pages/Headcount';
import Diversity from '@/pages/Diversity';
import Compensation from '@/pages/Compensation';
import Attrition from '@/pages/Attrition';
import Org from '@/pages/Org';
import Performance from '@/pages/Performance';
import Learning from '@/pages/Learning';
import Recruiting from '@/pages/Recruiting';
import Onboarding from '@/pages/Onboarding';
import Employees from '@/pages/Employees';
import Lineage from '@/pages/Lineage';
import Analyst from '@/pages/Analyst';
import AskCortexPage from '@/pages/AskCortexPage';
import AskCortex from '@/components/AskCortex';

// Per-page Ask Cortex topic + two suggested questions (server: routes/askCortex.ts).
const ASK: Record<string, { topic: string; suggestions: string[] }> = {
  overview: { topic: 'overview', suggestions: ['Are we hiring faster than we are losing people?', 'Which department dominates headcount, and is that a risk?'] },
  headcount: { topic: 'headcount', suggestions: ['How is headcount split across divisions and locations?', 'What share of the workforce is part-time or contingent?'] },
  diversity: { topic: 'diversity', suggestions: ['Where is female representation lowest by pay grade?', 'Which departments are least gender-balanced?'] },
  compensation: { topic: 'compensation', suggestions: ['Is there a gender pay gap within pay grades?', 'Which grades have compa-ratios furthest from 1.0?'] },
  attrition: { topic: 'attrition', suggestions: ['What are the top termination reasons and where do they concentrate?', 'Is attrition higher among early-tenure employees?'] },
  performance: { topic: 'performance', suggestions: ['Which departments have the strongest and weakest 2025 ratings?', 'Where are our high-potentials concentrated?'] },
  learning: { topic: 'learning', suggestions: ['Which courses have the lowest completion rates?', 'Which departments invest the most learning hours?'] },
  recruiting: { topic: 'recruiting', suggestions: ['Where is the recruiting funnel leaking most?', 'Which departments have the most open reqs and slowest time-to-fill?'] },
  onboarding: { topic: 'onboarding', suggestions: ['Which equipment items are most likely to delay new-hire start dates?', 'Which suppliers have the worst lead-time disruptions?'] },
  org: { topic: 'org', suggestions: ['Which departments have the widest or narrowest spans of control?', 'Where are critical positions concentrated?'] },
  employees: { topic: 'employees', suggestions: ['Which job titles are most common and how are they paid?', 'What does the top of the pay distribution look like?'] },
};

const PAGE_COMPONENTS: Record<string, React.FC> = {
  askcortex: AskCortexPage,
  overview: Overview,
  headcount: Headcount,
  diversity: Diversity,
  compensation: Compensation,
  attrition: Attrition,
  org: Org,
  performance: Performance,
  learning: Learning,
  recruiting: Recruiting,
  onboarding: Onboarding,
  employees: Employees,
  lineage: Lineage,
  analyst: Analyst,
};

function AppShell() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const navItem = NAV_ITEMS.find((n) => n.id === activePage)!;
  const Icon = navItem.icon;
  const PageComponent = PAGE_COMPONENTS[activePage];
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="ml-64 min-h-screen p-6">
        <div className="mb-6 flex items-center gap-3">
          <Icon className="h-6 w-6 text-sf-primary" />
          <h1 className="text-2xl font-bold text-sf-deeper">{navItem.label}</h1>
        </div>
        {ASK[activePage] && (
          <AskCortex key={activePage} className="mb-6" topic={ASK[activePage].topic}
            label={`Ask Cortex about ${navItem.label}`} suggestions={ASK[activePage].suggestions} />
        )}
        {PageComponent ? <PageComponent /> : null}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FilterProvider>
      <AppShell />
    </FilterProvider>
  );
}
