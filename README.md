# meteocerdanyola.com · plugin para TRMNL

Plugin privado para [TRMNL](https://usetrmnl.com) (pantalla e-ink) que muestra el tiempo en directo de las estaciones de [meteocerdanyola.com](https://meteocerdanyola.com), en Cerdanyola del Vallès (Barcelona).

Proyecto personal y no oficial: los datos son de meteocerdanyola.com.

## Qué muestra

- **Temperatura ahora** con un **icono del tiempo** (despejado, poco nublado, nublado, niebla, llovizna, lluvia, lluvia fuerte o nieve; sol o luna según la hora), sensación térmica y **gráfico de las últimas 24 h**, con máxima y mínima y la hora a la que se dieron.
- **Viento** (actual, dirección y grados, y racha máxima de las 24 h).
- **Presión** y su tendencia en las últimas 3 horas.
- **Lluvia** acumulada en las últimas 24 h e intensidad actual (mm/h).
- **Humedad** y punto de rocío.
- Hora de la última lectura. Si la estación lleva más de 45 minutos sin enviar datos, se marca como retrasada.

Incluye las cuatro vistas de TRMNL: pantalla completa, media pantalla horizontal, media pantalla vertical y cuarto de pantalla.

## Ajustes del plugin

| Campo | Valores | Por defecto |
|---|---|---|
| **Estación meteorológica** (`station`) | `cerdanyola_ateneu`, `cerdanyola_centre`, `cerdanyola_montflorit` | `cerdanyola_ateneu` |
| **Idioma** (`language`) | Català (`ca`), Castellano (`es`), English (`en`) | `es` |

El idioma cambia todos los textos, el separador decimal (coma en catalán y castellano, punto en inglés) y las letras de la rosa de los vientos (O/W).

## Cómo funciona

1. TRMNL consulta cada 15 minutos la API de datos abiertos de la estación elegida:
   `https://meteocerdanyola.com/2026/api/open-data.php?v=1&slug=<estación>&dataset=recent&hours=24&variables=temperature,humidity,wind,pressure,rain,solar,uv&format=json`
2. [`src/transform.js`](src/transform.js) reduce la respuesta (unas 1.100-1.400 lecturas, 400-550 KB) a unos 9 KB: valores actuales, máximas y mínimas, tendencia de presión, punto de rocío y series agrupadas cada 15 minutos. La lluvia por hora se calcula a partir del acumulado diario, que se reinicia a medianoche.
3. Las plantillas Liquid dan formato a los números, traducen los textos, eligen el icono y dibujan el gráfico con Highcharts.

### Icono del tiempo

La estación no mide la nubosidad, así que el icono se deduce de los datos:

- **Lluvia, llovizna o nieve**: si ha llovido en los últimos 20 minutos. Es nieve si la temperatura es de 1 °C o menos, llovizna por debajo de 1 mm/h y lluvia fuerte a partir de 7,6 mm/h.
- **Niebla**: humedad del 97 % o más, punto de rocío a menos de 0,7 °C de la temperatura y casi sin viento.
- **Despejado, poco nublado o nublado**: de día, si la estación tiene sensor solar (de momento solo *Centre*), se compara la radiación medida con la teórica de cielo despejado a esa hora. Si no hay sensor (*Ateneu* y *Montflorit* marcan siempre 0) o es de noche, se estima por la humedad: por debajo del 78 % despejado, del 78 al 90 % poco nublado y desde el 90 % nublado. Es solo una estimación.
- **Sol o luna**: según la elevación del sol, calculada con las coordenadas de la estación.

Los datos que la estación no envía se muestran como `—`; nunca se interpretan como cero.

## Estructura del repositorio

```
src/
├── settings.yml            # URL de consulta y campos del plugin (estación, idioma)
├── transform.js            # reduce y calcula los datos
├── shared.liquid           # traducciones, iconos y función del gráfico
├── full.liquid             # pantalla completa
├── half_horizontal.liquid  # media pantalla horizontal
├── half_vertical.liquid    # media pantalla vertical
└── quadrant.liquid         # cuarto de pantalla
```

## Instalación

Crea un plugin privado en TRMNL (*Plugins → Private Plugin*) y copia el contenido de `src/`:

1. **Estrategia**: Polling (GET). En *Polling URL* pega la `polling_url` de `src/settings.yml`.
2. **Form fields**: pega el bloque `custom_fields` de `src/settings.yml`.
3. **Transform**: pega `src/transform.js`.
4. **Markup**: pega cada `.liquid` en su pestaña (*Shared*, *Full*, *Half horizontal*, *Half vertical*, *Quadrant*).
5. **Framework CSS version**: el diseño está comprobado en el dispositivo con la `3.4.0` (la actual) y con la `2.3.7`. Sirve cualquiera de las dos.
6. Guarda y elige estación e idioma en los ajustes del plugin.

## Datos y condiciones de uso

Los datos proceden de la API de datos abiertos de [meteocerdanyola.com](https://meteocerdanyola.com) (JDServer). Según el propio contrato de la API, la descarga no concede por sí sola una licencia abierta adicional y la reutilización puede requerir autorización: consulta el aviso legal de cada estación antes de redistribuir los datos. La información es orientativa y no sustituye los avisos oficiales.
