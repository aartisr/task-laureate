import { useNavigate } from '@tanstack/react-router';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { PageContainer } from '../components/layouts';
import { usePageNav } from '../hooks/usePageNav';
import { appServices } from '../app/runtime/appServices';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

export function ActivityPage() {
  usePageSEO(PAGE_SEO.activity);
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
      footer={<p className="activity-page__tip">Press <kbd>Esc</kbd> to return to your dashboard.</p>}
    >
      {/* Activity Timeline */}
      <div className="activity-page__surface">
        <ActivityTimeline repository={repository} maxItems={100} />
      </div>
    </PageContainer>
  );
}
