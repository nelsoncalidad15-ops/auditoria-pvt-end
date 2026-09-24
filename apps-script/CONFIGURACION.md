# Configuracion de auditorias por area

Cada area tiene su propia pestaña de configuracion en Google Sheets: `Auditoria - Asesores de servicio`, `Auditoria - Tecnicos`, `Auditoria - Lavadero`, etc. La app lee todas esas pestañas al abrirse y tambien desde **Estructura > Actualizar desde Sheet**.

Los resultados no se mezclan con esta configuracion: se guardan en `Auditorias` (una fila por auditoria cerrada) y `AuditoriaItems` (una fila por respuesta).

## Primera carga

1. Reemplaza el proyecto de Apps Script con el contenido actualizado de `Code.gs` y vuelve a implementarlo como aplicacion web.
2. Desde la app, usa **Estructura > Guardar en Sheet**.
3. Se creara una pestaña `Auditoria - ...` por cada area y se cargaran sus preguntas, pesos y reglas.

No hace falta crear las pestañas a mano para la primera carga.

## Como modificar preguntas despues

Abri la pestaña del area que quieras editar. Cada fila desde la segunda fila representa una pregunta.

- Para agregar una pregunta, copia una fila del mismo bloque, pegala al final y cambia **ID de pregunta**, **Orden**, **Pregunta**, **Peso** y sus reglas.
- Para quitarla temporalmente, cambia **Activa** a `no`; asi se conserva el historial pero deja de aparecer en nuevas auditorias.
- Para cambiar el orden, modifica **Orden**.
- Al terminar, en la app usa **Actualizar desde Sheet**. No hace falta volver a publicar la pagina.

Los campos **ID de area**, **Area**, **Descripcion del area** y **Colaboradores auditados** se completan al crear la pestaña. Conviene mantenerlos iguales en todas las filas de esa misma area.

## Columnas de cada pestaña

| Encabezado | Uso |
| --- | --- |
| **Alcance** | `global` se comparte entre Jujuy y Salta. Usa `Jujuy` o `Salta` solo cuando una pregunta sea exclusiva de una sede. |
| **ID de area**, **Area**, **Descripcion del area** | Identidad y descripcion del area. |
| **Colaboradores auditados** | Personas auditables, separadas por coma. Se puede dejar vacio. |
| **ID de pregunta**, **Orden**, **Bloque** | Identidad unica, orden y bloque de la pregunta. |
| **Pregunta**, **Descripcion**, **Guia para el auditor** | Texto que ve el auditor y ayuda opcional. **Pregunta** es obligatoria. |
| **Peso** | Peso positivo. Una pregunta con peso 3 impacta tres veces mas que una de peso 1. |
| **Obligatoria** | `si` o `no`. Con `si` no se puede cerrar la auditoria sin responder. |
| **Tipo de respuesta** | `si_no_na` para **Si / No / N/A**, o `si_no` para impedir N/A. |
| **Modo de puntaje** | `manual` muestra **Sí / No / N/A**. `calculado` muestra el valor, la cobertura y las fuentes; el auditor no lo responde. |
| **Permite N/A** | Compatibilidad con versiones anteriores: `si` o `no`. Si tambien esta **Tipo de respuesta**, manda ese campo. |
| **Activa** | `si` o `no`. Con `no`, la pregunta no aparece en auditorias nuevas. |
| **Exige comentario si responde No** | `si` exige observacion si se responde No. |
| **Prioridad** | `high`, `medium` o `low`. |
| **Sector** | `recepcion`, `taller`, `control_calidad`, `lavado`, `repuestos` o `resumen`. |
| **Roles responsables** | `asesor`, `tecnico`, `controller`, `lavador` o `repuestos`, separados por coma. |
| **Vinculos de puntaje** | Opcional, para vinculos de puntaje avanzados. |
## Puntaje

- **Si**: suma el peso de la pregunta.
- **No**: suma cero.
- **N/A**: queda fuera del denominador.

`Puntaje = pesos respondidos Si / pesos aplicables x 100`

La app no deja cerrar una auditoria si las preguntas obligatorias siguen sin responder, ni si todas las respuestas son N/A.

## Seguridad

Solo quienes tengan permiso de edicion en este Google Sheet pueden modificar las preguntas. No cargues claves ni datos sensibles en las pestañas de configuracion.
## Indicadores calculados

Usá **Modo de puntaje = `calculado`** en la pregunta de destino. Esa pregunta no se responde con Sí/No: la app muestra su porcentaje, cobertura y colaboradores pendientes.

La pestaña `Reglas de cálculo` se crea al actualizar la estructura. Cada fila es una fuente de cálculo, con estos encabezados:

| Encabezado | Uso |
| --- | --- |
| **Activa**, **Alcance**, **ID de regla** | `si`/`no`, alcance (`global` para ambas sedes) e identificador único. |
| **Área destino**, **ID pregunta destino** | Área y pregunta que recibirán el valor calculado. |
| **Tipo de origen** | `question` toma una pregunta de otra área; `rol_or` toma el resultado completo de un rol de OR; `pregunta_or` toma un ítem puntual de OR; `total_or` toma el promedio general de todas las OR. |
| **Área origen**, **ID pregunta origen** | Obligatorios con `question`. Para `pregunta_or`, cargá el ID de la pregunta de OR y usá Área origen para la nómina esperada cuando corresponda. |
| **Rol OR origen** | Obligatorio con `rol_or`; opcional con `pregunta_or` para atribuir ese ítem al colaborador de OR: `asesor`, `tecnico`, `lavador`, `controller` o `repuestos`. |
| **Método** | `promedio_por_colaborador` (recomendado) o `promedio_por_auditoria`. |
| **Peso de fuente** | Permite combinar más de una fuente para la misma pregunta de destino. |
| **Cobertura mínima** | Porcentaje requerido para declarar el indicador como completo; si falta gente se muestra como provisorio o pendiente. |
| **Detalle** | Texto breve para explicar la regla al auditor. |

Ejemplo para el indicador del jefe de taller sobre protectores: la pregunta destino `jefe-de-taller-1` se marca como `calculado`; la regla toma `Técnicos` + `tecnicos-5`, con cobertura mínima `100`. La app promedia el resultado mensual de cada técnico y muestra, por ejemplo, `5 de 6 técnicos · 83,3%`.

Para vincular una OR, usá `Tipo de origen = rol_or`; por ejemplo, una pregunta calculada de asesores puede tomar `Área origen = Asesores de servicio` y `Rol OR origen = asesor`. Las preguntas de OR asignadas a ese rol se promedian por persona dentro del mismo ciclo y sede.

## Resultados por proceso

La pestaña `Resultados por proceso` define los totales que ves como **Resultado para SERVICIOS**, **TALLER**, **REPUESTOS**, etc. No se editan fórmulas: se editan filas configurables.

| Encabezado | Uso |
| --- | --- |
| **Activa**, **Alcance**, **ID de proceso**, **Proceso** | Identidad del resultado. Usá `global` si aplica en Jujuy y Salta. |
| **Áreas incluidas** | Áreas separadas por coma, por ejemplo `Jefe de Taller, Técnicos`. |
| **Pesos** | Pesos en el mismo orden, separados por coma: `1, 1`. Si queda vacío, todas las áreas pesan 1. |
| **Cobertura mínima** | Recomendado `100`: mientras falte un área, el resultado se ve **Provisorio**. |
| **Orden** | Orden visual de la tarjeta. |

El resultado de un área es el promedio de la última auditoría válida de cada colaborador dentro del mismo ciclo y sede. El resultado de proceso es el promedio ponderado de sus áreas. Ejemplos iniciales: `SERVICIOS = Asesores de servicio, Subgerente de servicio`; `TALLER = Jefe de Taller, Técnicos`; `REPUESTOS = Repuestos, Jefe de Repuestos`.