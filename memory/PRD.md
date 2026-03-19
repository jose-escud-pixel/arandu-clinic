# Arandu Clinic - PRD

## Problema Original
Aplicación universal de gestión de pacientes para clínicas médicas. Cada doctor configura su especialidad en su perfil.

## Stack
- Backend: FastAPI + MongoDB (motor) + JWT + reportlab (PDF)
- Frontend: React + TailwindCSS + Shadcn/UI + recharts
- Despliegue: Ubuntu 24.04 + Apache reverse proxy + PM2

## Completado
- [x] CRUD completo: Pacientes, Citas, Consultas, Recetas, Archivos
- [x] Autenticación JWT con roles (admin/doctor)
- [x] Sistema Administrador (aprobar/rechazar usuarios, cambiar contraseñas/roles)
- [x] Perfil del doctor (especialidad configurable, matrícula, cambio contraseña)
- [x] Foto de perfil + Logo personalizado para recetas PDF
- [x] Dashboard + Estadísticas avanzadas (admin ve totales globales)
- [x] Recetas PDF + Historial PDF (con logo y especialidad del doctor)
- [x] Diseño responsive para celular
- [x] Vista Global Admin (ve todos los pacientes/citas de todos los doctores)
- [x] Filtros por doctor en Pacientes y Citas (admin)
- [x] Log de Actividad con página dedicada
- [x] Búsqueda avanzada por diagnóstico/consulta/tratamiento
- [x] App genérica (sin referencias a traumatología, cualquier especialidad)

## Credenciales Test
- Admin: jose@aranduinformatica.net / secreto
