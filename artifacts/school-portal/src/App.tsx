import React from "react";
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
import StudentsPage from "@/pages/StudentsPage";
import DirectivaMatricula from "@/pages/directiva-matricula";
import PlanificacionFCS from "@/pages/planificacion-fcs";
import PlanificacionFICA from "@/pages/planificacion-fica";
import ListaDocentes from "@/pages/lista-docentes";
import ListaDocentesFICA from "@/pages/lista-docentes-fica";
import ExtractorDocentes from "@/pages/extractor-docentes";
import DocentesRegistro from "@/pages/docentes-registro";
import VerificacionFICA from "@/pages/verificacion-fica";
import DocentesFICA2026 from "@/pages/docentes-fica-2026";
import ComparacionFICA from "@/pages/comparacion-fica";
import HorarioDocente from "@/pages/horario-docente";
import EnviarCorreo from "@/pages/enviar-correo";
import HorarioCarrera from "@/pages/horario-carrera";

const queryClient = new QueryClient();

type ProtectedRouteProps = {
  component: React.ComponentType;
};

function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function AppRouter() {
  return (
    <Switch>
      {/* Pública */}
      <Route path="/login" component={Login} />

      {/* Protegidas */}
      <Route
        path="/"
        component={() => <ProtectedRoute component={Dashboard} />}
      />
      <Route
        path="/horarios-docentes"
        component={() => <ProtectedRoute component={TeacherSchedules} />}
      />
      <Route
        path="/horarios-seccion"
        component={() => <ProtectedRoute component={SectionSchedules} />}
      />
      <Route
        path="/cursos"
        component={() => <ProtectedRoute component={Courses} />}
      />
      <Route
        path="/calendario"
        component={() => <ProtectedRoute component={Calendar2026} />}
      />
      <Route
        path="/usuarios"
        component={() => <ProtectedRoute component={Users} />}
      />
      <Route
        path="/roles"
        component={() => <ProtectedRoute component={Roles} />}
      />
      <Route
        path="/avisos"
        component={() => <ProtectedRoute component={Announcements} />}
      />
      <Route
        path="/reportes"
        component={() => <ProtectedRoute component={Reports} />}
      />
      <Route
        path="/configuracion"
        component={() => <ProtectedRoute component={Settings} />}
      />
      <Route
        path="/estudiantes"
        component={() => <ProtectedRoute component={StudentsPage} />}
      />
      <Route
        path="/directiva-matricula"
        component={() => <ProtectedRoute component={DirectivaMatricula} />}
      />
      <Route
        path="/planificacion/fcs"
        component={() => <ProtectedRoute component={PlanificacionFCS} />}
      />
      <Route
        path="/planificacion/fica"
        component={() => <ProtectedRoute component={PlanificacionFICA} />}
      />
      <Route
        path="/planificacion/lista-docentes"
        component={() => <ProtectedRoute component={ListaDocentes} />}
      />
      <Route
        path="/planificacion/lista-docentes-fica"
        component={() => <ProtectedRoute component={ListaDocentesFICA} />}
      />
      <Route
        path="/planificacion/extractor-docentes"
        component={() => <ProtectedRoute component={ExtractorDocentes} />}
      />
      <Route
        path="/docentes/registro"
        component={() => <ProtectedRoute component={DocentesRegistro} />}
      />
      <Route
        path="/docentes/verificacion-fica"
        component={() => <ProtectedRoute component={VerificacionFICA} />}
      />
      <Route
        path="/docentes/fica-2026"
        component={() => <ProtectedRoute component={DocentesFICA2026} />}
      />
      <Route
        path="/docentes/comparacion-fica"
        component={() => <ProtectedRoute component={ComparacionFICA} />}
      />
      <Route
        path="/docentes/horario-docente"
        component={() => <ProtectedRoute component={HorarioDocente} />}
      />
      <Route
        path="/docentes/enviar-correo"
        component={() => <ProtectedRoute component={EnviarCorreo} />}
      />
      <Route
        path="/horarios/carrera"
        component={() => <ProtectedRoute component={HorarioCarrera} />}
      />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const routerBase = (import.meta.env.BASE_URL || "").replace(/\/$/, "");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={routerBase}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
