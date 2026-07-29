import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  useParams,
} from '@tanstack/react-router';
import { appServices } from './runtime/appServices';
import { AppShell } from '../components/AppShell';
import { ActivityPage } from '../pages/ActivityPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ListDetailPage } from '../pages/ListDetailPage';
import { SearchPage } from '../pages/SearchPage';
import { SettingsPage } from '../pages/SettingsPage';
import { listQueryOptions, listTasksQueryOptions, dashboardQueryOptions, activityQueryOptions, searchQueryOptions } from '../core/contracts/queryKeys';

const rootRoute = createRootRouteWithContext<{
  queryClient: typeof appServices.queryClient;
}>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <AppShell navItems={appServices.registry.getNavItems()}>
      <Outlet />
    </AppShell>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: async () => {
    await appServices.queryClient.prefetchQuery(dashboardQueryOptions(appServices.repository));
  },
  component: DashboardRoute,
});

const listRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'lists/$listId',
  loader: async ({ params }) => {
    await Promise.all([
      appServices.queryClient.prefetchQuery(listQueryOptions(appServices.repository, params.listId)),
      appServices.queryClient.prefetchQuery(listTasksQueryOptions(appServices.repository, params.listId)),
    ]);
  },
  component: ListDetailRoute,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'search',
  loader: async () => {
    await appServices.queryClient.prefetchQuery(searchQueryOptions(appServices.repository, ''));
  },
  component: SearchRoute,
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'activity',
  loader: async () => {
    await appServices.queryClient.prefetchQuery(activityQueryOptions(appServices.repository));
  },
  component: ActivityRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: SettingsRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  listRoute,
  searchRoute,
  activityRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient: appServices.queryClient,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 5_000,
});

function DashboardRoute() {
  return <DashboardPage />;
}

function ListDetailRoute() {
  const params = useParams({ strict: false }) as { listId?: string };
  return <ListDetailPage listId={params.listId ?? ''} />;
}

function SearchRoute() {
  return <SearchPage />;
}

function ActivityRoute() {
  return <ActivityPage />;
}

function SettingsRoute() {
  return <SettingsPage />;
}
