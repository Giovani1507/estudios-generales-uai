import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import TeacherSchedules from "@/pages/teacher-schedules";
import SectionSchedules from "@/pages/section-schedules";
import Courses from "@/pages/courses";
import Calendar2026 from "@/pages/calendar";
import Users from "@/pages/users";
import Roles from "@/pages/roles";
import Announcements from "@/pages/announcements";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/horarios-docentes">
        <ProtectedRoute component={TeacherSchedules} />
      </Route>
      <Route path="/horarios-seccion">
        <ProtectedRoute component={SectionSchedules} />
      </Route>
      <Route path="/cursos">
        <ProtectedRoute component={Courses} />
      </Route>
      <Route path="/calendario">
        <ProtectedRoute component={Calendar2026} />
      </Route>
      <Route path="/usuarios">
        <ProtectedRoute component={Users} />
      </Route>
      <Route path="/roles">
        <ProtectedRoute component={Roles} />
      </Route>
      <Route path="/avisos">
        <ProtectedRoute component={Announcements} />
      </Route>
      <Route path="/reportes">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/configuracion">
        <ProtectedRoute component={Settings} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
