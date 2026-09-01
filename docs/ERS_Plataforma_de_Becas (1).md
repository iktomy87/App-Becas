# Documento de Especificación de Requisitos de Software (ERS)

## Plataforma de Becas

*(Estándar IEEE 830)*

| Campo | Detalle |
|---|---|
| Código de documento | ERS-PDB-001 |
| Versión | 1.1 |
| Fecha | 20 de agosto de 2026 |
| Estado | Borrador para revisión |
| Autor | Analista Funcional / Arquitecto de Software |
| Stack tecnológico de referencia | Backend: Node.js + NestJS · Frontend: React + Vue |
| Metodología documental | Docs-as-Code |

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Descripción General](#2-descripción-general)
3. [Requisitos Específicos](#3-requisitos-específicos)
4. [Propuesta de Arquitectura de Software](#4-propuesta-de-arquitectura-de-software)
5. [Anexos](#5-anexos)

---

## 1. Introducción

### 1.1 Propósito

El presente documento tiene como propósito especificar de manera completa, verificable y no ambigua los requisitos funcionales y no funcionales de la **Plataforma de Becas**, destinada a automatizar el ciclo de carga de postulaciones, evaluación, ranking y asignación de estudiantes a propuestas de becas (proyectos de servicio y/o investigación) dentro de una institución universitaria.

Este ERS está dirigido al equipo de desarrollo (backend en Node.js/NestJS, frontend en React y Vue), al equipo de QA, a los responsables funcionales de Bienestar Estudiantil / Secretaría Académica, y a cualquier stakeholder que participe en la validación, mantenimiento o evolución del sistema. Se adopta como referencia estructural el estándar IEEE 830-1998 para la organización de los requisitos.

### 1.2 Alcance

La Plataforma de Becas digitaliza y automatiza el siguiente flujo de negocio:

1. Publicación de propuestas de becas (proyectos) por parte de docentes/responsables, incluyendo la cantidad de vacantes disponibles.
2. **Carga masiva de postulaciones mediante una planilla de Excel**: el proceso de inscripción de los estudiantes a las propuestas **no se realiza dentro de la plataforma**; se realiza por un canal externo (formulario físico, planilla institucional u otro medio administrativo), y es el Docente/Responsable o el Administrador quien consolida esa información —incluyendo el orden de preferencia de hasta 5 propuestas por estudiante— en una planilla Excel con formato estándar, y la carga en la plataforma.
3. Cierre del período de carga de postulaciones y cálculo automático de un ranking de mérito por propuesta, en base a una fórmula de evaluación ponderada y configurable.
4. Ejecución de un motor de asignación automática que cruza el ranking de mérito, el orden de preferencias declarado en la planilla cargada y la disponibilidad real de vacantes.
5. Publicación de resultados de asignación y generación de reportes/trazabilidad para auditoría administrativa.

**Fuera de alcance** de esta versión: la gestión de pagos/estipendios de becas, la integración con sistemas de expediente académico externos (se asume la existencia de una fuente de datos o carga que provee materias aprobadas, promedio y avance), el desarrollo de un formulario de autopostulación para el estudiante dentro de la plataforma, y la gestión de reclamos/recursos administrativos posteriores a la asignación.

> **Nota de negocio clave:** el estudiante **no se inscribe ni se postula directamente en la plataforma**. Su rol dentro del sistema es de **consulta** (ver propuestas publicadas de forma informativa y consultar el resultado de su asignación). El registro de la postulación y del orden de preferencias ingresa al sistema exclusivamente a través de la carga de una planilla Excel.

### 1.3 Definiciones, Acrónimos y Abreviaturas

| Término | Definición |
|---|---|
| Plataforma de Becas | Sistema objeto de este documento. |
| Propuesta | Proyecto de servicio o investigación publicado por un docente/responsable, que ofrece una cantidad determinada de vacantes de beca. |
| Planilla de Postulaciones | Archivo Excel (.xlsx) con formato estándar, que contiene los datos de inscripción de los estudiantes y su orden de preferencia entre propuestas. |
| Postulación | Registro derivado de una fila válida de la Planilla de Postulaciones, que vincula a un estudiante con una propuesta y un orden de preferencia. |
| Ranking | Listado ordenado de estudiantes postulantes a una propuesta (o al proceso general), calculado mediante una fórmula de ponderación de variables académicas. |
| Motor de Asignación | Componente del sistema responsable de asignar automáticamente estudiantes a propuestas, cruzando ranking, preferencias y vacantes. |
| Estrategia de Ranking | Algoritmo de cálculo de puntaje, encapsulado bajo el patrón Strategy, que puede variar en el tiempo sin afectar al resto del sistema. |
| RF / RNF / RN | Requisito Funcional / Requisito No Funcional / Regla de Negocio, respectivamente. |
| Docs-as-Code | Enfoque de gestión documental donde la documentación se versiona, revisa y despliega con el mismo flujo de trabajo que el código fuente (Git, Pull Requests, CI/CD). |
| Vacante | Cupo disponible dentro de una propuesta para asignar a un estudiante. |
| BFF | Backend For Frontend: capa de API orientada a servir a los distintos frontends (React/Vue) de forma desacoplada. |

### 1.4 Referencias

- IEEE Std 830-1998 — Recommended Practice for Software Requirements Specifications.
- Documentación oficial de NestJS (https://docs.nestjs.com).
- Documentación oficial de React (https://react.dev) y de Vue (https://vuejs.org).
- Reglamento académico institucional de becas de servicio e investigación (documento interno, a anexar por la institución).
- Lineamientos internos de Docs-as-Code del equipo de desarrollo.

### 1.5 Visión General del Documento

La Sección 2 describe el producto de forma general: perspectiva, funciones principales, usuarios y restricciones. La Sección 3 detalla los requisitos específicos —funcionales, no funcionales y reglas de negocio— con identificadores únicos para trazabilidad. La Sección 4 presenta la propuesta de arquitectura de software, incluyendo la convivencia de React y Vue en el frontend y los patrones de diseño (Strategy, Observer, Facade) aplicados sobre NestJS. La Sección 5 incluye anexos de soporte, incluyendo el flujo de proceso, el formato de la planilla y una matriz de trazabilidad preliminar.

---

## 2. Descripción General

### 2.1 Perspectiva del Producto

La Plataforma de Becas es un sistema nuevo, autocontenido, que se integrará —mediante APIs REST expuestas por el backend NestJS— con clientes web construidos en React y en Vue. Se concibe como un sistema de misión semi-crítica dentro del calendario académico: durante la ventana de carga de postulaciones y, especialmente, durante el cierre de convocatoria y la corrida del motor de asignación, el sistema debe procesar de forma confiable archivos de gran volumen y ejecutar cálculos intensivos, lo cual condiciona fuertemente los requisitos no funcionales de la Sección 3.2.

El sistema se apoya conceptualmente en cuatro macro-componentes: (1) el módulo de Propuestas y Vacantes, (2) el módulo de Carga de Postulaciones vía Excel, (3) el módulo de Cálculo de Ranking, y (4) el Motor de Asignación Automática, descritos en profundidad en la Sección 4.

### 2.2 Funciones del Producto (Resumen)

- Gestión de propuestas: alta, edición y publicación de proyectos de beca con su cupo de vacantes.
- Carga y validación de la Planilla de Postulaciones (Excel) con los datos de inscripción y preferencias de los estudiantes.
- Cálculo de ranking: ejecución de la fórmula de ponderación vigente sobre la población de postulantes cargada al cierre de la convocatoria.
- Motor de asignación automática: asignación estudiante-propuesta respetando ranking, preferencias y vacantes.
- Publicación y consulta de resultados por rol (estudiante, docente, administrador).
- Auditoría y trazabilidad de cada carga de planilla, corrida de ranking y asignación.

### 2.3 Características de los Usuarios

| Rol | Descripción | Nivel técnico esperado |
|---|---|---|
| **Estudiante** | Usuario de **solo consulta**: visualiza las propuestas publicadas de forma informativa y consulta el resultado de su asignación una vez finalizado el proceso. No realiza su postulación dentro de la plataforma. | Usuario final sin conocimientos técnicos; interfaz web simple e intuitiva. |
| **Docente / Responsable de propuesta** | Publica y administra sus propuestas, define e informa el cupo de vacantes, prepara y/o carga la planilla de postulaciones correspondiente a su propuesta (según el proceso institucional lo requiera) y consulta el ranking de postulantes a su(s) propuesta(s). | Usuario final sin conocimientos técnicos, con manejo básico de Excel. |
| **Administrador** | Configura parámetros globales (ventanas de convocatoria, ponderaciones de la fórmula de ranking), gestiona la carga consolidada de la Planilla de Postulaciones, ejecuta el cierre de convocatoria, dispara el cálculo de ranking y el motor de asignación, y supervisa reportes/auditoría. | Usuario con perfil funcional-administrativo; puede requerir capacitación específica sobre parametrización de la fórmula y sobre el formato de la planilla. |

### 2.4 Restricciones

- El backend debe implementarse en Node.js utilizando el framework NestJS.
- El frontend debe implementarse combinando **React y Vue** (ver propuesta de convivencia en la Sección 4.2).
- La inscripción/postulación de los estudiantes **no se gestiona como formulario dentro de la plataforma**; el único mecanismo de ingreso de postulaciones es la carga de una Planilla de Postulaciones en formato Excel (.xlsx), conforme a una plantilla estándar publicada por el sistema.
- El sistema debe operar en un entorno de infraestructura con recursos limitados (memoria y cómputo acotados), lo cual restringe el diseño de estructuras de datos y algoritmos usados en el procesamiento de la planilla, el cálculo de ranking y el motor de asignación.
- Un estudiante no puede tener más de 5 preferencias registradas en la planilla por convocatoria.
- La fórmula de cálculo de ranking es susceptible de cambios entre convocatorias y debe poder modificarse sin requerir un redespliegue estructural del módulo de asignación.
- La documentación funcional y técnica debe mantenerse bajo el enfoque Docs-as-Code (versionada junto al código, en formato de texto plano — Markdown — dentro del repositorio).

### 2.5 Suposiciones y Dependencias

- Se asume que existe una fuente confiable (interna, integrada, o incluida como columnas en la propia planilla) de datos académicos por estudiante: materias aprobadas, promedio, porcentaje de avance de la carrera y antigüedad, disponibles al momento del cierre de la convocatoria.
- Se asume que el proceso de inscripción de estudiantes a las propuestas ocurre por un canal administrativo externo a la plataforma, y que la Planilla de Postulaciones es el artefacto consolidado que refleja fielmente ese proceso.
- Se asume que cada convocatoria tiene fechas de apertura y cierre de carga de postulaciones definidas administrativamente antes de iniciar el proceso.
- Se asume una única corrida de asignación por convocatoria como flujo principal, contemplándose recálculos administrativos excepcionales como flujo alternativo (ver RN-08).

---

## 3. Requisitos Específicos

### 3.1 Requisitos Funcionales (RF)

Los requisitos funcionales se agrupan por módulo del ciclo de negocio: Gestión de Propuestas y Vacantes, Carga de Postulaciones vía Excel, Cálculo de Ranking, y Motor de Asignación Automática. Cada requisito incluye actor, prioridad (Alta/Media/Baja) y criterio de aceptación.

#### 3.1.1 Módulo: Gestión de Propuestas y Vacantes

| ID | Descripción | Actor | Prio. | Criterio de aceptación |
|---|---|---|---|---|
| RF-01 | El sistema debe permitir a un docente/responsable crear una propuesta de beca indicando: título, descripción, tipo (servicio/investigación) y cantidad total de vacantes. | Docente | Alta | La propuesta se crea con estado "Borrador" y no es visible para estudiantes hasta su publicación. |
| RF-02 | El sistema debe permitir publicar una propuesta, haciéndola visible de forma informativa dentro de la ventana vigente de la convocatoria. | Docente | Alta | Una propuesta publicada aparece en el listado de consulta para estudiantes. |
| RF-03 | El sistema debe permitir modificar el cupo de vacantes de una propuesta mientras la convocatoria no haya cerrado. | Docente | Media | Se rechaza la edición de vacantes una vez cerrada la convocatoria (ver RN-02). |
| RF-04 | El sistema debe registrar un historial de auditoría de cambios sobre el cupo de vacantes de cada propuesta. | Sistema | Media | Cada modificación de vacantes queda registrada con usuario, fecha/hora y valor anterior/nuevo. |

#### 3.1.2 Módulo: Carga de Postulaciones vía Excel

| ID | Descripción | Actor | Prio. | Criterio de aceptación |
|---|---|---|---|---|
| RF-05 | El sistema debe proveer una plantilla de Excel estándar, descargable, con las columnas requeridas para la carga de postulaciones (identificador de estudiante, propuestas seleccionadas y orden de preferencia de 1 a 5, y variables académicas si no provienen de otra fuente). | Docente / Administrador | Alta | La plantilla descargada contiene todas las columnas obligatorias documentadas y validaciones básicas de formato (p. ej. listas desplegables) cuando sea técnicamente viable. |
| RF-06 | El sistema debe permitir cargar (subir) una Planilla de Postulaciones en formato .xlsx dentro de la ventana vigente de la convocatoria. | Docente / Administrador | Alta | El archivo cargado queda asociado a la convocatoria correspondiente con fecha/hora y usuario de carga. |
| RF-07 | El sistema debe validar la estructura y el contenido de la planilla cargada (columnas obligatorias, tipos de dato, identificadores de estudiante y de propuesta existentes, preferencias entre 1 y 5 sin duplicados por estudiante, máximo 5 filas por estudiante), reportando los errores **fila por fila** sin interrumpir la validación del resto del archivo. | Sistema | Alta | El sistema devuelve un reporte de validación que identifica cada fila con error y el motivo, permitiendo corregir y volver a intentar la carga. |
| RF-08 | El sistema debe permitir reemplazar o actualizar una carga de postulaciones (nueva versión de la planilla) mientras la convocatoria esté abierta, invalidando la versión anterior. | Docente / Administrador | Media | Al cargar una nueva versión válida, el sistema identifica claramente cuál es la planilla vigente utilizada para el ranking. |
| RF-09 | El sistema debe procesar la carga de la planilla de forma asíncrona (como un job en segundo plano) para archivos de gran volumen, informando el progreso y el resultado final de la validación/importación. | Sistema | Alta | Para archivos de alto volumen, la carga no bloquea la interfaz ni genera timeouts; el usuario puede consultar el estado del procesamiento. |
| RF-10 | El sistema debe impedir cualquier nueva carga o reemplazo de la Planilla de Postulaciones una vez cerrada la convocatoria. | Sistema | Alta | Cualquier intento posterior al cierre retorna un error de negocio controlado (HTTP 409/422). |

#### 3.1.3 Módulo: Cálculo de Ranking

| ID | Descripción | Actor | Prio. | Criterio de aceptación |
|---|---|---|---|---|
| RF-11 | El sistema debe permitir al administrador cerrar formalmente la ventana de carga de postulaciones de una convocatoria. | Administrador | Alta | Tras el cierre, el estado de la convocatoria cambia a "Cerrada" y se habilita el cálculo de ranking. |
| RF-12 | El sistema debe calcular automáticamente el puntaje de cada estudiante postulante (según la última planilla vigente) aplicando la fórmula de ponderación vigente (materias aprobadas, promedio, avance de carrera, antigüedad, y otras variables configurables). | Sistema | Alta | Cada postulante obtiene un puntaje numérico trazable a las variables y ponderaciones utilizadas en esa corrida. |
| RF-13 | El sistema debe generar, a partir de los puntajes calculados, un ranking ordenado de forma descendente por puntaje, con criterio de desempate configurable ante puntajes iguales. | Sistema | Alta | El ranking resultante no contiene empates sin resolver; cada estudiante tiene una posición única. |
| RF-14 | El sistema debe permitir al administrador configurar y versionar las ponderaciones de las variables de la fórmula de ranking antes de iniciar una convocatoria. | Administrador | Alta | Cada convocatoria queda asociada a una versión específica de la estrategia/ponderación de ranking utilizada, garantizando reproducibilidad posterior. |
| RF-15 | El sistema debe permitir consultar el detalle de cálculo de puntaje de un estudiante (desglose por variable) con fines de transparencia y reclamos. | Docente / Administrador | Media | El desglose muestra, por variable, el valor original, el peso aplicado y el subtotal correspondiente. |

#### 3.1.4 Módulo: Motor de Asignación Automática

| ID | Descripción | Actor | Prio. | Criterio de aceptación |
|---|---|---|---|---|
| RF-16 | El sistema debe ejecutar el proceso de asignación automática una vez generado el ranking, procesando a los estudiantes en estricto orden descendente de puntaje. | Sistema | Alta | El log de ejecución evidencia el procesamiento estudiante por estudiante en el orden del ranking. |
| RF-17 | Para cada estudiante, el sistema debe intentar asignarlo a su propuesta de mayor preferencia (orden 1, según lo declarado en la planilla) que aún cuente con vacante disponible; si no hay vacante, debe evaluar la siguiente preferencia en orden, y así sucesivamente hasta agotar sus 5 preferencias. | Sistema | Alta | Ningún estudiante es asignado a una propuesta con vacante agotada, ni se salteian preferencias con vacante disponible en favor de una de menor prioridad. |
| RF-18 | El sistema debe decrementar el cupo de vacantes disponible de una propuesta inmediatamente después de asignar un estudiante a ella, de forma atómica, antes de procesar al siguiente estudiante del ranking. | Sistema | Alta | No se producen sobre-asignaciones (asignados > vacantes) bajo ninguna condición de concurrencia. |
| RF-19 | El sistema debe registrar como "No asignado" a todo estudiante cuyas 5 preferencias hayan agotado su vacante disponible al momento de ser procesado. | Sistema | Alta | Todo estudiante postulante finaliza el proceso en estado "Asignado" (con propuesta) o "No asignado", sin estados intermedios. |
| RF-20 | El sistema debe generar un reporte final de asignación por convocatoria, exportable (incluyendo formato Excel), con el detalle estudiante–propuesta asignada–preferencia satisfecha. | Administrador | Media | El reporte permite reconstruir, para cada estudiante asignado, qué número de preferencia efectivamente obtuvo. |
| RF-21 | El sistema debe emitir un evento interno al finalizar el proceso de asignación, disponible para una futura integración de notificaciones a estudiantes y docentes. | Sistema | Baja | Se emite un evento de dominio "AsignacionFinalizada" consumible por un módulo de notificaciones. |
| RF-22 | El sistema debe permitir al administrador re-ejecutar el motor de asignación de forma controlada ante una corrección de datos, invalidando la corrida anterior y dejando registro de ambas. | Administrador | Media | Las corridas de asignación quedan versionadas; la corrida vigente es identificable sin ambigüedad. |

### 3.2 Requisitos No Funcionales (RNF)

Dado que el sistema operará sobre una infraestructura con recursos limitados, procesará archivos Excel de tamaño variable y debe soportar la ejecución de cálculos intensivos al cierre de convocatoria, los requisitos no funcionales priorizan la eficiencia de memoria, el control de la concurrencia asíncrona y la disponibilidad del servicio.

| ID | Categoría | Descripción | Métrica / criterio |
|---|---|---|---|
| RNF-01 | Rendimiento | El cálculo de ranking y el motor de asignación deben procesar la población de postulantes utilizando estructuras de datos y algoritmos de complejidad acotada (evitar operaciones cuadráticas O(n²) sobre listas de postulantes y vacantes). | Para convocatorias de hasta 10.000 postulantes, el cálculo de ranking completo debe finalizar en menos de 30 segundos en el entorno de referencia. |
| RNF-02 | Eficiencia de memoria | El procesamiento de la Planilla de Postulaciones, el ranking y la asignación deben realizarse mediante lectura y procesamiento por lotes (streaming/paginado), evitando cargar la totalidad del archivo Excel o de los postulantes en memoria simultáneamente. | El consumo pico de memoria del proceso de importación/ranking/asignación no debe superar el límite configurado del contenedor (p. ej. 512 MB) para el volumen máximo esperado. |
| RNF-03 | Concurrencia asíncrona | Las operaciones de escritura concurrente sobre el cupo de vacantes de una propuesta (decremento) deben ser atómicas y libres de condiciones de carrera, incluso bajo múltiples solicitudes simultáneas durante el motor de asignación. | Pruebas de concurrencia con N solicitudes simultáneas sobre una propuesta con V vacantes no deben resultar en más de V asignaciones efectivas. |
| RNF-04 | Concurrencia asíncrona | El backend NestJS debe manejar de forma no bloqueante las operaciones de I/O (acceso a base de datos, lectura del archivo Excel, consultas de datos académicos) utilizando el modelo asíncrono de Node.js (async/await, colas de tareas) para evitar el bloqueo del event loop durante la importación masiva o corridas de ranking/asignación. | El event loop no debe presentar bloqueos (lag) superiores a 100 ms durante la ejecución de una carga o corrida de asignación en el volumen máximo esperado. |
| RNF-05 | Escalabilidad de procesamiento | La importación de la Planilla de Postulaciones debe soportar archivos de gran volumen sin degradar el servicio para el resto de los usuarios concurrentes. | Importación de una planilla de hasta 10.000 filas procesada como job en background, sin impacto perceptible (>200 ms) en el tiempo de respuesta de otras operaciones del sistema. |
| RNF-06 | Disponibilidad | El sistema debe garantizar alta disponibilidad durante las ventanas críticas de negocio: carga de postulaciones, cierre de convocatoria y ejecución del motor de asignación. | Disponibilidad objetivo del 99,5% durante ventanas críticas declaradas administrativamente. |
| RNF-07 | Mantenibilidad / Extensibilidad | La lógica de cálculo de ranking debe estar desacoplada del resto del sistema mediante el patrón Strategy, de forma que la incorporación de una nueva fórmula de ponderación no requiera modificar el motor de asignación ni los controladores existentes. | Agregar una nueva estrategia de ranking debe implicar únicamente la creación de una nueva clase/proveedor NestJS, sin modificar código existente (principio abierto/cerrado). |
| RNF-08 | Trazabilidad / Auditoría | Toda carga de planilla, corrida de cálculo de ranking y de asignación debe quedar registrada de forma inmutable (fecha, versión de estrategia, archivo origen, resultado) para fines de auditoría académica. | El 100% de las cargas y corridas ejecutadas en producción son recuperables con su configuración y archivo exacto utilizado. |
| RNF-09 | Seguridad | El sistema debe implementar control de acceso basado en roles (Estudiante, Docente, Administrador), restringiendo operaciones sensibles (carga de planilla, configuración de ponderaciones, cierre de convocatoria, ejecución de asignación) exclusivamente a los roles Docente/Administrador según corresponda. | Pruebas de autorización verifican el rechazo (HTTP 403) de operaciones sensibles para roles no autorizados. |
| RNF-10 | Consistencia de frontend | Al coexistir React y Vue como frameworks de frontend, ambos clientes deben consumir el mismo contrato de API (backend NestJS) y compartir lineamientos visuales comunes, evitando duplicación de reglas de negocio en el cliente. | Ninguna regla de validación de negocio (p. ej. formato de preferencias) se implementa exclusivamente en el frontend sin su contraparte de validación en el backend. |
| RNF-11 | Documentación | La documentación funcional y técnica del sistema debe mantenerse bajo el enfoque Docs-as-Code, versionada en el mismo repositorio o en un repositorio asociado, en formato Markdown compatible con control de versiones. | Todo cambio funcional relevante incluye una actualización de la documentación en el mismo Pull Request o en uno vinculado, validado en el pipeline de CI. |

### 3.3 Reglas de Negocio (RN)

| ID | Regla de negocio | Justificación |
|---|---|---|
| RN-01 | Cada estudiante puede tener registradas un máximo de 5 preferencias (filas) en la Planilla de Postulaciones por convocatoria, con un orden de preferencia único y sin duplicados (1 a 5). | Definición explícita del proceso de negocio; garantiza que el motor de asignación tenga un conjunto acotado y no ambiguo de opciones por estudiante. |
| RN-02 | Una vez cerrada la convocatoria, no se admiten nuevas cargas ni reemplazos de la Planilla de Postulaciones, ni modificaciones de cupos de vacantes. | Preserva la integridad de los datos de entrada utilizados para el cálculo de ranking y asignación. |
| RN-03 | El ranking se calcula exclusivamente sobre los estudiantes presentes en la última versión válida de la Planilla de Postulaciones vigente al momento del cierre de la convocatoria. | Evita procesar población fuera del alcance del proceso de asignación vigente, y define de forma inequívoca cuál es la fuente de verdad. |
| RN-04 | La fórmula de ranking se compone de variables ponderadas (materias aprobadas, promedio, avance de carrera, antigüedad, entre otras configurables) cuya sumatoria de pesos debe ser igual al 100%. | Garantiza consistencia matemática y comparabilidad de puntajes entre estudiantes. |
| RN-05 | El motor de asignación procesa a los estudiantes en orden estrictamente descendente de puntaje de ranking; ante empate, se aplica el criterio de desempate configurado (p. ej. antigüedad o sorteo controlado). | Asegura que el proceso de asignación sea determinístico, justo y auditable. |
| RN-06 | Para cada estudiante, se evalúan sus preferencias en el orden declarado en la planilla (1 a 5); se asigna a la primera propuesta de la lista que aún tenga vacante disponible en el momento de su procesamiento. | Regla núcleo del algoritmo de asignación, definida explícitamente en los requisitos de negocio. |
| RN-07 | Una vacante asignada se descuenta de forma inmediata e irreversible del cupo de la propuesta correspondiente dentro de la misma corrida de asignación. | Evita sobre-asignación de vacantes y garantiza consistencia entre estudiantes procesados sucesivamente. |
| RN-08 | Una re-ejecución del motor de asignación solo puede ser iniciada por el rol Administrador y debe invalidar explícitamente la corrida anterior, dejando ambas versiones registradas. | Permite corregir errores de datos manteniendo trazabilidad y evitando resultados duplicados o contradictorios. |
| RN-09 | Un estudiante sin vacante disponible en ninguna de sus preferencias declaradas al momento de su procesamiento queda formalmente en estado "No asignado" para esa convocatoria. | Cierra el ciclo de vida de la postulación de forma explícita, habilitando reportes y posibles procesos posteriores (listas de espera, reclamos). |
| RN-10 | La versión de la estrategia de cálculo de ranking utilizada en una convocatoria queda fijada (congelada) desde el cierre de la carga de postulaciones hasta la finalización de la asignación, aun si la configuración global cambia en paralelo. | Garantiza reproducibilidad y evita que cambios administrativos concurrentes alteren una corrida en curso. |
| RN-11 | Una fila de la Planilla de Postulaciones que no supere las validaciones de formato o de negocio (RF-07) no genera una postulación válida y no participa del cálculo de ranking ni de la asignación. | Evita que datos malformados o inconsistentes contaminen el proceso de mérito y asignación. |

---

## 4. Propuesta de Arquitectura de Software

### 4.1 Visión General de la Arquitectura

Se propone una arquitectura modular basada en el ecosistema de NestJS para el backend, organizada por dominios de negocio (Módulos: Propuestas, Importación de Postulaciones, Ranking, Asignación, Auditoría), siguiendo los principios de Inyección de Dependencias y separación de responsabilidades (Controllers → Services → Providers/Strategies → Repositorios). Esta organización favorece la mantenibilidad exigida en RNF-07 y la extensibilidad del cálculo de ranking sin acoplarlo al resto del sistema.

A alto nivel, el flujo de ejecución del cierre de convocatoria es el siguiente: el Administrador dispara el cierre (RF-11) → el módulo de Ranking obtiene los postulantes vigentes a partir de la última Planilla de Postulaciones válida y aplica la estrategia de cálculo vigente (RF-12, RF-14) → se genera el ranking ordenado (RF-13) → el Motor de Asignación consume dicho ranking, iterando estudiante por estudiante según RN-05 y RN-06, actualizando vacantes de forma atómica (RF-18, RNF-03) → se persisten resultados y se emiten eventos de dominio para auditoría y notificaciones (RF-20, RF-21).

### 4.2 Convivencia de React y Vue en el Frontend

El requerimiento de utilizar **React y Vue** simultáneamente exige una estrategia explícita para evitar duplicación de lógica y fragmentación de la experiencia de usuario. Se propone:

- **Separación por dominio de uso, no por capricho tecnológico.** Dado que el Estudiante es un usuario de solo consulta con necesidades de UI simples, se propone un **Portal de Consulta en Vue** (liviano, de rápida carga, orientado a listados y estados de resultado). El **Panel de Gestión** (Docente/Administrador), con pantallas más complejas de carga de planillas, configuración de ranking y reportes, se propone en **React**, aprovechando su ecosistema más amplio de componentes de administración (tablas, formularios avanzados, carga de archivos).
- **Backend For Frontend (BFF) común.** Ambos clientes consumen exclusivamente la API REST expuesta por NestJS; ninguna regla de negocio (validaciones, cálculo de ranking, reglas de asignación) se duplica en el cliente, cumpliendo RNF-10.
- **Sistema de diseño compartido.** Se recomienda un design token / librería de estilos compartida (por ejemplo, CSS o tokens de diseño exportados a ambos ecosistemas) para mantener consistencia visual entre el Portal (Vue) y el Panel (React), evitando que la diferencia de framework se perciba como dos productos distintos.
- **Alternativa de integración progresiva.** Si en el futuro se requiere combinar ambos frameworks dentro de una misma pantalla, se recomienda evaluar un enfoque de micro-frontends (por ejemplo, Module Federation o Web Components) en lugar de mezclar React y Vue en un mismo árbol de renderizado, para mantener el aislamiento y la mantenibilidad de cada aplicación.

### 4.3 Patrón Strategy para el Cálculo de Ranking

El requisito de negocio establece que la fórmula de evaluación (materias aprobadas, promedio, avance, antigüedad, y otras variables futuras) es dinámica y puede cambiar entre convocatorias. Encapsular esta lógica bajo el patrón Strategy resuelve directamente este requisito de la siguiente manera:

- Se define una interfaz común, por ejemplo `RankingStrategy`, con un método `calcularPuntaje(datosPostulante: DatosAcademicos): number`, que todas las estrategias concretas deben implementar.
- Cada fórmula de ponderación (p. ej. `EstrategiaRankingV1`, `EstrategiaRankingBecaInvestigacion`, `EstrategiaRankingBecaServicio`) se implementa como un Provider independiente de NestJS, inyectable mediante el contenedor de Inversión de Control (IoC).
- Un `RankingContextService` recibe la estrategia activa por inyección de dependencias —resuelta dinámicamente según la configuración vigente de la convocatoria (RF-14, RN-10)— y delega en ella el cálculo de puntaje, sin conocer los detalles internos de la fórmula.
- La selección de la estrategia concreta en tiempo de ejecución puede resolverse con un Factory Provider de NestJS (`useFactory`), que instancia la estrategia adecuada en base a la configuración persistida de la convocatoria, manteniendo el principio abierto/cerrado: agregar una nueva fórmula implica crear una nueva clase y registrarla, sin modificar el motor de asignación ni los controladores (RNF-07).
- Cada estrategia puede, a su vez, componerse internamente de objetos de ponderación por variable (materias aprobadas, promedio, avance, antigüedad), facilitando pruebas unitarias aisladas por fórmula y por variable.

Este diseño desacopla completamente el "qué se calcula" (reglas de negocio cambiantes) del "cómo se usa el resultado" (motor de asignación), cumpliendo el requisito explícito de aislamiento solicitado y reduciendo el riesgo de regresiones ante cambios futuros en la política de becas.

### 4.4 Patrón Observer para el Motor de Asignación

El motor de asignación automática constituye un proceso de negocio con múltiples efectos colaterales desacoplados entre sí: actualizar el cupo de vacantes, registrar auditoría, notificar a estudiantes y docentes, y eventualmente disparar reportes. Se propone modelar estos efectos mediante el patrón Observer, implementado de forma idiomática en NestJS a través de su módulo de eventos (`@nestjs/event-emitter`) o mediante colas de mensajería (p. ej. Bull/BullMQ) para los efectos no críticos en el camino sincrónico.

- El `AsignacionEngineService` (sujeto/observable) emite eventos de dominio discretos durante la corrida: `EstudianteAsignado`, `EstudianteNoAsignado` y `AsignacionFinalizada`.
- Distintos listeners (observadores) se suscriben a estos eventos de forma independiente: un `AuditoriaListener` que persiste el detalle de cada asignación (RF-04, RNF-08), y un `NotificacionListener` que encola la notificación correspondiente (RF-21), sin que el motor de asignación conozca su existencia.
- Esta separación permite agregar nuevos efectos (por ejemplo, integración futura con un sistema de listas de espera) sin modificar el algoritmo central de asignación, y evita que operaciones no críticas (notificaciones) bloqueen o enlentezcan la ruta crítica de cálculo (alineado con RNF-01 y RNF-04).

### 4.5 Patrón Facade para la Orquestación del Proceso

Dado que el cierre de convocatoria involucra la coordinación secuencial de varios módulos (validación de cierre, cálculo de ranking mediante Strategy, ejecución del motor de asignación, emisión de eventos Observer y generación de reportes), se propone un `ConvocatoriaFacadeService` que exponga una única operación de alto nivel (por ejemplo, `cerrarYAsignar(convocatoriaId)`) hacia el controlador REST correspondiente.

- El Facade oculta la complejidad de orquestación interna entre `RankingService`, `AsignacionEngineService` y `ReporteService`, ofreciendo un punto de entrada simple y estable para el controlador y, por extensión, para ambos frontends.
- Este patrón reduce el acoplamiento del controlador con los detalles internos del dominio, facilita la testabilidad end-to-end del proceso de cierre y centraliza el manejo transaccional/de errores del flujo completo (por ejemplo, revertir el cierre si el cálculo de ranking falla antes de iniciar la asignación).

### 4.6 Procesamiento de la Planilla de Excel

Para cumplir RF-06 a RF-10 dentro de las restricciones de memoria (RNF-02) y concurrencia (RNF-04), se recomienda:

- Utilizar una librería de streaming para lectura de archivos `.xlsx` (por ejemplo, procesamiento por filas/lotes en lugar de cargar el libro completo en memoria).
- Ejecutar la validación e importación como un **job asíncrono** desacoplado del ciclo request/response HTTP (cola de tareas), devolviendo al usuario un identificador de proceso que permita consultar el progreso y el resultado, evitando timeouts HTTP ante archivos grandes.
- Aplicar todas las validaciones de negocio (RN-01, RN-11) durante la importación, generando un reporte de errores por fila que permita al Docente/Administrador corregir y volver a cargar sin perder el resto de la información ya válida.

### 4.7 Consideraciones de Concurrencia y Eficiencia de Memoria

En línea con RNF-01, RNF-02, RNF-03 y RNF-04, se recomienda:

- Procesar el cálculo de ranking y el motor de asignación mediante cursores/paginado (streaming) sobre la base de datos, evitando cargar en memoria la totalidad de postulantes y sus datos académicos de forma simultánea.
- Utilizar transacciones de base de datos con bloqueo optimista o control de concurrencia a nivel de fila (por ejemplo, `SELECT ... FOR UPDATE` o control de versión/optimistic locking) sobre el registro de vacantes de cada propuesta, para garantizar que el decremento de cupo (RF-18) sea atómico incluso bajo escritura concurrente.
- Ejecutar el proceso de asignación como un job asíncrono desacoplado del ciclo request/response HTTP, devolviendo al administrador un identificador de corrida que permita consultar el progreso, evitando timeouts HTTP en convocatorias con alto volumen de postulantes.
- Aprovechar el modelo de I/O no bloqueante de Node.js para las consultas de datos académicos externos, utilizando operaciones asíncronas en lote (batching) en lugar de una consulta por estudiante, reduciendo la presión sobre el event loop.

### 4.8 Enfoque Docs-as-Code

La documentación funcional (este ERS) y la documentación técnica derivada (diagramas de arquitectura, contratos de API, decisiones de arquitectura) deben mantenerse como archivos de texto plano (Markdown) versionados en el mismo repositorio del código fuente o en un repositorio documental asociado. Se recomienda:

- Versionar este ERS en formato Markdown dentro de una carpeta `/docs`, sincronizada con el ciclo de vida de releases del backend NestJS y de los frontends React/Vue.
- Registrar decisiones de arquitectura relevantes (por ejemplo, la elección de Strategy para el ranking, o la separación React/Vue) como Architecture Decision Records (ADR) versionados junto al código.
- Incorporar la validación de documentación (enlaces, estructura, formato) como un paso del pipeline de integración continua (CI), de forma que cambios funcionales sin su correspondiente actualización documental sean detectados antes del merge.

---

## 5. Anexos

### Anexo A — Flujo de Proceso de Alto Nivel

1. Docente publica propuesta con cupo de vacantes (RF-01, RF-02).
2. Fuera de la plataforma, el estudiante realiza su inscripción/postulación por el canal administrativo institucional definido, indicando hasta 5 propuestas y su orden de preferencia.
3. Docente/Administrador consolida esa información en la Planilla de Postulaciones (plantilla estándar) y la carga en la plataforma (RF-05, RF-06).
4. Sistema valida la planilla fila por fila y reporta errores, permitiendo corrección y recarga (RF-07, RF-08, RN-11).
5. Administrador cierra la ventana de la convocatoria (RF-11); se bloquean nuevas cargas y cambios de vacantes (RN-02).
6. Sistema calcula el puntaje de cada postulante mediante la estrategia de ranking vigente (RF-12, Sección 4.3).
7. Sistema genera el ranking ordenado descendente, resolviendo empates según criterio configurado (RF-13, RN-05).
8. Motor de asignación procesa estudiante por estudiante en orden de ranking; para cada uno, recorre sus preferencias declaradas en la planilla y asigna la primera con vacante disponible (RF-17, RN-06).
9. Se decrementa el cupo de la propuesta asignada de forma atómica (RF-18, RN-07).
10. Estudiantes sin vacante disponible en ninguna preferencia quedan como "No asignado" (RF-19, RN-09).
11. Se emiten eventos de dominio (Observer) para auditoría y notificación, y se genera el reporte final (RF-20, RF-21, Sección 4.4).

### Anexo B — Estructura Sugerida de la Planilla de Postulaciones

| Columna | Descripción | Obligatoria |
|---|---|---|
| ID Estudiante / Legajo | Identificador único del estudiante en el sistema académico. | Sí |
| Nombre y Apellido | Dato descriptivo de referencia (no utilizado en el cálculo). | No |
| ID Propuesta | Identificador de la propuesta a la que se postula en esa fila. | Sí |
| Orden de Preferencia | Valor entero de 1 a 5, único por estudiante dentro de la planilla. | Sí |
| Materias Aprobadas | Cantidad de materias aprobadas (si no se obtiene de fuente externa). | Condicional |
| Promedio | Promedio académico (si no se obtiene de fuente externa). | Condicional |
| Avance de Carrera (%) | Porcentaje de avance en el plan de estudios. | Condicional |
| Antigüedad | Antigüedad en la carrera (años/cuatrimestres, según defina la institución). | Condicional |

> Cada fila de la planilla representa **una preferencia** de un estudiante hacia una propuesta puntual; un mismo estudiante estará representado en hasta 5 filas (una por cada propuesta a la que se postuló), conforme a RN-01.

### Anexo C — Matriz de Trazabilidad (extracto)

| Regla de Negocio | Requisitos Funcionales asociados | Componente de arquitectura |
|---|---|---|
| RN-01 / RN-11 | RF-05, RF-07, RF-10 | Módulo de Importación de Postulaciones — validación de planilla (máx. 5 preferencias por estudiante, filas inválidas excluidas). |
| RN-04 / RN-10 | RF-12, RF-14 | `RankingStrategy` (Strategy Pattern) + configuración versionada de convocatoria. |
| RN-05 / RN-06 / RN-07 | RF-16, RF-17, RF-18 | `AsignacionEngineService` + control de concurrencia sobre vacantes. |
| RN-08 | RF-22 | `ConvocatoriaFacadeService` — orquestación de re-ejecución controlada. |
| RN-09 | RF-19, RF-20 | `AsignacionEngineService` + `ReporteService`. |

### Anexo D — Consideraciones para Futuras Versiones

- Gestión de listas de espera para estudiantes no asignados en primera corrida.
- Módulo de reclamos y revisión administrativa posterior a la publicación de resultados.
- Integración con sistema de pagos/estipendios de becas.
- Panel de simulación de ranking ("qué pasaría si") para el administrador, antes del cierre definitivo de convocatoria.
- Evaluación de una futura autopostulación del estudiante directamente en la plataforma, en caso de que el proceso institucional evolucione hacia ese modelo.
