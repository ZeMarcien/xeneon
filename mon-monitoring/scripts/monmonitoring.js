/* ============================================================
   Mon Monitoring — courbe capteur, echelle fixe 0-100 %
   - Capteur            : sensors-combobox (plugin Sensors)
   - Historique         : 1 a 5 minutes (echantillonnage 500 ms)
   - Echelle            : raw (valeur = %) ou normalisee (min-max)
   - Personnalisation   : couleur courbe / texte / fond / opacite
   ============================================================ */

(function () {
  "use strict";

  // ---- Reglages iCUE (variables globales injectees par iCUE) ----
  // sensorId, historyMinutes, curveColor, valueMode, normMin, normMax,
  // showHeader, textColor, backgroundColor, transparency

  var SAMPLE_MS = 500;              // periode d'echantillonnage
  var MAX_POINTS = 5 * 60 * (1000 / SAMPLE_MS) + 10;
  var SAVE_EVERY_MS = 5000;

  var canvas = document.getElementById("chart");
  var ctx = canvas.getContext("2d");
  var headerEl = document.getElementById("header");
  var nameEl = document.getElementById("sensorName");
  var valueEl = document.getElementById("currentValue");
  var unitsEl = document.getElementById("currentUnits");
  var emptyEl = document.getElementById("emptyState");

  var plugin = null;                // window.plugins.Sensorsdataprovider
  var nextRequestId = 0;
  var pending = {};                 // requestId -> resolve

  var histories = {};               // sensorId -> [{t, v}, ...]
  var history = [];                 // historique du capteur courant
  var currentUnits = "";
  var currentName = "";
  var dirty = true;

  // ---------------- Plugin Sensors (pattern asyncResponse) ----------------

  function pluginRequest(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve) {
      var id = nextRequestId++;
      pending[id] = resolve;
      plugin[method].apply(plugin, [id].concat(args));
    });
  }

  function onPluginReady() {
    plugin = window.plugins.Sensorsdataprovider;
    plugin.asyncResponse.connect(function (id, value) {
      if (pending[id]) {
        pending[id](value);
        delete pending[id];
      }
    });
    plugin.sensorValueChanged.connect(function (id, val) {
      // Re-echantillonne immediatement quand iCUE pousse une nouvelle valeur
      if (sensorId && id === sensorId) pushSample(parseFloat(val));
    });
    loadPersisted();
    refreshSensorMeta();
    setInterval(sampleLoop, SAMPLE_MS);
    setInterval(savePersisted, SAVE_EVERY_MS);
    setInterval(refreshSensorMeta, 10000);
    sampleLoop();
  }

  // ---------------- Echantillonnage ----------------

  function pushSample(rawVal) {
    if (sensorId == null || isNaN(rawVal)) return;
    var now = Date.now();
    var arr = histories[sensorId] || (histories[sensorId] = []);
    var last = arr[arr.length - 1];
    if (last && now - last.t < SAMPLE_MS / 2) return; // anti-doublon
    arr.push({ t: now, v: rawVal });
    if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
    history = arr;
    emptyEl.className = "empty-state hidden";
    dirty = true;
  }

  function sampleLoop() {
    if (!plugin || sensorId == null) return;
    pluginRequest("getSensorValue", sensorId).then(function (val) {
      var v = parseFloat(val);
      if (!isNaN(v)) pushSample(v);
    });
  }

  function refreshSensorMeta() {
    if (!plugin || sensorId == null) return;
    pluginRequest("getSensorUnits", sensorId).then(function (u) {
      currentUnits = u || "";
      dirty = true;
    });
    pluginRequest("getSensorName", sensorId).then(function (n) {
      currentName = n || "";
      dirty = true;
    });
  }

  // ---------------- Conversion en % ----------------

  function valueToPercent(v) {
    // Ramene la valeur brute a l echelle 0..100 (brute ou normalisee).
    // Le clamp aux bornes de l axe se fait au trace (py_), pas ici.
    if (valueMode === "norm") {
      var lo = parseFloat(normMin), hi = parseFloat(normMax);
      if (isNaN(lo) || isNaN(hi) || hi <= lo) return 0;
      return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
    }
    return v; // la valeur du capteur est deja un pourcentage
  }

  // ---------------- Persistance (localStorage, cle = uniqueId) ----------------

  function loadPersisted() {
    try {
      if (typeof uniqueId === "undefined") return;
      var raw = localStorage.getItem(uniqueId);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && data.histories) histories = data.histories;
    } catch (e) { /* localStorage indisponible : on ignore */ }
  }

  function savePersisted() {
    try {
      if (typeof uniqueId === "undefined") return;
      var cutoff = Date.now() - 5 * 60 * 1000 - 60000;
      var out = {};
      for (var sid in histories) {
        if (!histories.hasOwnProperty(sid)) continue;
        // Retire les historiques perimes puis limite la taille
        var kept = histories[sid].filter(function (p) { return p.t >= cutoff; });
        if (kept.length > MAX_POINTS) kept.splice(0, kept.length - MAX_POINTS);
        histories[sid] = kept;
        if (kept.length) out[sid] = kept;
      }
      if (sensorId != null) history = histories[sensorId] || [];
      localStorage.setItem(uniqueId, JSON.stringify({ histories: out }));
    } catch (e) { /* localStorage indisponible : on ignore */ }
  }

  // ---------------- Rendu ----------------

  function colorToRgb(c) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(c || "").trim());
    if (!m) return [255, 255, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  function resizeCanvas() {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function draw() {
    resizeCanvas();
    var W = canvas.width, H = canvas.height;
    var rgb = colorToRgb(curveColor);
    var trgb = colorToRgb(textColor);

    // Fond + opacite
    document.body.style.background = "transparent";
    var bg = colorToRgb(backgroundColor);
    var op = Math.max(0, Math.min(100, parseFloat(transparency) || 100)) / 100;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(" + bg[0] + "," + bg[1] + "," + bg[2] + "," + op + ")";
    ctx.fillRect(0, 0, W, H);

    // Entete
    headerEl.style.display = (showHeader === false) ? "none" : "flex";
    headerEl.style.color = "rgb(" + trgb[0] + "," + trgb[1] + "," + trgb[2] + ")";
    // Nom affiche : nom personnalisé si renseigné, sinon nom du capteur
    var cname = String(customName || "").trim();
    nameEl.textContent = cname || currentName || (sensorId || "--");
    var lastPoint = history.length ? history[history.length - 1] : null;
    valueEl.textContent = lastPoint ? (parseFloat(lastPoint.v).toFixed(1)) : "--";
    unitsEl.textContent = lastPoint ? " " + currentUnits : "";

    // Zone de tracé : le graphique commence 12 px sous le nom/valeur du capteur
    var srgb = colorToRgb(scaleColor);
    var axisFont = Math.max(14, Math.round(H * 0.075)); // police des echelles agrandie
    var minB = parseFloat(yMin), maxB = parseFloat(yMax);
    if (isNaN(minB) || isNaN(maxB) || maxB <= minB) { minB = 0; maxB = 100; }
    var unit = String(axisUnit == null ? "%" : axisUnit);
    var headRect = headerEl.getBoundingClientRect();
    var cRect = canvas.getBoundingClientRect();
    var gapHeader = (showHeader === false) ? 12 : Math.max(0, Math.round(headRect.bottom - cRect.top)) + 12;
    var padR = Math.round(W * 0.015);
    var padT = gapHeader + Math.round(axisFont * 0.45);
    var padB = Math.round(axisFont * 1.5);
    var padL = Math.round(axisFont * 2.6);
    var px = padL, py = padT, pw = W - padL - padR, ph = H - padT - padB;
    if (pw <= 10 || ph <= 10) return;

    ctx.font = axisFont + 'px "Segoe UI", sans-serif';
    ctx.textBaseline = "middle";

    // Grille horizontale : borne min -> borne max (reglables), 5 graduations
    var i, gy, lbl;
    for (i = 0; i <= 4; i++) {
      gy = py + ph - (ph * i) / 4;
      ctx.strokeStyle = "rgba(" + srgb[0] + "," + srgb[1] + "," + srgb[2] + ",0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, Math.round(gy) + 0.5);
      ctx.lineTo(px + pw, Math.round(gy) + 0.5);
      ctx.stroke();
      lbl = parseFloat((minB + ((maxB - minB) * i) / 4).toFixed(1));
      ctx.fillStyle = "rgba(" + srgb[0] + "," + srgb[1] + "," + srgb[2] + ",0.8)";
      ctx.textAlign = "right";
      ctx.fillText(lbl + (unit ? " " + unit : ""), px - 4, gy);
    }

    // Grille verticale : une ligne par minute, "0" a droite (au lieu de "maintenant")
    var minutes = Math.max(1, parseInt(historyMinutes, 10) || 2);
    var now = Date.now();
    var windowMs = minutes * 60 * 1000;
    var x0 = px + pw; // t = now
    var tu = (timeUnit === "s") ? "s" : "min";
    ctx.textAlign = "center";
    for (i = 0; i <= minutes; i++) {
      var gx = x0 - (pw * (i * 60 * 1000)) / windowMs;
      if (gx < px) break;
      ctx.strokeStyle = "rgba(" + srgb[0] + "," + srgb[1] + "," + srgb[2] + ",0.18)";
      ctx.beginPath();
      ctx.moveTo(Math.round(gx) + 0.5, py);
      ctx.lineTo(Math.round(gx) + 0.5, py + ph);
      ctx.stroke();
      ctx.fillStyle = "rgba(" + srgb[0] + "," + srgb[1] + "," + srgb[2] + ",0.8)";
      var tlabel;
      if (i === 0) tlabel = "0";
      else if (tu === "s") tlabel = "-" + (i * 60);
      else tlabel = "-" + i;
      if (i === minutes) tlabel += " (" + tu + ")";
      ctx.fillText(tlabel, gx, py + ph + axisFont * 0.75);
    }

    // Historique visible
    var visible = history.filter(function (p) { return p.t >= now - windowMs; });
    if (!visible.length) {
      emptyEl.className = "empty-state";
      emptyEl.style.color = "rgba(" + trgb[0] + "," + trgb[1] + "," + trgb[2] + ",0.6)";
      return;
    }
    emptyEl.className = "empty-state hidden";

    function px_(p) {
      return px + pw - ((now - p.t) / windowMs) * pw;
    }
    function py_(p) {
      var pct = valueToPercent(p.v);          // valeur ramenee a l echelle 0..100
      var t = (pct - minB) / (maxB - minB);   // borne min/max de l axe
      t = Math.max(0, Math.min(1, t));
      return py + ph - t * ph;
    }

    // Remplissage sous la courbe
    var grad = ctx.createLinearGradient(0, py, 0, py + ph);
    grad.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.30)");
    grad.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.02)");
    ctx.beginPath();
    ctx.moveTo(px_(visible[0]), py + ph);
    for (i = 0; i < visible.length; i++) ctx.lineTo(px_(visible[i]), py_(visible[i]));
    ctx.lineTo(px_(visible[visible.length - 1]), py + ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Courbe
    ctx.beginPath();
    for (i = 0; i < visible.length; i++) {
      var X = px_(visible[i]), Y = py_(visible[i]);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    ctx.lineWidth = Math.max(2, Math.round(H * 0.012));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // Point courant
    var lastX = px_(visible[visible.length - 1]);
    var lastY = py_(visible[visible.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, Math.max(3, H * 0.012), 0, Math.PI * 2);
    ctx.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    ctx.fill();
  }

  // ---------------- Boucle de rendu ----------------

  function renderIfDirty() {
    if (dirty) { dirty = false; draw(); }
  }
  setInterval(renderIfDirty, 100);

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(function () { dirty = true; }).observe(document.body);
  }

  // ---------------- Evenements iCUE ----------------

  // Reception des proprietes : iCUE (re)declenche onDataUpdated a chaque
  // changement dans les reglages du widget.
  window.__onProps = function () {
    // Changement de capteur : on bascule sur son historique
    if (sensorId != null) {
      history = histories[sensorId] || (histories[sensorId] = []);
      if (history.length) { emptyEl.className = "empty-state hidden"; }
      refreshSensorMeta();
      sampleLoop();
    }
    dirty = true;
  };
  window.__onPluginReady = onPluginReady;

  icueEvents = { onDataUpdated: window.__onProps, onICUEInitialized: window.__onProps };
  pluginSensorsdataproviderEvents = { onInitialized: window.__onPluginReady };

  if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) window.__onProps();
  if (typeof pluginSensorsdataprovider_initialized !== "undefined" && pluginSensorsdataprovider_initialized) {
    window.__onPluginReady();
  }
})();
