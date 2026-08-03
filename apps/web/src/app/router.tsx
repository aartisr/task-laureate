import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  useParams,
  useRouterState,
} from '@tanstack/react-router';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { appServices } from './runtime/appServices';
import { AppShell } from '../components/AppShell';
import { BackgroundWatermark } from '../components/BackgroundWatermark';
import { listQueryOptions, listTasksQueryOptions, dashboardQueryOptions, activityQueryOptions, searchQueryOptions } from '../core/contracts/queryKeys';

const page = <T extends Record<string, ComponentType<any>>>(load: () => Promise<T>, name: keyof T) => lazy(async () => ({ default: (await load())[name] }));
const ActivityPage = page(() => import('../pages/ActivityPage'), 'ActivityPage'); const DashboardPage = page(() => import('../pages/DashboardPage'), 'DashboardPage'); const ListDetailPage = page(() => import('../pages/ListDetailPage'), 'ListDetailPage'); const ListsPage = page(() => import('../pages/ListsPage'), 'ListsPage'); const TasksPage = page(() => import('../pages/TasksPage'), 'TasksPage'); const CompletedPage = page(() => import('../pages/CompletedPage'), 'CompletedPage'); const ProgressPage = page(() => import('../pages/ProgressPage'), 'ProgressPage'); const SearchPage = page(() => import('../pages/SearchPage'), 'SearchPage'); const SettingsPage = page(() => import('../pages/SettingsPage'), 'SettingsPage'); const SupportPage = page(() => import('../pages/SupportPage'), 'SupportPage'); const AuthCallbackPage = page(() => import('../pages/AuthCallbackPage'), 'AuthCallbackPage'); const SignInPage = page(() => import('../pages/SignInPage'), 'SignInPage'); const TaskFocusPage = page(() => import('../pages/TaskFocusPage'), 'TaskFocusPage'); const SharedWithMePage = page(() => import('../pages/SharedWithMePage'), 'SharedWithMePage'); const AcceptSharePage = page(() => import('../pages/AcceptSharePage'), 'AcceptSharePage');
const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<main className="page-surface" aria-busy="true">Loading…</main>}>{children}</Suspense>;

const rootRoute = createRootRouteWithContext<{
  queryClient: typeof appServices.queryClient;
}>()({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // OAuth callbacks are deliberately free of navigation chrome so the person
  // sees one unambiguous completion state while the session is exchanged.
  if (pathname === '/auth/callback' || pathname === '/sign-in' || pathname === '/share/accept') return <><BackgroundWatermark /><Outlet /></>;
  return <>
    <BackgroundWatermark />
    <AppShell navItems={appServices.registry.getNavItems()}>
      <Outlet />
    </AppShell>
  </>;
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

const taskFocusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'lists/$listId/tasks/$taskId',
  loader: async ({ params }) => {
    await Promise.all([
      appServices.queryClient.prefetchQuery(listQueryOptions(appServices.repository, params.listId)),
      appServices.queryClient.prefetchQuery(listTasksQueryOptions(appServices.repository, params.listId)),
    ]);
  },
  component: TaskFocusRoute,
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

const listsOverviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'lists-overview',
  loader: async () => {
    await appServices.queryClient.prefetchQuery(dashboardQueryOptions(appServices.repository));
  },
  component: () => <Lazy><ListsPage /></Lazy>,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tasks',
  loader: async () => {
    await appServices.queryClient.prefetchQuery(dashboardQueryOptions(appServices.repository));
  },
  component: () => <Lazy><TasksPage /></Lazy>,
});

const completedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'completed',
  loader: async () => {
    await appServices.queryClient.prefetchQuery(dashboardQueryOptions(appServices.repository));
  },
  component: () => <Lazy><CompletedPage /></Lazy>,
});

const progressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'progress',
  loader: async () => {
    await appServices.queryClient.prefetchQuery(dashboardQueryOptions(appServices.repository));
  },
  component: () => <Lazy><ProgressPage /></Lazy>,
});

const supportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'support',
  component: () => <Lazy><SupportPage /></Lazy>,
});

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'auth/callback',
  component: () => <Lazy><AuthCallbackPage /></Lazy>,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'sign-in',
  component: () => <Lazy><SignInPage /></Lazy>,
});

const sharedWithMeRoute = createRoute({ getParentRoute: () => rootRoute, path: 'shared-with-me', component: () => <Lazy><SharedWithMePage /></Lazy> });
const acceptShareRoute = createRoute({ getParentRoute: () => rootRoute, path: 'share/accept', component: () => <Lazy><AcceptSharePage /></Lazy> });

const routeTree = rootRoute.addChildren([
  indexRoute,
  listRoute,
  taskFocusRoute,
  searchRoute,
  activityRoute,
  settingsRoute,
  listsOverviewRoute,
  tasksRoute,
  completedRoute,
  progressRoute,
  supportRoute,
  authCallbackRoute,
  signInRoute,
  sharedWithMeRoute,
  acceptShareRoute,
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
  return <Lazy><DashboardPage /></Lazy>;
}

function ListDetailRoute() {
  const params = useParams({ strict: false }) as { listId?: string };
  return <Lazy><ListDetailPage listId={params.listId ?? ''} /></Lazy>;
}

function TaskFocusRoute() {
  const params = useParams({ strict: false }) as { listId?: string; taskId?: string };
  return <Lazy><TaskFocusPage listId={params.listId ?? ''} taskId={params.taskId ?? ''} /></Lazy>;
}

function SearchRoute() {
  return <Lazy><SearchPage /></Lazy>;
}

function ActivityRoute() {
  return <Lazy><ActivityPage /></Lazy>;
}

function SettingsRoute() {
  return <Lazy><SettingsPage /></Lazy>;
}
