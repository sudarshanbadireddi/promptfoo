import { useEffect } from 'react';

import PylonChat from '@app/components/PylonChat';
import { Spinner } from '@app/components/ui/spinner';
import { UserProvider } from '@app/contexts/UserContext';
import { usePageMeta } from '@app/hooks/usePageMeta';
import { useUserStore } from '@app/stores/userStore';
import { useSearchParams } from 'react-router-dom';
import Report from './components/Report';
import ReportIndex from './components/ReportIndex';

export default function ReportPage() {
  const [searchParams] = useSearchParams();
  const { isLoading, fetchEmail } = useUserStore();
  const evalId = searchParams.get('evalId');
  usePageMeta({
    title: 'Red Team Vulnerability Reports',
    description: 'View or browse red team results',
  });

  useEffect(() => {
    fetchEmail();
  }, [fetchEmail]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 justify-center items-center h-36">
        <Spinner className="size-6" />
        <span className="text-sm text-muted-foreground">Waiting for report data</span>
      </div>
    );
  }

  return (
    <UserProvider>
      {evalId ? <Report /> : <ReportIndex />}
      <PylonChat />
    </UserProvider>
  );
}
