import { useMemo, useState } from "react";
import { students } from "../data/students";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Users,
  GraduationCap,
  Building2,
  RefreshCcw,
  Mail,
  Phone,
  IdCard,
} from "lucide-react";

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [careerFilter, setCareerFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");

  const careers = useMemo(
    () => [...new Set(students.map((s) => s.carrera).filter(Boolean))].sort(),
    [],
  );

  const sites = useMemo(
    () => [...new Set(students.map((s) => s.sede).filter(Boolean))].sort(),
    [],
  );

  const modalities = useMemo(
    () => [...new Set(students.map((s) => s.modalidad).filter(Boolean))].sort(),
    [],
  );

  const filteredStudents = useMemo(() => {
    const term = search.toLowerCase().trim();

    return students.filter((student) => {
      const fullName =
        `${student.apellidoPaterno} ${student.apellidoMaterno} ${student.nombres}`.toLowerCase();

      const matchesSearch =
        !term ||
        fullName.includes(term) ||
        String(student.codigoEstudiante || "")
          .toLowerCase()
          .includes(term) ||
        String(student.dni || "")
          .toLowerCase()
          .includes(term) ||
        String(student.correoInstitucional || "")
          .toLowerCase()
          .includes(term);

      const matchesCareer = !careerFilter || student.carrera === careerFilter;
      const matchesSite = !siteFilter || student.sede === siteFilter;
      const matchesModality =
        !modalityFilter || student.modalidad === modalityFilter;

      return matchesSearch && matchesCareer && matchesSite && matchesModality;
    });
  }, [search, careerFilter, siteFilter, modalityFilter]);

  const clearFilters = () => {
    setSearch("");
    setCareerFilter("");
    setSiteFilter("");
    setModalityFilter("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-primary">Estudiantes</h1>
        <p className="text-muted-foreground">
          Consulta general de estudiantes registrados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total estudiantes</p>
              <p className="text-2xl font-bold">{students.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Resultados</p>
              <p className="text-2xl font-bold">{filteredStudents.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100">
              <Search className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Carreras</p>
              <p className="text-2xl font-bold">{careers.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sedes</p>
              <p className="text-2xl font-bold">{sites.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm border-0">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <Input
                placeholder="Buscar por nombre, código, DNI o correo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={careerFilter}
              onChange={(e) => setCareerFilter(e.target.value)}
            >
              <option value="">Todas las carreras</option>
              {careers.map((career) => (
                <option key={career} value={career}>
                  {career}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
            >
              <option value="">Todas las sedes</option>
              {sites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={modalityFilter}
              onChange={(e) => setModalityFilter(e.target.value)}
            >
              <option value="">Todas las modalidades</option>
              {modalities.map((modality) => (
                <option key={modality} value={modality}>
                  {modality}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={clearFilters} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full min-w-[1450px] text-sm">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Ap. Paterno</th>
                  <th className="p-3 font-semibold">Ap. Materno</th>
                  <th className="p-3 font-semibold">Nombres</th>
                  <th className="p-3 font-semibold">Código</th>
                  <th className="p-3 font-semibold">DNI</th>
                  <th className="p-3 font-semibold">Facultad</th>
                  <th className="p-3 font-semibold">Carrera</th>
                  <th className="p-3 font-semibold">Celular</th>
                  <th className="p-3 font-semibold">Correo</th>
                  <th className="p-3 font-semibold">Sexo</th>
                  <th className="p-3 font-semibold">Sede</th>
                  <th className="p-3 font-semibold">Fecha examen</th>
                  <th className="p-3 font-semibold">Modalidad</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((student, index) => (
                  <tr
                    key={`${student.codigoEstudiante}-${index}`}
                    className="border-t hover:bg-slate-50"
                  >
                    <td className="p-3">{student.apellidoPaterno || "-"}</td>
                    <td className="p-3">{student.apellidoMaterno || "-"}</td>
                    <td className="p-3">{student.nombres || "-"}</td>
                    <td className="p-3">{student.codigoEstudiante || "-"}</td>
                    <td className="p-3">{student.dni || "-"}</td>
                    <td className="p-3">{student.facultad || "-"}</td>
                    <td className="p-3">{student.carrera || "-"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{student.celular || "-"}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{student.correoInstitucional || "-"}</span>
                      </div>
                    </td>
                    <td className="p-3">{student.sexo || "-"}</td>
                    <td className="p-3">{student.sede || "-"}</td>
                    <td className="p-3">{student.fechaExamen || "-"}</td>
                    <td className="p-3">{student.modalidad || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
