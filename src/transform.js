// Los números salen con punto decimal y la tendencia como código (rising_fast, rising,
// steady, falling, falling_fast, unknown): las plantillas dan formato y traducen.
// Reduce la respuesta de la API open-data de meteocerdanyola.com (~1.100-1.400
// lecturas de las últimas 24 h, 400-550 KB) a lo que pintan las plantillas.
function transform(input) {
  var BUCKET_MIN = 15;
  var CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  var station = (input && input.station) || {};
  var rows = ((input && input.rows) || []).filter(function (r) { return r && r.observed_at; });

  // "2026-10-03T19:28:00+02:00" -> ms como si la hora local fuera UTC (los ejes de
  // Highcharts van en UTC, así que muestran la hora local de la estación).
  function localMs(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }
  function hhmm(ms) { return new Date(ms).toISOString().slice(11, 16); }
  function dm(ms) { var d = new Date(ms).toISOString(); return d.slice(8, 10) + '/' + d.slice(5, 7); }
  function round(n, d) { var f = Math.pow(10, d); return Math.round(n * f) / f; }
  function fmt(n, d) { return n == null ? '—' : round(n, d).toFixed(d); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  var base = {
    site: {
      slug: station.slug || '',
      name: station.station || '',
      municipality: station.municipality || '',
      elevation: station.coordinates ? station.coordinates.elevation_m : null
    }
  };
  if (!input || input.ok === false || !rows.length) {
    base.no_data = true;
    return base;
  }

  rows.forEach(function (r) { r.ts = localMs(r.observed_at); });
  rows = rows.filter(function (r) { return r.ts != null; }).sort(function (a, b) { return a.ts - b.ts; });
  var last = rows[rows.length - 1];

  function lastVal(key) {
    for (var i = rows.length - 1; i >= 0; i--) if (isNum(rows[i][key])) return rows[i][key];
    return null;
  }
  function extreme(key, sign) {
    var best = null;
    rows.forEach(function (r) {
      if (isNum(r[key]) && (best == null || sign * r[key] > sign * best.v)) best = { v: r[key], ts: r.ts };
    });
    return best;
  }

  // --- series agrupadas en cubos de BUCKET_MIN minutos (media) ---
  function bucketSeries(key, decimals, agg) {
    var step = BUCKET_MIN * 60000, map = {}, order = [];
    rows.forEach(function (r) {
      if (!isNum(r[key])) return;
      var b = Math.floor(r.ts / step) * step;
      if (!map[b]) { map[b] = { sum: 0, n: 0, max: -Infinity }; order.push(b); }
      map[b].sum += r[key]; map[b].n++; map[b].max = Math.max(map[b].max, r[key]);
    });
    return order.map(function (b) {
      var v = agg === 'max' ? map[b].max : map[b].sum / map[b].n;
      return [b + step / 2, round(v, decimals)];
    });
  }

  // --- lluvia: rain_today_mm acumula desde las 00:00 y se reinicia; sumamos los incrementos ---
  var rainHours = {}, rain24 = 0, prev = null;
  rows.forEach(function (r) {
    if (!isNum(r.rain_today_mm)) return;
    if (prev != null) {
      var delta = r.rain_today_mm >= prev ? r.rain_today_mm - prev : r.rain_today_mm;
      if (delta > 0) {
        var h = Math.floor(r.ts / 3600000) * 3600000;
        rainHours[h] = (rainHours[h] || 0) + delta;
        rain24 += delta;
      }
    }
    prev = r.rain_today_mm;
  });
  var rainSeries = [];
  var h0 = Math.floor(rows[0].ts / 3600000) * 3600000, h1 = Math.floor(last.ts / 3600000) * 3600000;
  for (var h = h0; h <= h1; h += 3600000) rainSeries.push([h + 1800000, round(rainHours[h] || 0, 1)]);

  // --- tendencia de presión (últimas 3 h) ---
  var press = lastVal('pressure_hpa'), pressDelta = null, pressTrend = 'unknown';
  if (press != null) {
    var target = last.ts - 3 * 3600000, ref = null;
    rows.forEach(function (r) {
      if (!isNum(r.pressure_hpa)) return;
      if (ref == null || Math.abs(r.ts - target) < Math.abs(ref.ts - target)) ref = r;
    });
    if (ref && last.ts - ref.ts >= 2 * 3600000) {
      pressDelta = press - ref.pressure_hpa;
      pressTrend = pressDelta >= 2 ? 'rising_fast' : pressDelta >= 0.7 ? 'rising'
        : pressDelta <= -2 ? 'falling_fast' : pressDelta <= -0.7 ? 'falling' : 'steady';
    }
  }

  var temp = lastVal('temperature_c'), hum = lastVal('humidity_pct');
  var dew = null;
  if (temp != null && hum != null && hum > 0) {
    var g = Math.log(hum / 100) + (17.62 * temp) / (243.12 + temp);
    dew = (243.12 * g) / (17.62 - g);
  }
  var wind = lastVal('wind_speed_kmh'), deg = lastVal('wind_direction_deg');
  var tMax = extreme('temperature_c', 1), tMin = extreme('temperature_c', -1), wMax = extreme('wind_speed_kmh', 1);

  var toTs = localMs(input.query && input.query.to);
  var ageMin = toTs != null ? Math.max(0, Math.round((toTs - last.ts) / 60000)) : 0;

  base.observed = { time: hhmm(last.ts), date: dm(last.ts), age_min: ageMin, stale: ageMin > 45 };
  base.now = {
    temp: fmt(temp, 1),
    feels: fmt(lastVal('feels_like_c'), 1),
    hum: fmt(hum, 0),
    dew: fmt(dew, 1),
    wind: fmt(wind, 0),
    wind_dir: deg == null ? '—' : CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16],
    calm: wind != null && wind < 1,
    pressure: fmt(press, 1),
    pressure_int: fmt(press, 0),
    pressure_trend: pressTrend,
    pressure_delta: pressDelta == null ? '—' : (pressDelta > 0 ? '+' : '') + fmt(pressDelta, 1),
    rain_today: fmt(lastVal('rain_today_mm'), 1),
    rain_rate: fmt(lastVal('rain_rate_mm_h'), 1)
  };
  base.day = {
    temp_max: fmt(tMax && tMax.v, 1), temp_max_time: tMax ? hhmm(tMax.ts) : '—',
    temp_min: fmt(tMin && tMin.v, 1), temp_min_time: tMin ? hhmm(tMin.ts) : '—',
    wind_max: fmt(wMax && wMax.v, 0), wind_max_time: wMax ? hhmm(wMax.ts) : '—',
    rain_24h: fmt(rain24, 1)
  };
  base.series = {
    temp: bucketSeries('temperature_c', 1, 'avg'),
    hum: bucketSeries('humidity_pct', 0, 'avg'),
    pressure: bucketSeries('pressure_hpa', 1, 'avg'),
    wind: bucketSeries('wind_speed_kmh', 1, 'max'),
    rain_hourly: rainSeries
  };
  return base;
}
