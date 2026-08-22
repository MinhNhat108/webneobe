import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar, ActiveSection } from './Sidebar';
import { ImportDialog } from '../excel/ImportDialog';
import { ProjectForm } from '../input/ProjectForm';
import { RaftForm } from '../input/RaftForm';
import { EnvForm } from '../input/EnvForm';
import { LineForm } from '../input/LineForm';
import { AnchorForm } from '../input/AnchorForm';
import { CriteriaForm } from '../input/CriteriaForm';
import { MooringLayoutMap } from '../map/MooringLayoutMap';
import { VerdictBadge } from '../results/VerdictBadge';
import { CheckTable } from '../results/CheckTable';
import { IntermediateTable } from '../results/IntermediateTable';
import { CatenarySketch } from '../results/CatenarySketch';
import { RaftsOverviewTable } from '../results/RaftsOverviewTable';
import { AttachmentPanel } from '../files/AttachmentPanel';
import { ReportView } from '../report/ReportView';
import { GuideView } from '../guide/GuideView';
import { useProjectStore } from '../../store/useProjectStore';

interface AppShellProps {
  onLock?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ onLock }) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>('project');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);

  const { currentProject, results } = useProjectStore();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        onOpenImport={() => setIsImportOpen(true)}
        onGoToReport={() => setActiveSection('report')}
        onGoToGuide={() => setActiveSection('guide')}
        onLock={onLock}
      />

      {/* Main Body with Sidebar and Content Area */}
      <div className="flex-1 flex max-w-app w-full mx-auto">
        <Sidebar
          activeSection={activeSection}
          onSelectSection={(sec) => setActiveSection(sec)}
        />

        {/* Main Content Pane */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 overflow-x-hidden min-w-0">
          {/* Section 1: Project & Rafts */}
          {activeSection === 'project' && (
            <div className="section-stack">
              <ProjectForm />
              {currentProject.systemType === 'solar_fpv' && <RaftsOverviewTable />}
              <MooringLayoutMap />
            </div>
          )}

          {/* Section 2: Input Forms */}
          {activeSection === 'input' && (
            <div className="section-stack">
              <RaftForm />
              <EnvForm />
              <LineForm />
              <AnchorForm />
              <CriteriaForm />
            </div>
          )}

          {/* Section 3: Map & Coordinates */}
          {activeSection === 'map' && (
            <div className="section-stack">
              <MooringLayoutMap />
            </div>
          )}

          {/* Section 4: Results & Checks */}
          {activeSection === 'results' && (
            <div className="section-stack">
              <VerdictBadge
                status={results.overallVerdict}
                governingCheck={results.governingCheck}
              />
              <CheckTable checks={results.checks} />
              <IntermediateTable state={currentProject} results={results} />
              {results.catenaryApplies && (
                <CatenarySketch state={currentProject} results={results} />
              )}
              {currentProject.systemType === 'solar_fpv' && <RaftsOverviewTable />}
            </div>
          )}

          {/* Section 5: Attachments & Previews */}
          {activeSection === 'files' && (
            <div className="section-stack">
              <AttachmentPanel />
            </div>
          )}

          {/* Section 6: Report */}
          {activeSection === 'report' && (
            <div className="animate-in fade-in duration-200">
              <ReportView />
            </div>
          )}

          {/* Section 7: User Calculation Guide */}
          {activeSection === 'guide' && (
            <div className="animate-in fade-in duration-200">
              <GuideView onSelectSection={(sec) => setActiveSection(sec)} />
            </div>
          )}

          {/* Mandatory Engineering Disclaimer per SPEC §2.3 */}
          <div className="no-print p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed shadow-sm">
            <span className="font-bold">Khuyến cáo kỹ thuật:</span> Kết quả mang tính tham khảo kỹ thuật. Các thông số vật liệu (MBL cáp, sức chịu cọc Broms, hệ số bám neo) phải được kiểm chứng theo catalogue nhà sản xuất và quy chuẩn áp dụng (TCVN, QCVN, DNV-ST-0119, API RP 2SK).
          </div>
        </main>
      </div>

      {/* Excel Import Dialog */}
      <ImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
};
