"use strict";

const state = {
  clients: [],
  selectedClientId: null,
  reportData: null,
  adReportData: null,
  startDate: null,
  endDate: null,
  dateBounds: { min: null, max: null },
  selectedPlatform: "all",
  trendChart: null,
  mixChart: null
};

const dom = {
  clientSelect: document.querySelector("#client-select"),
  printButton: document.querySelector("#print-report"),
  appStatus: document.querySelector("#app-status"),
  startDate: document.querySelector("#start-date"),
  endDate: document.querySelector("#end-date"),
  presetButtons: [...document.querySelectorAll("[data-preset]")],
  platformFilter: document.querySelector("#platform-filter"),
  platformButtons: [...document.querySelectorAll("[data-platform]")],
  welcomePanel: document.querySelector("#welcome-panel"),
  report: document.querySelector("#report"),
  reportData: document.querySelector("#report-data"),
  noDataPanel: document.querySelector("#no-data-panel"),
  reportPeriod: document.querySelector("#report-period"),
  reportPlatforms: document.querySelector("#report-platforms"),
  reportFreshness: document.querySelector("#report-freshness"),
  printClientName: document.querySelector("#print-client-name"),
  printReportMeta: document.querySelector("#print-report-meta"),
  clientReportTitle: document.querySelector("#client-report-title"),
  reportRowCount: document.querySelector("#report-row-count"),
  kpiGrid: document.querySelector("#kpi-grid"),
  highlightsGrid: document.querySelector("#highlights-grid"),
  trendCanvas: document.querySelector("#trend-chart"),
  platformMixSection: document.querySelector("#platform-mix-section"),
  mixCanvas: document.querySelector("#mix-chart"),
  mixSummary: document.querySelector("#mix-summary"),
  illuminSection: document.querySelector("#illumin-section"),
  illuminSummary: document.querySelector("#illumin-summary"),
  illuminCampaignBody: document.querySelector("#illumin-campaign-body"),
  illuminVideo: document.querySelector("#illumin-video"),
  videoSteps: document.querySelector("#video-steps"),
  metaSection: document.querySelector("#meta-section"),
  metaSummary: document.querySelector("#meta-summary"),
  metaCampaignBody: document.querySelector("#meta-campaign-body")
};

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC"
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

function setStatus(message, type = "default") {
  dom.appStatus.textContent = message;
  dom.appStatus.dataset.type = type;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sumField(rows, field) {
  return rows.reduce((total, row) => total + toNumber(row[field]), 0);
}

function safeDivide(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function formatNumber(value) {
  return numberFormatter.format(toNumber(value));
}

function formatCompact(value) {
  return compactFormatter.format(toNumber(value));
}

function formatPercent(value, digits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(dateString, short = false) {
  if (!dateString) {
    return "—";
  }

  return (short ? shortDateFormatter : dateFormatter).format(parseDate(dateString));
}

function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return "—";
  }

  return `${formatDate(startDate, true)} – ${formatDate(endDate)}`;
}

function inclusiveDayCount(startDate, endDate) {
  const milliseconds = parseDate(endDate) - parseDate(startDate);
  return Math.floor(milliseconds / 86400000) + 1;
}

function isValidClient(client) {
  return (
    client &&
    typeof client.client_id === "string" &&
    /^PD-\d{5}$/.test(client.client_id) &&
    typeof client.client_name === "string" &&
    client.client_name.trim().length > 0
  );
}

function platformData(platform) {
  return state.reportData?.platforms?.[platform] ?? null;
}

function platformIsAvailable(platform) {
  const data = platformData(platform);
  return Boolean(data?.available && Array.isArray(data.campaign_daily));
}

function availablePlatforms() {
  return ["illumin", "meta"].filter(platformIsAvailable);
}

function activePlatforms() {
  const available = availablePlatforms();

  if (state.selectedPlatform === "all") {
    return available;
  }

  return available.includes(state.selectedPlatform)
    ? [state.selectedPlatform]
    : available;
}

function filteredRows(platform) {
  if (!activePlatforms().includes(platform)) {
    return [];
  }

  const rows = platformData(platform)?.campaign_daily ?? [];

  return rows.filter(
    (row) =>
      typeof row.date === "string" &&
      row.date >= state.startDate &&
      row.date <= state.endDate
  );
}

function setReportControlsEnabled(enabled) {
  dom.startDate.disabled = !enabled;
  dom.endDate.disabled = !enabled;

  for (const button of dom.presetButtons) {
    button.disabled = !enabled;
  }
}

function destroyCharts() {
  state.trendChart?.destroy();
  state.mixChart?.destroy();
  state.trendChart = null;
  state.mixChart = null;
}

function resetReport() {
  destroyCharts();
  state.reportData = null;
  state.adReportData = null;
  state.startDate = null;
  state.endDate = null;
  state.dateBounds = { min: null, max: null };
  state.selectedPlatform = "all";
  dom.report.hidden = true;
  dom.welcomePanel.hidden = false;
  dom.platformFilter.hidden = true;
  dom.printButton.disabled = true;
  setReportControlsEnabled(false);
  setStatus(`${state.clients.length} active clients available.`, "success");
}

function populateClientSelect(clients) {
  const options = [new Option("Select a client", "")];

  for (const client of clients) {
    options.push(new Option(client.client_name, client.client_id));
  }

  dom.clientSelect.replaceChildren(...options);
  dom.clientSelect.disabled = false;
}

async function loadClients() {
  if (!window.REPORT_CONFIG?.clientsApiUrl) {
    dom.clientSelect.replaceChildren(new Option("Clients unavailable", ""));
    setStatus("The client-list configuration is unavailable.", "error");
    return;
  }

  try {
    const response = await fetch(window.REPORT_CONFIG.clientsApiUrl, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Client request failed with status ${response.status}.`);
    }

    const data = await response.json();

    if (!Array.isArray(data.clients)) {
      throw new Error("The client response did not include a clients list.");
    }

    state.clients = data.clients.filter(isValidClient);

    if (state.clients.length === 0) {
      throw new Error("No active clients were returned.");
    }

    populateClientSelect(state.clients);
    setStatus(`${state.clients.length} active clients available.`, "success");
  } catch (error) {
    console.error("Unable to load the client list.", error);
    dom.clientSelect.replaceChildren(new Option("Clients unavailable", ""));
    setStatus(
      "The client list could not be loaded. Refresh the page to try again.",
      "error"
    );
  }
}

function validateReportPayload(data, requestedClientId) {
  return (
    data &&
    data.client?.client_id === requestedClientId &&
    typeof data.client?.client_name === "string" &&
    data.platforms &&
    typeof data.platforms === "object"
  );
}
function validateAdReportPayload(data, requestedClientId) {
  return (
    data &&
    data.client?.client_id === requestedClientId &&
    typeof data.client?.client_name === "string" &&
    data.platforms &&
    typeof data.platforms === "object"
  );
}
function initializeReportState() {
  const dates = [];

  for (const platform of availablePlatforms()) {
    for (const row of platformData(platform).campaign_daily) {
      if (typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        dates.push(row.date);
      }
    }
  }

  if (dates.length === 0) {
    throw new Error("The report did not include dated campaign rows.");
  }

  dates.sort();
  state.dateBounds = { min: dates[0], max: dates[dates.length - 1] };
  state.startDate = state.dateBounds.min;
  state.endDate = state.dateBounds.max;
  state.selectedPlatform = "all";

  dom.startDate.min = state.dateBounds.min;
  dom.startDate.max = state.dateBounds.max;
  dom.startDate.value = state.startDate;
  dom.endDate.min = state.dateBounds.min;
  dom.endDate.max = state.dateBounds.max;
  dom.endDate.value = state.endDate;

  updatePlatformControls();
  setReportControlsEnabled(true);
  setActivePreset("all");
}

async function loadReport(clientId) {
  if (!window.REPORT_CONFIG?.campaignApiUrl) {
    setStatus("The campaign-report configuration is unavailable.", "error");
    return;
  }

  const requestedClientId = clientId;

  dom.clientSelect.disabled = true;
  dom.report.setAttribute("aria-busy", "true");
  dom.report.hidden = true;
  dom.welcomePanel.hidden = false;
  dom.printButton.disabled = true;

  setReportControlsEnabled(false);
  setStatus("Loading reporting data…", "loading");

  try {
    // -----------------------------
    // Campaign report
    // -----------------------------
    const campaignUrl = new URL(window.REPORT_CONFIG.campaignApiUrl);
    campaignUrl.searchParams.set("client_id", requestedClientId);

    const campaignRequest = fetch(campaignUrl, {
      headers: { Accept: "application/json" }
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Campaign request failed with status ${response.status}.`
        );
      }

      return response.json();
    });

    // -----------------------------
    // Ad / creative report
    // -----------------------------
    let adRequest = Promise.resolve(null);

    if (window.REPORT_CONFIG?.adApiUrl) {
      const adUrl = new URL(window.REPORT_CONFIG.adApiUrl);
      adUrl.searchParams.set("client_id", requestedClientId);

      adRequest = fetch(adUrl, {
        headers: { Accept: "application/json" }
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Ad report request failed with status ${response.status}.`
            );
          }

          return response.json();
        })
        .catch((error) => {
          console.error("Unable to load the ad-level report.", error);

          // Do not break the normal campaign report
          // if ad-level data fails.
          return null;
        });
    }

    // Fetch both at the same time
    const [campaignData, adData] = await Promise.all([
      campaignRequest,
      adRequest
    ]);

    // -----------------------------
    // Validate campaign data
    // -----------------------------
    if (!validateReportPayload(campaignData, requestedClientId)) {
      throw new Error(
        "The campaign response did not match the selected client."
      );
    }

    // User may have changed clients while requests were loading
    if (state.selectedClientId !== requestedClientId) {
      return;
    }

    // -----------------------------
    // Store campaign data
    // -----------------------------
    state.reportData = campaignData;

    // -----------------------------
    // Store ad / creative data
    // -----------------------------
    if (
      adData &&
      validateAdReportPayload(adData, requestedClientId)
    ) {
      state.adReportData = adData;
    } else {
      state.adReportData = null;

      if (adData) {
        console.warn(
          "The ad-level response did not match the selected client."
        );
      }
    }

    // -----------------------------
    // Continue existing dashboard
    // -----------------------------
    initializeReportState();

    dom.welcomePanel.hidden = true;
    dom.report.hidden = false;

    renderReport();

    // Temporary testing
    console.log("Campaign report loaded:", state.reportData);
    console.log("Ad / creative report loaded:", state.adReportData);
  } catch (error) {
    console.error("Unable to load the campaign report.", error);

    destroyCharts();

    state.reportData = null;
    state.adReportData = null;

    dom.report.hidden = true;
    dom.welcomePanel.hidden = false;

    setStatus(
      "The campaign report could not be loaded. Choose the client again to retry.",
      "error"
    );
  } finally {
    dom.clientSelect.disabled = false;
    dom.report.setAttribute("aria-busy", "false");
  }
}

  const requestedClientId = clientId;
  dom.clientSelect.disabled = true;
  dom.report.setAttribute("aria-busy", "true");
  dom.report.hidden = true;
  dom.welcomePanel.hidden = false;
  dom.printButton.disabled = true;
  setReportControlsEnabled(false);
  setStatus("Loading campaign reporting data…", "loading");

  try {
    const reportUrl = new URL(window.REPORT_CONFIG.campaignApiUrl);
    reportUrl.searchParams.set("client_id", requestedClientId);

    const response = await fetch(reportUrl, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Campaign request failed with status ${response.status}.`);
    }

    const data = await response.json();

    if (!validateReportPayload(data, requestedClientId)) {
      throw new Error("The campaign response did not match the selected client.");
    }

    if (state.selectedClientId !== requestedClientId) {
      return;
    }

    state.reportData = data;
    initializeReportState();
    dom.welcomePanel.hidden = true;
    dom.report.hidden = false;
    renderReport();
  } catch (error) {
    console.error("Unable to load the campaign report.", error);
    destroyCharts();
    state.reportData = null;
    dom.report.hidden = true;
    dom.welcomePanel.hidden = false;
    setStatus(
      "The campaign report could not be loaded. Choose the client again to retry.",
      "error"
    );
  } finally {
    dom.clientSelect.disabled = false;
    dom.report.setAttribute("aria-busy", "false");
  }
}

function updatePlatformControls() {
  const available = availablePlatforms();
  dom.platformFilter.hidden = available.length < 2;

  for (const button of dom.platformButtons) {
    const platform = button.dataset.platform;
    button.hidden = platform !== "all" && !available.includes(platform);
    button.classList.toggle("is-active", platform === state.selectedPlatform);
  }
}

function setActivePreset(preset) {
  for (const button of dom.presetButtons) {
    button.classList.toggle("is-active", button.dataset.preset === preset);
  }
}

function applyPreset(preset) {
  if (!state.reportData) {
    return;
  }

  const maximumDate = parseDate(state.dateBounds.max);
  let startDate = state.dateBounds.min;

  if (preset === "30" || preset === "90") {
    const dayCount = Number(preset);
    const calculatedStart = new Date(maximumDate);
    calculatedStart.setUTCDate(calculatedStart.getUTCDate() - (dayCount - 1));
    startDate = toIsoDate(calculatedStart);

    if (startDate < state.dateBounds.min) {
      startDate = state.dateBounds.min;
    }
  }

  if (preset === "ytd") {
    startDate = `${state.dateBounds.max.slice(0, 4)}-01-01`;

    if (startDate < state.dateBounds.min) {
      startDate = state.dateBounds.min;
    }
  }

  state.startDate = startDate;
  state.endDate = state.dateBounds.max;
  dom.startDate.value = state.startDate;
  dom.endDate.value = state.endDate;
  setActivePreset(preset);
  renderReport();
}

function applyCustomDates() {
  const startDate = dom.startDate.value;
  const endDate = dom.endDate.value;

  if (!startDate || !endDate || startDate > endDate) {
    setStatus("Choose a valid start date that is on or before the end date.", "error");
    return;
  }

  state.startDate = startDate;
  state.endDate = endDate;
  setActivePreset(null);
  renderReport();
}

function renderPlatformBadges() {
  dom.reportPlatforms.replaceChildren();

  for (const platform of availablePlatforms()) {
    const badge = document.createElement("span");
    badge.className = `platform-badge platform-badge--${platform}`;
    badge.textContent = platform === "illumin" ? "Illumin" : "Meta";

    if (!activePlatforms().includes(platform)) {
      badge.classList.add("is-muted");
    }

    dom.reportPlatforms.append(badge);
  }
}

function renderFreshness() {
  const freshness = state.reportData.freshness ?? {};

  if (state.selectedPlatform === "illumin") {
    dom.reportFreshness.textContent = `Illumin updated ${formatDate(
      freshness.illumin_latest_date
    )}`;
    return;
  }

  if (state.selectedPlatform === "meta") {
    dom.reportFreshness.textContent = `Meta updated ${formatDate(
      freshness.meta_latest_date
    )}`;
    return;
  }

  const freshnessParts = [];

  if (platformIsAvailable("illumin")) {
    freshnessParts.push(`Illumin ${formatDate(freshness.illumin_latest_date)}`);
  }

  if (platformIsAvailable("meta")) {
    freshnessParts.push(`Meta ${formatDate(freshness.meta_latest_date)}`);
  }

  dom.reportFreshness.textContent = `Updated · ${freshnessParts.join(" · ")}`;
}

function createKpiCard(platform, label, value, detail, exactValue) {
  const card = document.createElement("article");
  card.className = `kpi-card kpi-card--${platform}`;

  const labelElement = document.createElement("p");
  labelElement.className = "kpi-card__label";
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.className = "kpi-card__value";
  valueElement.textContent = value;

  if (exactValue !== undefined) {
    valueElement.title = formatNumber(exactValue);
  }

  const detailElement = document.createElement("p");
  detailElement.className = "kpi-card__detail";
  detailElement.textContent = detail;

  card.append(labelElement, valueElement, detailElement);
  return card;
}

function renderKpis() {
  const cards = [];

  if (activePlatforms().includes("illumin")) {
    const rows = filteredRows("illumin");
    const impressions = sumField(rows, "impressions");
    const clicks = sumField(rows, "clicks");
    const conversions = sumField(rows, "conversions");
    const primary = sumField(rows, "primary_conv");
    const secondary = sumField(rows, "secondary_conv");
    const tertiary = sumField(rows, "tertiary_conv");

    cards.push(
      createKpiCard(
        "illumin",
        "Illumin impressions",
        formatCompact(impressions),
        `${formatNumber(rows.length)} daily campaign rows`,
        impressions
      ),
      createKpiCard(
        "illumin",
        "Illumin clicks",
        formatCompact(clicks),
        `CTR ${formatPercent(safeDivide(clicks, impressions), 3)}`,
        clicks
      ),
      createKpiCard(
        "illumin",
        "Illumin conversions",
        formatCompact(conversions),
        `${formatNumber(primary)} primary · ${formatNumber(secondary)} secondary · ${formatNumber(tertiary)} tertiary`,
        conversions
      )
    );
  }

  if (activePlatforms().includes("meta")) {
    const rows = filteredRows("meta");
    const impressions = sumField(rows, "impressions");
    const clicks = sumField(rows, "clicks");
    const websiteClicks = sumField(rows, "inline_link_clicks");

    cards.push(
      createKpiCard(
        "meta",
        "Meta impressions",
        formatCompact(impressions),
        `${formatNumber(rows.length)} daily campaign rows`,
        impressions
      ),
      createKpiCard(
        "meta",
        "Meta clicks",
        formatCompact(clicks),
        "All reported clicks",
        clicks
      ),
      createKpiCard(
        "meta",
        "Meta website clicks",
        formatCompact(websiteClicks),
        `Website Clicks CTR ${formatPercent(
          safeDivide(websiteClicks, impressions),
          2
        )}`,
        websiteClicks
      )
    );
  }

  dom.kpiGrid.replaceChildren(...cards);
}

function createHighlightCard(platform, number, title, detail) {
  const card = document.createElement("article");
  card.className = `highlight-card highlight-card--${platform}`;

  const numberElement = document.createElement("span");
  numberElement.className = "highlight-card__number";
  numberElement.textContent = number;

  const titleElement = document.createElement("strong");
  titleElement.textContent = title;

  const detailElement = document.createElement("span");
  detailElement.textContent = detail;

  card.append(numberElement, titleElement, detailElement);
  return card;
}

function renderHighlights() {
  const cards = [];

  if (activePlatforms().includes("illumin")) {
    const rows = filteredRows("illumin");
    const campaigns = aggregateCampaigns(rows, "illumin");
    const topCampaign = campaigns[0];
    const totalImpressions = sumField(rows, "impressions");

    if (topCampaign) {
      cards.push(
        createHighlightCard(
          "illumin",
          cards.length + 1,
          `${topCampaign.name} led Illumin delivery`,
          `${formatNumber(topCampaign.impressions)} impressions · ${formatPercent(
            safeDivide(topCampaign.impressions, totalImpressions),
            1
          )} of Illumin impressions`
        )
      );
    }
  }

  if (activePlatforms().includes("meta")) {
    const rows = filteredRows("meta");
    const campaigns = aggregateCampaigns(rows, "meta");
    const topCampaign = campaigns[0];
    const totalImpressions = sumField(rows, "impressions");

    if (topCampaign) {
      cards.push(
        createHighlightCard(
          "meta",
          cards.length + 1,
          `${topCampaign.name} led Meta delivery`,
          `${formatNumber(topCampaign.impressions)} impressions · ${formatPercent(
            safeDivide(topCampaign.impressions, totalImpressions),
            1
          )} of Meta impressions`
        )
      );
    }
  }

  if (
    state.selectedPlatform === "all" &&
    activePlatforms().includes("illumin") &&
    activePlatforms().includes("meta")
  ) {
    const illuminImpressions = sumField(filteredRows("illumin"), "impressions");
    const metaImpressions = sumField(filteredRows("meta"), "impressions");
    const combinedImpressions = illuminImpressions + metaImpressions;
    const leadingPlatform =
      illuminImpressions >= metaImpressions
        ? { name: "Illumin", value: illuminImpressions }
        : { name: "Meta", value: metaImpressions };

    if (combinedImpressions > 0) {
      cards.push(
        createHighlightCard(
          "all",
          cards.length + 1,
          `${leadingPlatform.name} delivered the larger impression share`,
          `${formatPercent(
            safeDivide(leadingPlatform.value, combinedImpressions),
            1
          )} of impressions across the two available platforms`
        )
      );
    }
  }

  dom.highlightsGrid.replaceChildren(...cards);
}

function dailyTotals(rows, fields) {
  const totals = new Map();

  for (const row of rows) {
    if (!totals.has(row.date)) {
      totals.set(
        row.date,
        Object.fromEntries(fields.map((field) => [field, 0]))
      );
    }

    const day = totals.get(row.date);

    for (const field of fields) {
      day[field] += toNumber(row[field]);
    }
  }

  return totals;
}

function renderTrendChart() {
  state.trendChart?.destroy();
  state.trendChart = null;

  if (typeof window.Chart !== "function") {
    setStatus("The chart library did not load. Tables remain available below.", "error");
    return;
  }

  const datasets = [];
  const allDates = new Set();
  const dailyByPlatform = {};

  if (activePlatforms().includes("meta")) {
    dailyByPlatform.meta = dailyTotals(filteredRows("meta"), [
      "impressions",
      "inline_link_clicks"
    ]);
    dailyByPlatform.meta.forEach((value, date) => allDates.add(date));
  }

  if (activePlatforms().includes("illumin")) {
    dailyByPlatform.illumin = dailyTotals(filteredRows("illumin"), [
      "impressions",
      "clicks"
    ]);
    dailyByPlatform.illumin.forEach((value, date) => allDates.add(date));
  }

  const labels = [...allDates].sort();

  if (dailyByPlatform.meta) {
    datasets.push(
      {
        label: "Meta impressions",
        data: labels.map((date) => dailyByPlatform.meta.get(date)?.impressions ?? 0),
        borderColor: "#1683ba",
        backgroundColor: "rgba(22, 131, 186, 0.12)",
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "y"
      },
      {
        label: "Meta website clicks",
        data: labels.map(
          (date) => dailyByPlatform.meta.get(date)?.inline_link_clicks ?? 0
        ),
        borderColor: "#14658d",
        borderDash: [5, 4],
        borderWidth: 1.8,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "yClicks"
      }
    );
  }

  if (dailyByPlatform.illumin) {
    datasets.push(
      {
        label: "Illumin impressions",
        data: labels.map(
          (date) => dailyByPlatform.illumin.get(date)?.impressions ?? 0
        ),
        borderColor: "#e4932e",
        backgroundColor: "rgba(228, 147, 46, 0.12)",
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "y"
      },
      {
        label: "Illumin clicks",
        data: labels.map((date) => dailyByPlatform.illumin.get(date)?.clicks ?? 0),
        borderColor: "#9a611c",
        borderDash: [5, 4],
        borderWidth: 1.8,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "yClicks"
      }
    );
  }

  state.trendChart = new window.Chart(dom.trendCanvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "start",
          labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 }
        },
        tooltip: {
          callbacks: {
            title(items) {
              return items.length ? formatDate(items[0].label) : "";
            },
            label(context) {
              return `${context.dataset.label}: ${formatNumber(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 9,
            callback(value) {
              return formatDate(labels[value], true);
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          ticks: { callback: (value) => formatCompact(value) }
        },
        yClicks: {
          beginAtZero: true,
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { callback: (value) => formatCompact(value) }
        }
      }
    }
  });
}

function createMixRow(label, value, share, platform) {
  const row = document.createElement("div");
  row.className = "mix-row";

  const header = document.createElement("div");
  header.className = "mix-row__header";

  const name = document.createElement("span");
  name.className = "mix-row__name";
  name.textContent = label;

  const amount = document.createElement("strong");
  amount.textContent = `${formatNumber(value)} · ${formatPercent(share, 1)}`;

  const track = document.createElement("div");
  track.className = "mix-row__track";

  const fill = document.createElement("span");
  fill.className = `mix-row__fill mix-row__fill--${platform}`;
  fill.style.width = `${share * 100}%`;

  header.append(name, amount);
  track.append(fill);
  row.append(header, track);
  return row;
}

function renderPlatformMix() {
  state.mixChart?.destroy();
  state.mixChart = null;

  const illuminImpressions = sumField(filteredRows("illumin"), "impressions");
  const metaImpressions = sumField(filteredRows("meta"), "impressions");
  const total = illuminImpressions + metaImpressions;
  const showMix =
    state.selectedPlatform === "all" &&
    platformIsAvailable("illumin") &&
    platformIsAvailable("meta") &&
    illuminImpressions > 0 &&
    metaImpressions > 0;

  dom.platformMixSection.hidden = !showMix;

  if (!showMix || typeof window.Chart !== "function") {
    return;
  }

  state.mixChart = new window.Chart(dom.mixCanvas, {
    type: "doughnut",
    data: {
      labels: ["Meta", "Illumin"],
      datasets: [
        {
          data: [metaImpressions, illuminImpressions],
          backgroundColor: ["#1683ba", "#e4932e"],
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverOffset: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${formatNumber(context.raw)} impressions`;
            }
          }
        }
      }
    }
  });

  dom.mixSummary.replaceChildren(
    createMixRow("Meta", metaImpressions, metaImpressions / total, "meta"),
    createMixRow(
      "Illumin",
      illuminImpressions,
      illuminImpressions / total,
      "illumin"
    )
  );
}

function aggregateCampaigns(rows, platform) {
  const campaigns = new Map();

  for (const row of rows) {
    const id = String(row.campaign_id ?? "");
    const name = String(row.campaign_name ?? "").trim();
    const key = id || name || "unlabeled";

    if (!campaigns.has(key)) {
      campaigns.set(key, {
        id,
        name: name || id || "Unlabeled campaign",
        impressions: 0,
        clicks: 0,
        conversions: 0,
        primary_conv: 0,
        secondary_conv: 0,
        tertiary_conv: 0,
        inline_link_clicks: 0,
        video_start: 0,
        video_first_quartile: 0,
        video_midpoint: 0,
        video_third_quartile: 0,
        video_complete: 0
      });
    }

    const campaign = campaigns.get(key);
    campaign.impressions += toNumber(row.impressions);
    campaign.clicks += toNumber(row.clicks);

    if (platform === "illumin") {
      for (const field of [
        "conversions",
        "primary_conv",
        "secondary_conv",
        "tertiary_conv",
        "video_start",
        "video_first_quartile",
        "video_midpoint",
        "video_third_quartile",
        "video_complete"
      ]) {
        campaign[field] += toNumber(row[field]);
      }
    }

    if (platform === "meta") {
      campaign.inline_link_clicks += toNumber(row.inline_link_clicks);
    }
  }

  return [...campaigns.values()].sort(
    (first, second) => second.impressions - first.impressions
  );
}

function appendCampaignNameCell(row, campaign) {
  const cell = document.createElement("td");
  const name = document.createElement("strong");
  name.className = "campaign-name";
  name.textContent = campaign.name;
  cell.append(name);

  if (campaign.id) {
    const id = document.createElement("span");
    id.className = "campaign-id";
    id.textContent = campaign.id;
    cell.append(id);
  }

  row.append(cell);
}

function appendValueCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
}

function renderIlluminSection() {
  const rows = filteredRows("illumin");
  const showSection = activePlatforms().includes("illumin") && rows.length > 0;
  dom.illuminSection.hidden = !showSection;

  if (!showSection) {
    dom.illuminVideo.hidden = true;
    return;
  }

  const campaigns = aggregateCampaigns(rows, "illumin");
  const impressions = sumField(rows, "impressions");
  const clicks = sumField(rows, "clicks");
  const conversions = sumField(rows, "conversions");
  dom.illuminSummary.textContent = `${formatNumber(
    campaigns.length
  )} campaigns · ${formatNumber(impressions)} impressions · ${formatNumber(
    conversions
  )} Illumin conversions`;

  const tableRows = campaigns.map((campaign) => {
    const row = document.createElement("tr");
    appendCampaignNameCell(row, campaign);
    appendValueCell(row, formatNumber(campaign.impressions));
    appendValueCell(row, formatNumber(campaign.clicks));
    appendValueCell(
      row,
      formatPercent(safeDivide(campaign.clicks, campaign.impressions), 3)
    );
    appendValueCell(row, formatNumber(campaign.conversions));
    appendValueCell(row, formatNumber(campaign.primary_conv));
    appendValueCell(row, formatNumber(campaign.secondary_conv));
    appendValueCell(row, formatNumber(campaign.tertiary_conv));
    return row;
  });

  dom.illuminCampaignBody.replaceChildren(...tableRows);

  const videoStarts = sumField(rows, "video_start");
  dom.illuminVideo.hidden = videoStarts === 0;

  if (videoStarts > 0) {
    const videoMetrics = [
      ["Starts", "video_start"],
      ["25% viewed", "video_first_quartile"],
      ["50% viewed", "video_midpoint"],
      ["75% viewed", "video_third_quartile"],
      ["Completed", "video_complete"]
    ];

    const steps = videoMetrics.map(([label, field], index) => {
      const value = sumField(rows, field);
      const step = document.createElement("article");
      step.className = "video-step";

      const labelElement = document.createElement("span");
      labelElement.textContent = label;

      const valueElement = document.createElement("strong");
      valueElement.textContent = formatNumber(value);

      const rateElement = document.createElement("small");
      rateElement.textContent =
        index === 0 ? "100.0%" : formatPercent(safeDivide(value, videoStarts), 1);

      step.append(labelElement, valueElement, rateElement);
      return step;
    });

    dom.videoSteps.replaceChildren(...steps);
  }

  if (clicks === 0 && impressions > 0) {
    dom.illuminSummary.textContent += " · no clicks in range";
  }
}

function renderMetaSection() {
  const rows = filteredRows("meta");
  const showSection = activePlatforms().includes("meta") && rows.length > 0;
  dom.metaSection.hidden = !showSection;

  if (!showSection) {
    return;
  }

  const campaigns = aggregateCampaigns(rows, "meta");
  const impressions = sumField(rows, "impressions");
  const websiteClicks = sumField(rows, "inline_link_clicks");
  dom.metaSummary.textContent = `${formatNumber(
    campaigns.length
  )} campaigns · ${formatNumber(impressions)} impressions · ${formatNumber(
    websiteClicks
  )} website clicks`;

  const tableRows = campaigns.map((campaign) => {
    const row = document.createElement("tr");
    appendCampaignNameCell(row, campaign);
    appendValueCell(row, formatNumber(campaign.impressions));
    appendValueCell(row, formatNumber(campaign.clicks));
    appendValueCell(row, formatNumber(campaign.inline_link_clicks));
    appendValueCell(
      row,
      formatPercent(
        safeDivide(campaign.inline_link_clicks, campaign.impressions),
        2
      )
    );
    return row;
  });

  dom.metaCampaignBody.replaceChildren(...tableRows);
}

function updatePrintHeader() {
  if (!state.reportData) {
    return;
  }

  const platformLabel = activePlatforms()
    .map((platform) => (platform === "illumin" ? "Illumin" : "Meta"))
    .join(" + ");
  const generatedAt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());

  dom.printClientName.textContent = `${state.reportData.client.client_name} · Performance report`;
  dom.printReportMeta.textContent = `${formatDateRange(
    state.startDate,
    state.endDate
  )} · ${platformLabel || "No platform data"} · Generated ${generatedAt}`;
}

function printReport() {
  if (!state.reportData || dom.reportData.hidden) {
    return;
  }

  updatePrintHeader();
  state.trendChart?.resize();
  state.mixChart?.resize();
  window.print();
}

function renderReport() {
  if (!state.reportData) {
    return;
  }

  const platforms = activePlatforms();
  const rowCount = platforms.reduce(
    (total, platform) => total + filteredRows(platform).length,
    0
  );
  const dayCount = inclusiveDayCount(state.startDate, state.endDate);

  dom.report.hidden = false;
  dom.clientReportTitle.textContent = state.reportData.client.client_name;
  dom.reportPeriod.textContent = `${formatDateRange(
    state.startDate,
    state.endDate
  )} · ${formatNumber(dayCount)} days`;
  dom.reportRowCount.textContent = `${formatNumber(rowCount)} daily campaign rows`;
  renderPlatformBadges();
  renderFreshness();
  updatePrintHeader();

  const hasRows = rowCount > 0;
  dom.noDataPanel.hidden = hasRows;
  dom.reportData.hidden = !hasRows;
  dom.printButton.disabled = !hasRows;

  if (!hasRows) {
    destroyCharts();
    setStatus("No reporting rows match the selected filters.", "default");
    return;
  }

  renderKpis();
  renderHighlights();
  renderTrendChart();
  renderPlatformMix();
  renderIlluminSection();
  renderMetaSection();

  setStatus(
    `${state.reportData.client.client_name} · ${formatDateRange(
      state.startDate,
      state.endDate
    )}`,
    "success"
  );
}

dom.clientSelect.addEventListener("change", (event) => {
  state.selectedClientId = event.target.value || null;

  if (!state.selectedClientId) {
    resetReport();
    return;
  }

  loadReport(state.selectedClientId);
});

dom.startDate.addEventListener("change", applyCustomDates);
dom.endDate.addEventListener("change", applyCustomDates);

for (const button of dom.presetButtons) {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
}

for (const button of dom.platformButtons) {
  button.addEventListener("click", () => {
    state.selectedPlatform = button.dataset.platform;
    updatePlatformControls();
    renderReport();
  });
}

dom.printButton.addEventListener("click", printReport);

window.addEventListener("beforeprint", () => {
  updatePrintHeader();
  state.trendChart?.resize();
  state.mixChart?.resize();
});
window.addEventListener("afterprint", () => {
  state.trendChart?.resize();
  state.mixChart?.resize();
});

loadClients();
