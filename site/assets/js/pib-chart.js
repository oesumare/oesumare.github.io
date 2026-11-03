"use strict";

(() => {
  const section = document.querySelector("[data-pib-chart]");
  if (!section) return;

  const svg = section.querySelector("[data-pib-svg]");
  const readout = section.querySelector("[data-pib-value]");
  const status = section.querySelector("[data-pib-status]");
  const sourceUrl = "data/pib-municipal-historico.json?v=20261028-1999-2023";
  const ns = "http://www.w3.org/2000/svg";
  let observations = [];
  let selectedIndex = 0;
  let width = 900;
  let plot = { left: 82, right: 886, top: 56, bottom: 276 };
  const height = 330;

  const element = (tag, attrs = {}, value = "") => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, val]) => node.setAttribute(key, String(val)));
    if (value) node.textContent = value;
    return node;
  };
  const billions = (value) => value / 1_000_000;
  const format = (value) => `R$ ${billions(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })} bi`;
  const xFor = (index) => plot.left + index * (plot.right - plot.left) / (observations.length - 1);
  const yFor = (value) => plot.bottom - billions(value) / 20 * (plot.bottom - plot.top);

  const select = (index) => {
    selectedIndex = Math.max(0, Math.min(observations.length - 1, index));
    const observation = observations[selectedIndex];
    const x = xFor(selectedIndex);
    const y = yFor(observation.value);
    const label = `${observation.year} · ${format(observation.value)}`;
    readout.textContent = `${label} · preços correntes`;
    readout.hidden = false;
    svg.setAttribute("aria-valuenow", String(observation.year));
    svg.setAttribute("aria-valuetext", readout.textContent);

    const marker = svg.querySelector("[data-pib-marker]");
    marker.setAttribute("cx", x);
    marker.setAttribute("cy", y);

    // A compact callout follows the point without crossing the curve.
    const tooltip = svg.querySelector("[data-pib-tooltip]");
    const labelText = tooltip.querySelector("text");
    const labelBox = tooltip.querySelector("rect");
    const fontSize = width <= 480 ? 13 : 15;
    const labelWidth = label.length * fontSize * 0.55 + 20;
    const labelHeight = fontSize + 14;
    const centerX = Math.max(plot.left + labelWidth / 2, Math.min(plot.right - labelWidth / 2, x));
    const boxY = Math.max(4, y - labelHeight - 15);
    labelBox.setAttribute("x", centerX - labelWidth / 2);
    labelBox.setAttribute("y", boxY);
    labelBox.setAttribute("width", labelWidth);
    labelBox.setAttribute("height", labelHeight);
    labelText.setAttribute("x", centerX);
    labelText.setAttribute("y", boxY + labelHeight / 2 + fontSize * 0.35);
    labelText.textContent = label;
    tooltip.removeAttribute("hidden");
  };

  const nearestIndex = (event) => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return selectedIndex;
    const local = point.matrixTransform(ctm.inverse());
    return Math.round(Math.max(0, Math.min(observations.length - 1,
      (local.x - plot.left) / (plot.right - plot.left) * (observations.length - 1))));
  };

  const render = () => {
    if (observations.length < 2) return;
    width = Math.min(900, Math.max(320, Math.round(section.getBoundingClientRect().width || 900)));
    const mobile = width <= 480;
    plot = { left: mobile ? 58 : 82, right: width - (mobile ? 12 : 14), top: 56, bottom: 276 };
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("aria-valuemin", observations[0].year);
    svg.setAttribute("aria-valuemax", observations[observations.length - 1].year);
    svg.replaceChildren(element("desc", { id: "pib-chart-svg-description" },
      "Evolução anual do PIB municipal de Sumaré, de 1999 a 2023, a preços correntes. " +
      "Dados até 2001 seguem metodologia diferente. Use as setas para selecionar cada ano."));

    [0, 5, 10, 15, 20].forEach((tick) => {
      const y = yFor(tick * 1_000_000);
      svg.append(element("line", {
        x1: plot.left, y1: y, x2: plot.right, y2: y, class: "pib-chart__grid"
      }));
      svg.append(element("text", {
        x: plot.left - 10, y: y + 4, "text-anchor": "end",
        class: "pib-chart__axis-label pib-chart__axis-label--y"
      }, tick ? `R$ ${tick} bi` : "0"));
    });

    const start = observations[0].year;
    const end = observations[observations.length - 1].year;
    const step = mobile ? 8 : 4;
    for (let year = start; year <= end; year += step) {
      const index = observations.findIndex((item) => item.year === year);
      if (index < 0) continue;
      svg.append(element("line", {
        x1: xFor(index), y1: plot.bottom, x2: xFor(index), y2: plot.bottom + 4,
        class: "pib-chart__axis-tick"
      }));
      svg.append(element("text", {
        x: xFor(index), y: plot.bottom + 23, "text-anchor": "middle",
        class: "pib-chart__axis-label"
      }, String(year)));
    }

    svg.append(element("rect", {
      x: plot.left, y: plot.top, width: plot.right - plot.left,
      height: plot.bottom - plot.top, class: "pib-chart__interaction", "aria-hidden": "true"
    }));
    svg.append(element("polyline", {
      points: observations.map((item, index) => `${xFor(index)},${yFor(item.value)}`).join(" "),
      class: "pib-chart__series", "aria-hidden": "true"
    }));
    svg.append(element("circle", {
      r: 5, class: "pib-chart__marker", "data-pib-marker": "", "aria-hidden": "true"
    }));
    const tooltip = element("g", { "data-pib-tooltip": "", "aria-hidden": "true" });
    tooltip.append(
      element("rect", { class: "pib-chart__tooltip-box", rx: 6, ry: 6 }),
      element("text", { class: "pib-chart__tooltip", "text-anchor": "middle" })
    );
    svg.append(tooltip);
    svg.removeAttribute("hidden");
    status.hidden = true;
    select(selectedIndex);
  };

  svg.addEventListener("pointermove", (event) => {
    if (observations.length) select(nearestIndex(event));
  });
  svg.addEventListener("pointerdown", (event) => {
    if (!observations.length) return;
    svg.classList.add("is-pointer-focused");
    svg.setPointerCapture?.(event.pointerId);
    select(nearestIndex(event));
  });
  svg.addEventListener("blur", () => svg.classList.remove("is-pointer-focused"));
  svg.addEventListener("keydown", (event) => {
    if (!observations.length) return;
    svg.classList.remove("is-pointer-focused");
    let next = selectedIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next--;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next++;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = observations.length - 1;
    else return;
    event.preventDefault();
    select(next);
  });

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => render()).observe(section);
  } else {
    window.addEventListener("resize", render);
  }
  fetch(sourceUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Falha ao carregar a série");
      return response.json();
    })
    .then((data) => {
      observations = data.observations;
      if (!Array.isArray(observations) || observations.length < 2) {
        throw new Error("Série inválida");
      }
      selectedIndex = observations.length - 1;
      render();
    })
    .catch(() => {
      status.textContent = "Não foi possível carregar a série histórica. Consulte a fonte oficial do IBGE.";
      status.hidden = false;
    });
})();
