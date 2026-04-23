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
import HorarioDocenteFica from "@/pages/horario-docente-fica";
import HorarioDocenteFcs from "@/pages/horario-docente-fcs";
import HorarioCarrera from "@/pages/horario-carrera";
import HorarioSemana from "@/pages/horario-semana";
import CrearPlanificacion from "@/pages/crear-planificacion";
import HorarioCruce from "@/pages/horario-cruce";
import ListaDocentes from "@/pages/lista-docentes";
import DocentesTC from "@/pages/docentes-tc";
import Actividad from "@/pages/actividad";
import HorarioSeccion from "@/pages/horario-seccion";
import RegistroEstudiante from "@/pages/registro-estudiante";
import ReporteEstudiantes from "@/pages/reporte-estudiantes";
import MapeoEstudiantes from "@/pages/mapeo-estudiantes";
import VerificacionData from "@/pages/verificacion-data";
import SinMatriculaAdmin from "@/pages/sin-matricula-admin";
import SinVacanteAdmin from "@/pages/sin-vacante-admin";
import DelegadosAdmin from "@/pages/delegados-admin";
import RegistroDelegado from "@/pages/registro-delegado";
import RegistroSinMatricula from "@/pages/registro-sin-matricula";
import RegistroRectificacion from "@/pages/registro-rectificacion";
import RectificacionesAdmin from "@/pages/rectificaciones-admin";
import Seguridad from "@/pages/seguridad";
import PlanillasAsistencia from "@/pages/planillas-asistencia";
import ResultadosPlanillas from "@/pages/resultados-planillas";
import ReporteAsistencia from "@/pages/reporte-asistencia";
import DivisionTareas from "@/pages/division-tareas";
import DocentesSinAsistencias from "@/pages/docentes-sin-asistencias";
import RegistroAsistencia from "@/pages/registro-asistencia";
import ReportarProblema from "@/pages/reportar-problema";
import ProblemasEstudiantes from "@/pages/problemas-estudiantes";
import JustificacionFalta from "@/pages/justificacion-falta";
import SoporteJustificacion from "@/pages/soporte-justificacion";
import ManualJustificacion from "@/pages/manual-justificacion";

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
        path="/estudiantes/sin-matricula"
        component={() => <ProtectedRoute component={SinMatriculaAdmin} />}
      />
      <Route
        path="/estudiantes/sin-vacante"
        component={() => <ProtectedRoute component={SinVacanteAdmin} />}
      />
      <Route
        path="/estudiantes/delegados"
        component={() => <ProtectedRoute component={DelegadosAdmin} />}
      />
      <Route path="/registro-delegado" component={RegistroDelegado} />
      <Route
        path="/docentes/horario-fica"
        component={() => <ProtectedRoute component={HorarioDocenteFica} />}
      />
      <Route
        path="/docentes/horario-fcs"
        component={() => <ProtectedRoute component={HorarioDocenteFcs} />}
      />
      <Route
        path="/horarios/carrera"
        component={() => <ProtectedRoute component={HorarioCarrera} />}
      />
      <Route
        path="/horarios/semana"
        component={() => <ProtectedRoute component={HorarioSemana} />}
      />
      <Route
        path="/planificacion/crear"
        component={() => <ProtectedRoute component={CrearPlanificacion} />}
      />
      <Route
        path="/planificacion/cruce"
        component={() => <ProtectedRoute component={HorarioCruce} />}
      />
      <Route
        path="/lista-docentes/fica"
        component={() => <ProtectedRoute component={() => <ListaDocentes initialFacultad="FICA" />} />}
      />
      <Route
        path="/lista-docentes/fcs"
        component={() => <ProtectedRoute component={() => <ListaDocentes initialFacultad="FCS" />} />}
      />
      <Route
        path="/lista-docentes/fica-tc"
        component={() => <ProtectedRoute component={DocentesTC} />}
      />
      <Route
        path="/actividad"
        component={() => <ProtectedRoute component={Actividad} />}
      />
      <Route
        path="/horarios/seccion"
        component={() => <ProtectedRoute component={HorarioSeccion} />}
      />
      <Route
        path="/registroestudiantesinhorario"
        component={RegistroEstudiante}
      />
      <Route
        path="/registro-sin-matricula"
        component={RegistroSinMatricula}
      />
      <Route
        path="/reporte-estudiantes"
        component={() => <ProtectedRoute component={ReporteEstudiantes} />}
      />
      <Route
        path="/mapeo-estudiantes"
        component={() => <ProtectedRoute component={MapeoEstudiantes} />}
      />
      <Route
        path="/verificacion-data"
        component={() => <ProtectedRoute component={VerificacionData} />}
      />
      <Route
        path="/registro-rectificacion"
        component={RegistroRectificacion}
      />
      <Route
        path="/rectificaciones"
        component={() => <ProtectedRoute component={RectificacionesAdmin} />}
      />
      <Route
        path="/seguridad"
        component={() => <ProtectedRoute component={Seguridad} />}
      />
      <Route
        path="/planillas-asistencia"
        component={() => <ProtectedRoute component={PlanillasAsistencia} />}
      />
      <Route
        path="/resultados-planillas"
        component={() => <ProtectedRoute component={ResultadosPlanillas} />}
      />
      <Route
        path="/reporte-asistencia"
        component={() => <ProtectedRoute component={ReporteAsistencia} />}
      />
      <Route
        path="/division-tareas"
        component={() => <ProtectedRoute component={DivisionTareas} />}
      />
      <Route
        path="/docentes-sin-asistencias"
        component={() => <ProtectedRoute component={DocentesSinAsistencias} />}
      />
      <Route path="/registro-asistencia" component={RegistroAsistencia} />
      <Route path="/reportar-problema" component={ReportarProblema} />
      <Route path="/manual-justificacion" component={ManualJustificacion} />
      <Route
        path="/justificacion-falta"
        component={() => <ProtectedRoute component={JustificacionFalta} />}
      />
      <Route
        path="/soporte-justificacion"
        component={() => <ProtectedRoute component={SoporteJustificacion} />}
      />
      <Route
        path="/problemas-estudiantes"
        component={() => <ProtectedRoute component={ProblemasEstudiantes} />}
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
