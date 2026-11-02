"use strict";

(() => {
  const section = document.querySelector("[data-pib-chart]");
  if (!section) return;

  const svg = section.querySelector("[data-pib-svg]");
  const readout = section.querySelector("[data-pib-value]");
  const status = section.querySelector("[data-pib-status]");
  const sourceUrl = "data/pib-municipal-historico.json?v=20261028-1999-2023";
  const ns = "http://www.w3.org/2000/svg";
  const width = 900;
  const height = 330;
  const plot = { left: 82, right: 886, top: 28, bottom: 276 };
  let observations = [];
  let selectedIndex = 0;

  const svgElement = (name, attributes = {}, content = "") => {
    const element = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (content) element.textContent = content;
    return element;
  };

  const toBillions = (valueInThousandReais) => valueInThousandReais / 1_000_000;
  const formatBillions = (valueInThousandReais) =>
    `R$ ${toBillions(valueInThousandReais).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} bi`;

  const xFor = (index) => plot.left + index * (plot.right - plot.left) / (observations.length - 1);
  const yFor = (value) => plot.bottom - toBillions(value) / 20 * (plot.bottom - plot.top);

  const setSelection = (index) => {
    selectedIndex = Math.max(0, Math.min(observations.length - 1, index));
    const observation = observations[selectedIndex];
    const label = `${observation.year} · ${formatBillions(observation.value)} · preços correntes`;
    readout.textContent = label;
    readout.hidden = false;
    svg.setAttribute("aria-valuenow", String(observation.year));
    svg.setAttribute("aria-valuetext", label);

    const marker = svg.querySelector("[data-pib-marker]");
    marker.setAttribute("cx", String(xFor(selectedIndex)));
    marker.setAttribute("cy", String(yFor(observation.value)));
    marker.removeAttribute("hidden");

    const tooltip = svg.querySelector("[data-pib-tooltip]");
    const pointX = xFor(selectedIndex);
    const pointY = yFor(observation.value);
    tooltip.textContent = `${observation.year} · ${formatBillions(observation.value)}`;
    // Keep the selected value centered above its point and within the SVG bounds.
    const estimatedHalfWidth = tooltip.textContent.length * 5;
    tooltip.setAttribute("x", String(Math.max(plot.left + estimatedHalfWidth, Math.min(plot.right - estimatedHalfWidth, pointX))));
    // Fixed row above the plot prevents any overlap with the series.\n    tooltip.setAttribute("y", "19");
    tooltip.removeAttribute("hidden");
  };

  const nearestIndex = (event) => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    const position = (local.x - plot.left) / (plot.right - plot.left) * (observations.length - 1);
    return Math.round(Math.max(0, Math.min(observations.length - 1, position)));
  };

  const render = (data) => {
    observations = data.observations;
    if (!Array.isArray(observations) || observations.length < 2) throw new Error("Série inválida");

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("aria-valuemin", String(observations[0].year));
    svg.setAttribute("aria-valuemax", String(observations[observations.length - 1].year));

    const title = svgElement("title", { id: "pib-chart-svg-title" }, "Evolução anual do PIB municipal de Sumaré");
    const description = svgElement(
      "desc",
      { id: "pib-chart-svg-description" },
      "Série anual a preços correntes, de 1999 a 2023. Há uma separação entre os dados anteriores e posteriores a 2002. Ao selecionar um ano, seu valor aparece junto ao ponto no gráfico. Use as setas esquerda e direita para percorrer os anos."
    );
    svg.append(title, description);

    [0, 5, 10, 15, 20].forEach((tick) => {
      const y = yFor(tick * 1_000_000);
      svg.append(svgElement("line", { x1: plot.left, y1: y, x2: plot.right, y2: y, class: "pib-chart__grid" }));
      const label = tick === 0 ? "0" : `R$ ${tick} bi`;
      svg.append(svgElement("text", { x: plot.left - 12, y: y + 4, class: "pib-chart__axis-label pib-chart__axis-label--y", "text-anchor": "end" }, label));
    });

    [0, 1, 2, 3, 8, 13, 18, observations.length - 1].forEach((index) => {
      const observation = observations[index];

      svg.append(svgElement("line", {
        x1: xFor(index), y1: plot.bottom, x2: xFor(index), y2: plot.bottom + 4,
        class: "pib-chart__axis-tick", "aria-hidden": "true"
      }));
      svg.append(svgElement("text", {
        x: xFor(index),
        y: plot.bottom + 24,
        class: `pib-chart__axis-label${index < 4 ? " pib-chart__axis-label--early" : ""}`,
        "text-anchor": "middle"
      }, String(observation.year)));
    });

    svg.append(svgElement("rect", {
      x: plot.left,
      y: plot.top,
      width: plot.right - plot.left,
      height: plot.bottom - plot.top,
      class: "pib-chart__interaction",
      "aria-hidden": "true"
    }));

    const points = observations.map((observation, index) => `${xFor(index)},${yFor(observation.value)}`).join(" ");
    svg.append(svgElement("polyline", { points, class: "pib-chart__series", "aria-hidden": "true" }));
    svg.append(svgElement("circle", { cx: xFor(0), cy: yFor(observations[0].value), r: 5, class: "pib-chart__marker", "data-pib-marker": "" }));
    svg.querySelector(".pib-chart__marker").setAttribute("hidden", "");
    svg.append(svgElement("text", { class: "pib-chart__tooltip", "data-pib-tooltip": "", "text-anchor": "middle", "aria-hidden": "true", hidden: "" }));
    svg.removeAttribute("hidden");
    status.hidden = true;
    setSelection(observations.length - 1);
  };

  svg.addEventListener("pointermove", (event) => {
    if (observations.length) setSelection(nearestIndex(event));
  });
  svg.addEventListener("pointerdown", (event) => {
    if (!observations.length) return;
    svg.classList.add("is-pointer-focused");
    svg.setPointerCapture?.(event.pointerId);
    setSelection(nearestIndex(event));
  });
  svg.addEventListener("blur", () => svg.classList.remove("is-pointer-focused"));
  svg.addEventListener("keydown", (event) => {
    if (!observations.length) return;
    svg.classList.remove("is-pointer-focused");
    let next = selectedIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = observations.length - 1;
    else return;
    event.preventDefault();
    setSelection(next);
  });

  fetch(sourceUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Falha ao carregar a série");
      return response.json();
    })
    .then(render)
    .catch(() => {
      status.textContent = "Não foi possível carregar a série histórica. Consulte a fonte oficial do IBGE.";
      status.hidden = false;
    });
})();
