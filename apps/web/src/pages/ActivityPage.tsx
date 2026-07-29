import { useNavigate } from '@tanstack/react-router';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { PageContainer } from '../components/layouts';
import { usePageNav } from '../hooks/usePageNav';
import { appServices } from '../app/runtime/appServices';

export function ActivityPage() {
  const navigate = useNavigate();
  const repository = appServices.repository;

  // Generic page navigation (handles Escape to go back)
  usePageNav({ onEscapeGoBack: true, escapeBackTo: '/' });

  return (
    <PageContainer
      title="Activity"
      subtitle="Timeline of all changes and actions"
      backButton={{ label: 'Back', to: '/' }}
      ariaLabel="Activity log"
      spacing="normal"
      footer={
        <div className="text-center text-sm text-[var(--color-text-secondary)]">
          <p>
            💡 Tip: Press <kbd className="bg-[var(--color-bg-secondary)] px-2 py-1 rounded">Esc</kbd> to return to dashboard
          </p>
        </div>
      }
    >
      {/* Activity Timeline */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-md p-8">
        <ActivityTimeline repository={repository} maxItems={100} />
      </div>
    </PageContainer>
  );
}
