import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { appServices } from '../runtime/appServices';
import { router } from '../router';
import { ThemeProvider } from '../../core/themes/ThemeProvider';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export function AppProviders() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={appServices.queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
