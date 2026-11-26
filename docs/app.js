(function () {
  "use strict";

  var THEME_STORAGE_KEY = "local-explorer-site-theme";
  var MAX_GOOGLE_MAPS_WAYPOINTS = 9;

  var CITIES = {
    kyoto: {
      id: "kyoto",
      name: "Kyoto",
      country: "Japan",
      cityHint: "Kyoto, Japan",
      image: "assets/city-kyoto.jpg",
      imageAlt: "Quiet early-morning stone lane in Kyoto's Higashiyama district leading toward a wooden pagoda against misty hills",
      map: {
        z: 12,
        vx0: 919395.664274,
        vy0: 415159.66086,
        scale: 0.925739,
        dark: "assets/map-kyoto-dark.jpg",
        light: "assets/map-kyoto-light.jpg"
      },
      places: [
        { id: "ky-1", name: "Arashiyama Bamboo Grove", category: "natural", lat: 35.0168, lon: 135.6713 },
        { id: "ky-2", name: "Tenryu-ji Temple", category: "religion", lat: 35.0156, lon: 135.6738 },
        { id: "ky-3", name: "Togetsukyo Bridge", category: "architecture", lat: 35.0128, lon: 135.6778 },
        { id: "ky-4", name: "Ryoan-ji Rock Garden", category: "religion", lat: 35.0345, lon: 135.7183 },
        { id: "ky-5", name: "Kinkaku-ji", category: "historic", lat: 35.0394, lon: 135.7292 },
        { id: "ky-6", name: "Kitano Tenmangu Shrine", category: "religion", lat: 35.0312, lon: 135.7351 },
        { id: "ky-7", name: "Nijo Castle", category: "historic", lat: 35.0142, lon: 135.7482 },
        { id: "ky-8", name: "Nishiki Market", category: "foods", lat: 35.005, lon: 135.7649 },
        { id: "ky-9", name: "Fushimi Inari Taisha", category: "religion", lat: 34.9671, lon: 135.7727 },
        { id: "ky-10", name: "Gion Hanamikoji Street", category: "cultural", lat: 35.002, lon: 135.7751 },
        { id: "ky-11", name: "Yasaka Shrine", category: "religion", lat: 35.0037, lon: 135.7785 },
        { id: "ky-12", name: "Kiyomizu-dera", category: "historic", lat: 34.9949, lon: 135.785 },
        { id: "ky-13", name: "Heian Shrine", category: "architecture", lat: 35.016, lon: 135.7824 },
        { id: "ky-14", name: "Nanzen-ji Temple", category: "religion", lat: 35.0112, lon: 135.7936 },
        { id: "ky-15", name: "Ginkaku-ji", category: "historic", lat: 35.027, lon: 135.7982 }
      ]
    },
    lisbon: {
      id: "lisbon",
      name: "Lisbon",
      country: "Portugal",
      cityHint: "Lisbon, Portugal",
      image: "assets/city-lisbon.jpg",
      imageAlt: "Terracotta rooftops and pastel facades of Alfama overlooking the calm Tagus River in Lisbon",
      map: {
        z: 13,
        vx0: 994833.561283,
        vy0: 803431.94953,
        scale: 0.650436,
        dark: "assets/map-lisbon-dark.jpg",
        light: "assets/map-lisbon-light.jpg"
      },
      places: [
        { id: "li-1", name: "Belém Tower", category: "historic", lat: 38.6916, lon: -9.216 },
        { id: "li-2", name: "Jerónimos Monastery", category: "architecture", lat: 38.6979, lon: -9.2067 },
        { id: "li-3", name: "Pastéis de Belém", category: "foods", lat: 38.6975, lon: -9.2032 },
        { id: "li-4", name: "MAAT Museum", category: "museums", lat: 38.6959, lon: -9.1942 },
        { id: "li-5", name: "LX Factory", category: "cultural", lat: 38.7035, lon: -9.1787 },
        { id: "li-6", name: "Basílica da Estrela", category: "religion", lat: 38.7131, lon: -9.1607 },
        { id: "li-7", name: "Time Out Market Lisbon", category: "foods", lat: 38.7071, lon: -9.1459 },
        { id: "li-8", name: "Miradouro de São Pedro de Alcântara", category: "natural", lat: 38.7153, lon: -9.1442 },
        { id: "li-9", name: "Carmo Convent", category: "historic", lat: 38.7121, lon: -9.1403 },
        { id: "li-10", name: "Santa Justa Lift", category: "architecture", lat: 38.7121, lon: -9.1394 },
        { id: "li-11", name: "Praça do Comércio", category: "cultural", lat: 38.7078, lon: -9.1366 },
        { id: "li-12", name: "São Jorge Castle", category: "historic", lat: 38.7139, lon: -9.1334 },
        { id: "li-13", name: "Miradouro de Santa Luzia", category: "natural", lat: 38.7117, lon: -9.1304 },
        { id: "li-14", name: "National Pantheon", category: "architecture", lat: 38.715, lon: -9.1246 },
        { id: "li-15", name: "National Tile Museum", category: "museums", lat: 38.7249, lon: -9.1136 }
      ]
    },
    paris: {
      id: "paris",
      name: "Paris",
      country: "France",
      cityHint: "Paris, France",
      image: "assets/city-paris.jpg",
      imageAlt: "Haussmann limestone architecture and an arched stone bridge reflecting twilight highlights along the Seine in Paris",
      map: {
        z: 13,
        vx0: 1061793.215958,
        vy0: 721147.799528,
        scale: 0.646035,
        dark: "assets/map-paris-dark.jpg",
        light: "assets/map-paris-light.jpg"
      },
      places: [
        { id: "pa-1", name: "Eiffel Tower", category: "architecture", lat: 48.8584, lon: 2.2945 },
        { id: "pa-2", name: "Arc de Triomphe", category: "historic", lat: 48.8738, lon: 2.295 },
        { id: "pa-3", name: "Musée du Quai Branly", category: "museums", lat: 48.861, lon: 2.2979 },
        { id: "pa-4", name: "Grand Palais", category: "architecture", lat: 48.8661, lon: 2.3125 },
        { id: "pa-5", name: "Musée Rodin", category: "museums", lat: 48.8553, lon: 2.3158 },
        { id: "pa-6", name: "Musée d'Orsay", category: "museums", lat: 48.86, lon: 2.3266 },
        { id: "pa-7", name: "Jardin du Luxembourg", category: "natural", lat: 48.8462, lon: 2.3372 },
        { id: "pa-8", name: "Louvre Museum", category: "museums", lat: 48.8606, lon: 2.3376 },
        { id: "pa-9", name: "Musée de Montmartre", category: "museums", lat: 48.8878, lon: 2.3406 },
        { id: "pa-10", name: "Sacré-Cœur Basilica", category: "religion", lat: 48.8867, lon: 2.3431 },
        { id: "pa-11", name: "Sainte-Chapelle", category: "religion", lat: 48.8554, lon: 2.345 },
        { id: "pa-12", name: "Panthéon", category: "historic", lat: 48.8462, lon: 2.3464 },
        { id: "pa-13", name: "Notre-Dame de Paris", category: "religion", lat: 48.853, lon: 2.3499 },
        { id: "pa-14", name: "Centre Pompidou", category: "cultural", lat: 48.8606, lon: 2.3522 },
        { id: "pa-15", name: "Place des Vosges", category: "historic", lat: 48.8556, lon: 2.3655 }
      ]
    }
  };

  /* --------------------------------------------------------------------------
   * Routing engine — mirrors lib/itinerary-routing.ts exactly
   * -------------------------------------------------------------------------- */
  function hasCoords(p) {
    return (
      typeof p.lat === "number" &&
      Number.isFinite(p.lat) &&
      typeof p.lon === "number" &&
      Number.isFinite(p.lon)
    );
  }

  function dist2(a, b, cosLat) {
    var dLat = a.lat - b.lat;
    var dLon = (a.lon - b.lon) * cosLat;
    return dLat * dLat + dLon * dLon;
  }

  function dist(a, b, cosLat) {
    return Math.sqrt(dist2(a, b, cosLat));
  }

  function sampleInOrder(arr, k, shuffle) {
    if (arr.length <= k) return arr;
    if (!shuffle) return arr.slice(0, k);

    var picked = arr
      .map(function (_, i) {
        return { i: i, r: Math.random() };
      })
      .sort(function (a, b) {
        return a.r - b.r;
      })
      .slice(0, k)
      .map(function (x) {
        return x.i;
      })
      .sort(function (a, b) {
        return a - b;
      });

    return picked.map(function (i) {
      return arr[i];
    });
  }

  function assignDays(places, daysCount, shuffle) {
    var withCoords = places.filter(hasCoords);
    var buckets = [];
    for (var d = 0; d < daysCount; d++) buckets.push([]);

    if (withCoords.length >= 2) {
      var meanLat =
        withCoords.reduce(function (s, p) {
          return s + p.lat;
        }, 0) / withCoords.length;
      var meanLon =
        withCoords.reduce(function (s, p) {
          return s + p.lon;
        }, 0) / withCoords.length;
      var cosLat = Math.cos((meanLat * Math.PI) / 180);

      var sorted = withCoords.slice().sort(function (a, b) {
        var aa = Math.atan2(a.lat - meanLat, (a.lon - meanLon) * cosLat);
        var bb = Math.atan2(b.lat - meanLat, (b.lon - meanLon) * cosLat);
        return aa - bb;
      });

      var offset = shuffle ? Math.floor(Math.random() * sorted.length) : 0;
      var rotated = sorted.slice(offset).concat(sorted.slice(0, offset));

      rotated.forEach(function (p, i) {
        var day = Math.min(Math.floor((i * daysCount) / sorted.length), daysCount - 1);
        buckets[day].push(p);
      });

      var noCoords = places.filter(function (p) {
        return !hasCoords(p);
      });
      noCoords.forEach(function (p, i) {
        buckets[i % daysCount].push(p);
      });

      return buckets;
    }

    var fallback = shuffle
      ? places.slice()
      : places.slice().sort(function (a, b) {
          var ca = a.category || "";
          var cb = b.category || "";
          if (ca !== cb) return ca.localeCompare(cb);
          return a.name.localeCompare(b.name);
        });

    fallback.forEach(function (p, i) {
      buckets[i % daysCount].push(p);
    });
    return buckets;
  }

  function reverseSegment(arr, i, j) {
    var lo = i;
    var hi = j;
    while (lo < hi) {
      var tmp = arr[lo];
      arr[lo] = arr[hi];
      arr[hi] = tmp;
      lo++;
      hi--;
    }
  }

  function twoOptOpenPath(ordered, cosLat) {
    var path = ordered.slice();
    var n = path.length;
    if (n <= 2) return path;

    var maxPasses = Math.max(10, n * n);
    for (var pass = 0; pass < maxPasses; pass++) {
      var improved = false;

      for (var i = 0; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
          if (i === 0 && j === n - 1) continue;

          var before =
            (i > 0 ? dist(path[i - 1], path[i], cosLat) : 0) +
            (j + 1 < n ? dist(path[j], path[j + 1], cosLat) : 0);
          var after =
            (i > 0 ? dist(path[i - 1], path[j], cosLat) : 0) +
            (j + 1 < n ? dist(path[i], path[j + 1], cosLat) : 0);

          if (after + 1e-12 < before) {
            reverseSegment(path, i, j);
            improved = true;
          }
        }
      }

      if (!improved) break;
    }

    return path;
  }

  function orderWithinDay(day, shuffle) {
    var pts = day.filter(hasCoords);
    var rest = day.filter(function (p) {
      return !hasCoords(p);
    });

    if (pts.length <= 1) return pts.concat(rest);

    if (pts.length === 2) {
      var pair = pts.slice();
      if (shuffle && Math.random() < 0.5) pair.reverse();
      return pair.concat(rest);
    }

    var meanLat =
      pts.reduce(function (s, p) {
        return s + p.lat;
      }, 0) / pts.length;
    var cosLat = Math.cos((meanLat * Math.PI) / 180);

    var remaining = new Set(
      pts.map(function (p) {
        return p.id;
      })
    );
    var byId = new Map(
      pts.map(function (p) {
        return [p.id, p];
      })
    );
    var ordered = [];

    var current = pts[shuffle ? Math.floor(Math.random() * pts.length) : 0];
    ordered.push(current);
    remaining.delete(current.id);

    while (remaining.size) {
      var bestId = null;
      var bestD = Infinity;
      remaining.forEach(function (id) {
        var cand = byId.get(id);
        var d = dist2(current, cand, cosLat);
        if (d < bestD) {
          bestD = d;
          bestId = id;
        }
      });
      current = byId.get(bestId);
      ordered.push(current);
      remaining.delete(current.id);
    }

    var improved = twoOptOpenPath(ordered, cosLat);
    if (shuffle && Math.random() < 0.5) {
      improved.reverse();
    }

    return improved.concat(rest);
  }

  function generateItinerary(places, daysCount, perDay, shuffle) {
    var buckets = assignDays(places, daysCount, shuffle);
    return buckets.map(function (bucket) {
      var trimmed = sampleInOrder(bucket, perDay, shuffle);
      return orderWithinDay(trimmed, shuffle);
    });
  }

  function haversineKm(a, b) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLon = (b.lon - a.lon) * toRad;
    var lat1 = a.lat * toRad;
    var lat2 = b.lat * toRad;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function pathKm(stops) {
    var total = 0;
    for (var i = 1; i < stops.length; i++) {
      total += haversineKm(stops[i - 1], stops[i]);
    }
    return total;
  }

  /* --------------------------------------------------------------------------
   * Google Maps URL builders — mirrors lib/maps-links.ts
   * -------------------------------------------------------------------------- */
  function isValidCoord(lat, lon) {
    return (
      typeof lat === "number" &&
      typeof lon === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    );
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function startsWithWholeSegment(haystack, needle) {
    var escaped = escapeRegExp(needle);
    return new RegExp("^" + escaped + "(?:$|\\s*,)", "i").test(haystack);
  }

  function containsWholePhrase(haystack, needle) {
    var escaped = escapeRegExp(needle);
    return new RegExp("(?<![\\p{L}\\p{N}])" + escaped + "(?![\\p{L}\\p{N}])", "iu").test(haystack);
  }

  function buildTextQuery(place) {
    var name = (place.name || "").trim();
    var address = (place.address || "").trim();
    var cityHint = (place.cityHint || "").trim();

    if (name && address) {
      return startsWithWholeSegment(address, name) ? address : name + ", " + address;
    }
    if (name && cityHint) {
      return containsWholePhrase(name, cityHint) ? name : name + ", " + cityHint;
    }
    if (name) return name;
    if (address) return address;
    return null;
  }

  function buildGoogleMapsPlaceUrl(place) {
    var textQuery = buildTextQuery(place);
    if (textQuery) {
      return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(textQuery);
    }
    if (isValidCoord(place.lat, place.lon)) {
      return (
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(place.lat.toFixed(6) + "," + place.lon.toFixed(6))
      );
    }
    return null;
  }

  function encodeRouteStop(stop) {
    var textQuery = buildTextQuery(stop);
    if (textQuery) {
      var sanitized = textQuery
        .replace(/\|/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^,\s*/, "")
        .trim();
      if (sanitized) return sanitized;
    }
    if (isValidCoord(stop.lat, stop.lon)) {
      return stop.lat.toFixed(6) + "," + stop.lon.toFixed(6);
    }
    return null;
  }

  function buildGoogleMapsDayRouteUrl(stops) {
    var encoded = stops.map(encodeRouteStop).filter(Boolean);
    if (encoded.length < 2) return null;

    var origin = encoded[0];
    var destination = encoded[encoded.length - 1];
    var rawWaypoints = encoded.slice(1, -1);
    var waypoints = rawWaypoints.slice(0, MAX_GOOGLE_MAPS_WAYPOINTS);
    var truncated = rawWaypoints.length > MAX_GOOGLE_MAPS_WAYPOINTS;

    var params = new URLSearchParams({
      api: "1",
      origin: origin,
      destination: destination
    });
    if (waypoints.length > 0) {
      params.set("waypoints", waypoints.join("|"));
    }

    return {
      url: "https://www.google.com/maps/dir/?" + params.toString(),
      truncated: truncated,
      totalStops: encoded.length,
      includedStops: waypoints.length + 2
    };
  }

  function projectToMap(place, mapCfg) {
    var n = Math.pow(2, mapCfg.z);
    var wx = ((place.lon + 180) / 360) * n * 256;
    var latRad = (place.lat * Math.PI) / 180;
    var wy =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n *
      256;
    return {
      x: (wx - mapCfg.vx0) * mapCfg.scale,
      y: (wy - mapCfg.vy0) * mapCfg.scale
    };
  }

  function deoverlapPins(points, minDist, width, height) {
    var pts = points.map(function (p) {
      return { x: p.x, y: p.y };
    });
    for (var iter = 0; iter < 8; iter++) {
      for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          var dx = pts[j].x - pts[i].x;
          var dy = pts[j].y - pts[i].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist) {
            if (d < 1e-3) {
              dx = 1;
              dy = 0;
              d = 1;
            }
            var push = (minDist - d) * 0.52;
            var ux = dx / d;
            var uy = dy / d;
            pts[i].x -= ux * push;
            pts[i].y -= uy * push;
            pts[j].x += ux * push;
            pts[j].y += uy * push;
          }
        }
      }
    }
    return pts.map(function (p) {
      return {
        x: Math.max(14, Math.min(width - 14, p.x)),
        y: Math.max(14, Math.min(height - 18, p.y))
      };
    });
  }

  /* Export for Node parity verification without affecting browsers */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      CITIES: CITIES,
      assignDays: assignDays,
      sampleInOrder: sampleInOrder,
      orderWithinDay: orderWithinDay,
      twoOptOpenPath: twoOptOpenPath,
      generateItinerary: generateItinerary,
      buildGoogleMapsPlaceUrl: buildGoogleMapsPlaceUrl,
      buildGoogleMapsDayRouteUrl: buildGoogleMapsDayRouteUrl,
      projectToMap: projectToMap
    };
  }

  if (typeof document === "undefined") return;

  /* --------------------------------------------------------------------------
   * Browser UI
   * -------------------------------------------------------------------------- */
  var DAY_VARS = ["var(--day-1)", "var(--day-2)", "var(--day-3)"];
  var SVG_NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== null && attrs[k] !== undefined) {
          node.setAttribute(k, String(attrs[k]));
        }
      });
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs, text) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== null && attrs[k] !== undefined) {
          node.setAttribute(k, String(attrs[k]));
        }
      });
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* Theme toggle with safe storage fallback */
  var memoryTheme = null;
  function readStoredTheme() {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch (_err) {
      return memoryTheme;
    }
  }

  function writeStoredTheme(value) {
    memoryTheme = value;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (_err) {
      /* ignore restricted storage */
    }
  }

  function initTheme() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function syncLabel() {
      var isLight = document.documentElement.getAttribute("data-theme") === "light";
      btn.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
      btn.setAttribute("title", isLight ? "Switch to dark theme" : "Switch to light theme");
    }

    var saved = readStoredTheme();
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    syncLabel();

    btn.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      var next = current === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      writeStoredTheme(next);
      syncLabel();
      window.dispatchEvent(new CustomEvent("local-explorer-theme-change"));
    });
  }

  /* Clipboard copy with fallback */
  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      var area = el("textarea", { class: "copy-scratch", "aria-hidden": "true", readonly: "" });
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (ok) resolve();
        else reject(new Error("execCommand failed"));
      } catch (err) {
        document.body.removeChild(area);
        reject(err);
      }
    });
  }

  function initCopyButtons() {
    var buttons = document.querySelectorAll("[data-copy-target]");
    buttons.forEach(function (btn) {
      var timer = null;
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-copy-target");
        var target = targetId ? document.getElementById(targetId) : null;
        if (!target) return;
        var text = target.textContent || "";

        if (timer) clearTimeout(timer);
        btn.classList.remove("is-copied", "is-failed");

        copyText(text).then(
          function () {
            btn.textContent = "Copied";
            btn.classList.add("is-copied");
            timer = setTimeout(function () {
              btn.textContent = "Copy";
              btn.classList.remove("is-copied");
            }, 1800);
          },
          function () {
            btn.textContent = "Failed";
            btn.classList.add("is-failed");
            timer = setTimeout(function () {
              btn.textContent = "Copy";
              btn.classList.remove("is-failed");
            }, 1800);
          }
        );
      });
    });
  }

  /* Accessible WAI-ARIA underline tabs */
  function initWorkflowTabs() {
    var tablist = document.querySelector('[role="tablist"]');
    if (!tablist) return;
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));

    function activate(nextTab, moveFocus) {
      tabs.forEach(function (tab) {
        var selected = tab === nextTab;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.setAttribute("tabindex", selected ? "0" : "-1");
        var panelId = tab.getAttribute("aria-controls");
        var panel = panelId ? document.getElementById(panelId) : null;
        if (panel) panel.hidden = !selected;
      });
      if (moveFocus) nextTab.focus();
    }

    tabs.forEach(function (tab, idx) {
      tab.addEventListener("click", function () {
        activate(tab, false);
      });
      tab.addEventListener("keydown", function (ev) {
        var targetIdx = null;
        if (ev.key === "ArrowRight") targetIdx = (idx + 1) % tabs.length;
        else if (ev.key === "ArrowLeft") targetIdx = (idx - 1 + tabs.length) % tabs.length;
        else if (ev.key === "Home") targetIdx = 0;
        else if (ev.key === "End") targetIdx = tabs.length - 1;

        if (targetIdx !== null) {
          ev.preventDefault();
          activate(tabs[targetIdx], true);
        }
      });
    });
  }

  /* Interactive Route Preview */
  function signatureFor(days) {
    return days
      .map(function (day) {
        return day
          .map(function (p) {
            return p.id;
          })
          .join(",");
      })
      .join("|");
  }

  function renderSvgMap(svg, city, days) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var W = 460;
    var H = 310;
    var mapCfg = city.map;
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    var mapSrc = isLight ? mapCfg.light : mapCfg.dark;

    /* Pre-baked OpenStreetMap street underlay */
    svg.appendChild(
      svgEl("image", {
        href: mapSrc,
        x: "0",
        y: "0",
        width: String(W),
        height: String(H),
        preserveAspectRatio: "xMidYMid slice"
      })
    );

    /* Unselected / trimmed saved places shown as subtle markers */
    var activeIds = new Set();
    days.forEach(function (day) {
      day.forEach(function (p) {
        activeIds.add(p.id);
      });
    });

    city.places.forEach(function (p) {
      if (activeIds.has(p.id)) return;
      var pt = projectToMap(p, mapCfg);
      var dot = svgEl("circle", {
        cx: pt.x.toFixed(1),
        cy: pt.y.toFixed(1),
        r: "3.5",
        fill: "var(--map-pin-stroke)",
        stroke: "var(--muted)",
        "stroke-width": "1.3",
        opacity: "0.85"
      });
      dot.appendChild(svgEl("title", null, p.name + " (outside per-day cap)"));
      svg.appendChild(dot);
    });

    /* Project and gently de-overlap active pins so close stops stay readable */
    var rawPins = [];
    var pinMeta = [];
    days.forEach(function (day, dayIdx) {
      day.forEach(function (place, stopIdx) {
        rawPins.push(projectToMap(place, mapCfg));
        pinMeta.push({ dayIdx: dayIdx, stopIdx: stopIdx, place: place });
      });
    });

    var nudged = deoverlapPins(rawPins, 21, W, H);
    var dayCoords = days.map(function () {
      return [];
    });
    nudged.forEach(function (pt, idx) {
      dayCoords[pinMeta[idx].dayIdx].push(pt);
    });

    /* Day route polylines with dark/light halo for street contrast */
    dayCoords.forEach(function (coords, dayIdx) {
      if (coords.length < 2) return;
      var color = DAY_VARS[dayIdx % DAY_VARS.length];
      var ptsAttr = coords
        .map(function (c) {
          return c.x.toFixed(1) + "," + c.y.toFixed(1);
        })
        .join(" ");

      svg.appendChild(
        svgEl("polyline", {
          points: ptsAttr,
          fill: "none",
          stroke: "var(--map-pin-stroke)",
          "stroke-width": "5.4",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          opacity: "0.85"
        })
      );
      svg.appendChild(
        svgEl("polyline", {
          points: ptsAttr,
          fill: "none",
          stroke: color,
          "stroke-width": "2.4",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          opacity: "0.96"
        })
      );
    });

    /* Clickable numbered waypoint pins */
    nudged.forEach(function (pt, idx) {
      var meta = pinMeta[idx];
      var color = DAY_VARS[meta.dayIdx % DAY_VARS.length];
      var place = meta.place;
      var label = "Day " + (meta.dayIdx + 1) + " · #" + (meta.stopIdx + 1) + " " + place.name;
      var placeUrl = buildGoogleMapsPlaceUrl({
        name: place.name,
        lat: place.lat,
        lon: place.lon,
        cityHint: city.cityHint
      });

      var container = placeUrl
        ? svgEl("a", {
            href: placeUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "map-pin-link",
            "aria-label": label + " — open in Google Maps"
          })
        : svgEl("g");

      container.appendChild(svgEl("title", null, label));
      container.appendChild(
        svgEl("circle", {
          cx: pt.x.toFixed(1),
          cy: pt.y.toFixed(1),
          r: "9.5",
          fill: color,
          stroke: "var(--map-pin-stroke)",
          "stroke-width": "2"
        })
      );
      container.appendChild(
        svgEl(
          "text",
          {
            x: pt.x.toFixed(1),
            y: (pt.y + 3.5).toFixed(1),
            "text-anchor": "middle",
            "font-size": "10",
            "font-weight": "600",
            "font-family": "var(--mono)",
            fill: "var(--map-pin-ink)"
          },
          String(meta.stopIdx + 1)
        )
      );
      svg.appendChild(container);
    });
  }

  function initRouteDemo() {
    var form = document.getElementById("demo-form");
    var svg = document.getElementById("route-svg");
    var scheduleEl = document.getElementById("schedule-output");
    var bannerImg = document.getElementById("map-city-img");
    var cityNameEl = document.getElementById("map-city-name");
    var cityMetaEl = document.getElementById("map-city-meta");
    var legendEl = document.getElementById("map-legend");
    var metricEl = document.getElementById("map-metric");
    var shuffleBtn = document.getElementById("btn-shuffle");
    var resetBtn = document.getElementById("btn-reset");
    var heroCards = document.querySelectorAll("[data-select-city]");

    if (!form || !svg || !scheduleEl) return;

    function readFormState() {
      var cityInput = form.querySelector('input[name="city"]:checked');
      var daysInput = form.querySelector('input[name="days"]:checked');
      var perDayInput = form.querySelector('input[name="perDay"]:checked');
      return {
        cityId: cityInput && CITIES[cityInput.value] ? cityInput.value : "kyoto",
        daysCount: daysInput ? Number(daysInput.value) || 3 : 3,
        perDay: perDayInput ? Number(perDayInput.value) || 4 : 4
      };
    }

    var initial = readFormState();
    var state = {
      cityId: initial.cityId,
      daysCount: initial.daysCount,
      perDay: initial.perDay,
      lastSig: "",
      lastDays: null
    };

    function syncHeroCards() {
      heroCards.forEach(function (card) {
        var active = card.getAttribute("data-select-city") === state.cityId;
        card.classList.toggle("is-selected", active);
        card.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function render(isShuffle) {
      var city = CITIES[state.cityId] || CITIES.kyoto;
      var days = generateItinerary(city.places, state.daysCount, state.perDay, isShuffle);

      /* Avoid an accidental identical shuffle when alternatives exist */
      if (isShuffle) {
        for (var attempt = 0; attempt < 5; attempt++) {
          if (signatureFor(days) !== state.lastSig) break;
          days = generateItinerary(city.places, state.daysCount, state.perDay, true);
        }
      }
      state.lastSig = signatureFor(days);
      state.lastDays = days;

      /* Update banner */
      if (bannerImg) {
        bannerImg.src = city.image;
        bannerImg.alt = city.imageAlt;
      }
      if (cityNameEl) cityNameEl.textContent = city.name + ", " + city.country;
      var totalStops = days.reduce(function (acc, d) {
        return acc + d.length;
      }, 0);
      if (cityMetaEl) {
        cityMetaEl.textContent =
          totalStops + " of " + city.places.length + " saved spots · " + state.daysCount + " days";
      }

      /* Render SVG map */
      renderSvgMap(svg, city, days);

      /* Render legend + total km */
      var totalKm = days.reduce(function (sum, d) {
        return sum + pathKm(d);
      }, 0);

      if (legendEl) {
        while (legendEl.firstChild) legendEl.removeChild(legendEl.firstChild);
        days.forEach(function (_day, idx) {
          var item = el("span", { class: "legend-item" });
          var dot = el("span", { class: "day-dot" });
          dot.style.background = DAY_VARS[idx % DAY_VARS.length];
          item.appendChild(dot);
          item.appendChild(document.createTextNode("Day " + (idx + 1)));
          legendEl.appendChild(item);
        });
      }

      if (metricEl) {
        metricEl.textContent = totalKm.toFixed(1) + " km total";
      }

      /* Render schedule list */
      while (scheduleEl.firstChild) scheduleEl.removeChild(scheduleEl.firstChild);

      days.forEach(function (day, dayIdx) {
        var block = el("div", { class: "day-block" });
        var head = el("div", { class: "day-head" });

        var title = el("div", { class: "day-title" });
        var dot = el("span", { class: "day-dot" });
        dot.style.background = DAY_VARS[dayIdx % DAY_VARS.length];
        title.appendChild(dot);

        var titleText = el("span", { class: "day-title-text" });
        titleText.appendChild(el("span", { class: "day-label" }, "Day " + (dayIdx + 1)));
        var km = pathKm(day);
        var metaText =
          day.length + " stop" + (day.length === 1 ? "" : "s") +
          (day.length >= 2 ? " · " + km.toFixed(1) + " km" : "");
        titleText.appendChild(el("span", { class: "day-meta" }, metaText));
        title.appendChild(titleText);
        head.appendChild(title);

        var routeLink = buildGoogleMapsDayRouteUrl(
          day.map(function (p) {
            return { name: p.name, lat: p.lat, lon: p.lon, cityHint: city.cityHint };
          })
        );
        if (routeLink) {
          head.appendChild(
            el(
              "a",
              {
                class: "maps-day-link",
                href: routeLink.url,
                target: "_blank",
                rel: "noopener noreferrer",
                "aria-label": "Open Day " + (dayIdx + 1) + " route in Google Maps"
              },
              "Google Maps ↗"
            )
          );
        }

        block.appendChild(head);

        var ul = el("ul", { class: "stop-list" });
        day.forEach(function (place, stopIdx) {
          var li = el("li", { class: "stop-row" });
          var main = el("div", { class: "stop-main" });
          main.appendChild(el("span", { class: "stop-idx" }, String(stopIdx + 1)));

          var placeUrl = buildGoogleMapsPlaceUrl({
            name: place.name,
            lat: place.lat,
            lon: place.lon,
            cityHint: city.cityHint
          });
          if (placeUrl) {
            main.appendChild(
              el(
                "a",
                {
                  class: "stop-link",
                  href: placeUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  title: "Open " + place.name + " in Google Maps"
                },
                place.name
              )
            );
          } else {
            main.appendChild(el("span", { class: "stop-link" }, place.name));
          }

          li.appendChild(main);
          li.appendChild(el("span", { class: "cat-badge" }, place.category));
          ul.appendChild(li);
        });

        block.appendChild(ul);
        scheduleEl.appendChild(block);
      });

      syncHeroCards();
    }

    form.addEventListener("change", function (ev) {
      var target = ev.target;
      if (!target || !target.name) return;
      if (target.name === "city") state.cityId = target.value;
      else if (target.name === "days") state.daysCount = Number(target.value);
      else if (target.name === "perDay") state.perDay = Number(target.value);
      render(false);
    });

    if (shuffleBtn) {
      shuffleBtn.addEventListener("click", function () {
        render(true);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        render(false);
      });
    }

    heroCards.forEach(function (card) {
      card.addEventListener("click", function () {
        var nextCity = card.getAttribute("data-select-city");
        if (!nextCity || !CITIES[nextCity]) return;
        state.cityId = nextCity;
        var radio = form.querySelector('input[name="city"][value="' + nextCity + '"]');
        if (radio) radio.checked = true;
        render(false);
        var demoSection = document.getElementById("demo");
        if (demoSection) demoSection.scrollIntoView({ behavior: "smooth" });
      });
    });

    window.addEventListener("local-explorer-theme-change", function () {
      if (state.lastDays) {
        var city = CITIES[state.cityId] || CITIES.kyoto;
        renderSvgMap(svg, city, state.lastDays);
      }
    });

    window.addEventListener("pageshow", function () {
      var restored = readFormState();
      if (
        restored.cityId !== state.cityId ||
        restored.daysCount !== state.daysCount ||
        restored.perDay !== state.perDay
      ) {
        state.cityId = restored.cityId;
        state.daysCount = restored.daysCount;
        state.perDay = restored.perDay;
        render(false);
      }
    });

    render(false);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initCopyButtons();
    initWorkflowTabs();
    initRouteDemo();
  });
})();
