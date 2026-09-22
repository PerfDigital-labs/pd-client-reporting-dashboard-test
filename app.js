"use strict";

const state = {
  clients: [],
  selectedClientId: null,
  reportData: null,
  adReportData: null,
  audienceReportData: null,
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
  loadingPanel: document.querySelector("#loading-panel"),
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
  metaCampaignBody: document.querySelector("#meta-campaign-body"),

  metaAdSection: document.querySelector("#meta-ad-section"),
  metaAdSummary: document.querySelector("#meta-ad-summary"),
  metaAdBody: document.querySelector("#meta-ad-body"),

  illuminCreativeSection: document.querySelector("#illumin-creative-section"),
  illuminCreativeSummary: document.querySelector("#illumin-creative-summary"),
  illuminTacticGroups: document.querySelector("#illumin-tactic-groups"),

  illuminAudienceSection: document.querySelector("#illumin-audience-section"),
  illuminAgeBreakdown: document.querySelector("#illumin-age-breakdown"),
  illuminGenderBreakdown: document.querySelector("#illumin-gender-breakdown"),

  metaAudienceSection: document.querySelector("#meta-audience-section"),
  metaAgeBreakdown: document.querySelector("#meta-age-breakdown"),
  metaGenderBreakdown: document.querySelector("#meta-gender-breakdown"),
  metaAudienceScopeNote: document.querySelector("#meta-audience-scope-note")
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
function showReportLoading() {
  dom.welcomePanel.hidden = true;
  dom.loadingPanel.hidden = false;
  dom.report.hidden = true;
}

function hideReportLoading() {
  dom.loadingPanel.hidden = true;
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

  return (short ? shortDateFormatter : dateFormatter).format(
    parseDate(dateString)
  );
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

  return Boolean(
    data?.available &&
      Array.isArray(data.campaign_daily)
  );
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
function filteredMetaAdRows() {
  const rows =
    state.adReportData?.platforms?.meta?.ad_daily ?? [];

  return rows.filter(
    (row) =>
      typeof row.date === "string" &&
      row.date >= state.startDate &&
      row.date <= state.endDate
  );
}

function filteredIlluminCreativeRows() {
  const rows =
    state.adReportData?.platforms?.illumin?.creative_daily ?? [];

  return rows.filter(
    (row) =>
      typeof row.date === "string" &&
      row.date >= state.startDate &&
      row.date <= state.endDate
  );
}
function filteredAudienceRows(
  platform,
  breakdown
) {
  const rows =
    state.audienceReportData
      ?.platforms
      ?.[platform]
      ?.[breakdown] ?? [];

  return rows.filter(
    (row) =>
      typeof row.report_date === "string" &&
      row.report_date >= state.startDate &&
      row.report_date <= state.endDate
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
  state.audienceReportData = null;
  state.startDate = null;
  state.endDate = null;
  state.dateBounds = { min: null, max: null };
  state.selectedPlatform = "all";

  dom.report.hidden = true;
  dom.loadingPanel.hidden = true;
  dom.welcomePanel.hidden = false;
  dom.platformFilter.hidden = true;
  dom.printButton.disabled = true;

  setReportControlsEnabled(false);

  setStatus(
    `${state.clients.length} active clients available.`,
    "success"
  );
}

function populateClientSelect(clients) {
  const options = [
    new Option("Select a client", "")
  ];

  for (const client of clients) {
    options.push(
      new Option(
        client.client_name,
        client.client_id
      )
    );
  }

  dom.clientSelect.replaceChildren(...options);
  dom.clientSelect.disabled = false;
}

async function loadClients() {
  if (!window.REPORT_CONFIG?.clientsApiUrl) {
    dom.clientSelect.replaceChildren(
      new Option("Clients unavailable", "")
    );

    setStatus(
      "The client-list configuration is unavailable.",
      "error"
    );

    return;
  }

  try {
    const response = await fetch(
      window.REPORT_CONFIG.clientsApiUrl,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Client request failed with status ${response.status}.`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data.clients)) {
      throw new Error(
        "The client response did not include a clients list."
      );
    }

    state.clients = data.clients.filter(isValidClient);

    if (state.clients.length === 0) {
      throw new Error(
        "No active clients were returned."
      );
    }

    populateClientSelect(state.clients);

    setStatus(
      `${state.clients.length} active clients available.`,
      "success"
    );
  } catch (error) {
    console.error(
      "Unable to load the client list.",
      error
    );

    dom.clientSelect.replaceChildren(
      new Option("Clients unavailable", "")
    );

    setStatus(
      "The client list could not be loaded. Refresh the page to try again.",
      "error"
    );
  }
}

function validateReportPayload(
  data,
  requestedClientId
) {
  return (
    data &&
    data.client?.client_id === requestedClientId &&
    typeof data.client?.client_name === "string" &&
    data.platforms &&
    typeof data.platforms === "object"
  );
}

function validateAdReportPayload(
  data,
  requestedClientId
) {
  return (
    data &&
    data.client?.client_id === requestedClientId &&
    typeof data.client?.client_name === "string" &&
    data.platforms &&
    typeof data.platforms === "object"
  );
}
function validateAudienceReportPayload(
  data,
  requestedClientId
) {
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
    for (
      const row of
      platformData(platform).campaign_daily
    ) {
      if (
        typeof row.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.date)
      ) {
        dates.push(row.date);
      }
    }
  }

  if (dates.length === 0) {
    throw new Error(
      "The report did not include dated campaign rows."
    );
  }

  dates.sort();

  state.dateBounds = {
    min: dates[0],
    max: dates[dates.length - 1]
  };

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
    setStatus(
      "The campaign-report configuration is unavailable.",
      "error"
    );

    return;
  }

  const requestedClientId = clientId;

  dom.clientSelect.disabled = true;

  dom.report.setAttribute(
  "aria-busy",
  "true"
);

showReportLoading();

dom.printButton.disabled = true;
  setReportControlsEnabled(false);

  setStatus(
    "Loading reporting data…",
    "loading"
  );

  try {
    // Campaign report
    const campaignUrl = new URL(
      window.REPORT_CONFIG.campaignApiUrl
    );

    campaignUrl.searchParams.set(
      "client_id",
      requestedClientId
    );

    const campaignRequest = fetch(
      campaignUrl,
      {
        headers: {
          Accept: "application/json"
        }
      }
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Campaign request failed with status ${response.status}.`
        );
      }

      return response.json();
    });

    // Ad / creative report
    let adRequest = Promise.resolve(null);

    if (window.REPORT_CONFIG?.adApiUrl) {
      const adUrl = new URL(
        window.REPORT_CONFIG.adApiUrl
      );

      adUrl.searchParams.set(
        "client_id",
        requestedClientId
      );

      adRequest = fetch(
        adUrl,
        {
          headers: {
            Accept: "application/json"
          }
        }
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Ad report request failed with status ${response.status}.`
            );
          }

          return response.json();
        })
        .catch((error) => {
          console.error(
            "Unable to load the ad-level report.",
            error
          );

          // Ad data is supplemental.
          // Keep the campaign dashboard working
          // even if this request fails.
          return null;
        });
    }
    // Audience report
    let audienceRequest = Promise.resolve(null);

    if (window.REPORT_CONFIG?.audienceApiUrl) {
      const audienceUrl = new URL(
        window.REPORT_CONFIG.audienceApiUrl
      );

      audienceUrl.searchParams.set(
        "client_id",
        requestedClientId
      );

      audienceRequest = fetch(
        audienceUrl,
        {
          headers: {
            Accept: "application/json"
          }
        }
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Audience report request failed with status ${response.status}.`
            );
          }

          return response.json();
        })
        .catch((error) => {
          console.error(
            "Unable to load the audience report.",
            error
          );

          return null;
        });
  }

    const [
      campaignData,
      adData,
      audienceData
    ] = await Promise.all([
      campaignRequest,
      adRequest,
      audienceRequest
    ]);
    if (
      !validateReportPayload(
        campaignData,
        requestedClientId
      )
    ) {
      throw new Error(
        "The campaign response did not match the selected client."
      );
    }

    // Ignore a stale request if the user
    // selected another client while loading.
    if (
      state.selectedClientId !==
      requestedClientId
    ) {
      return;
    }

    state.reportData = campaignData;

    if (
      adData &&
      validateAdReportPayload(
        adData,
        requestedClientId
      )
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
    if (
      audienceData &&
      validateAudienceReportPayload(
        audienceData,
        requestedClientId
      )
    ) {
      state.audienceReportData = audienceData;
    } else {
      state.audienceReportData = null;

      if (audienceData) {
        console.warn(
          "The audience response did not match the selected client."
        );
      }
    }
    initializeReportState();

hideReportLoading();

dom.welcomePanel.hidden = true;
dom.report.hidden = false;

renderReport();

    // Temporary testing.
    // We can remove these after confirming
    // the ad endpoint is connected correctly.
    console.log(
      "Campaign report loaded:",
      state.reportData
    );

    console.log(
      "Ad / creative report loaded:",
      state.adReportData
    );

    console.log(
      "Audience report loaded:",
      state.audienceReportData
    );
  } catch (error) {
    console.error(
      "Unable to load the campaign report.",
      error
    );

    destroyCharts();

    state.reportData = null;
    state.adReportData = null;
    state.audienceReportData = null;

   hideReportLoading();

  dom.report.hidden = true;
  dom.welcomePanel.hidden = false;

    setStatus(
      "The campaign report could not be loaded. Choose the client again to retry.",
      "error"
    );
  } finally {
    dom.clientSelect.disabled = false;

    dom.report.setAttribute(
      "aria-busy",
      "false"
    );
  }
}

function updatePlatformControls() {
  const available = availablePlatforms();

  dom.platformFilter.hidden =
    available.length < 2;

  for (
    const button of
    dom.platformButtons
  ) {
    const platform =
      button.dataset.platform;

    button.hidden =
      platform !== "all" &&
      !available.includes(platform);

    button.classList.toggle(
      "is-active",
      platform === state.selectedPlatform
    );
  }
}

function setActivePreset(preset) {
  for (
    const button of
    dom.presetButtons
  ) {
    button.classList.toggle(
      "is-active",
      button.dataset.preset === preset
    );
  }
}

function applyPreset(preset) {
  if (!state.reportData) {
    return;
  }

  const maximumDate =
    parseDate(state.dateBounds.max);

  let startDate =
    state.dateBounds.min;

  if (
    preset === "7" ||
    preset === "30" ||
    preset === "90"
  ) {
    const dayCount =
      Number(preset);

    const calculatedStart =
      new Date(maximumDate);

    calculatedStart.setUTCDate(
      calculatedStart.getUTCDate() -
        (dayCount - 1)
    );

    startDate =
      toIsoDate(calculatedStart);

    if (
      startDate <
      state.dateBounds.min
    ) {
      startDate =
        state.dateBounds.min;
    }
  }

  if (preset === "month") {
    const monthStart =
      new Date(
        Date.UTC(
          maximumDate.getUTCFullYear(),
          maximumDate.getUTCMonth(),
          1
        )
      );

    startDate =
      toIsoDate(monthStart);

    if (
      startDate <
      state.dateBounds.min
    ) {
      startDate =
        state.dateBounds.min;
    }
  }

  if (preset === "ytd") {
    startDate =
      `${state.dateBounds.max.slice(
        0,
        4
      )}-01-01`;

    if (
      startDate <
      state.dateBounds.min
    ) {
      startDate =
        state.dateBounds.min;
    }
  }

  state.startDate = startDate;
  state.endDate =
    state.dateBounds.max;

  dom.startDate.value =
    state.startDate;

  dom.endDate.value =
    state.endDate;

  setActivePreset(preset);
  renderReport();
}

function applyCustomDates() {
  const startDate =
    dom.startDate.value;

  const endDate =
    dom.endDate.value;

  if (
    !startDate ||
    !endDate ||
    startDate > endDate
  ) {
    setStatus(
      "Choose a valid start date that is on or before the end date.",
      "error"
    );

    return;
  }

  state.startDate = startDate;
  state.endDate = endDate;

  setActivePreset(null);
  renderReport();
}

function renderPlatformBadges() {
  dom.reportPlatforms.replaceChildren();

  for (
    const platform of
    availablePlatforms()
  ) {
    const badge =
      document.createElement("span");

    badge.className =
      `platform-badge platform-badge--${platform}`;

    badge.textContent =
      platform === "illumin"
        ? "Programmatic"
        : "Meta";

    if (
      !activePlatforms().includes(
        platform
      )
    ) {
      badge.classList.add(
        "is-muted"
      );
    }

    dom.reportPlatforms.append(
      badge
    );
  }
}

function renderFreshness() {
  const freshness =
    state.reportData.freshness ?? {};

  if (
    state.selectedPlatform ===
    "illumin"
  ) {
    dom.reportFreshness.textContent =
      `Programmatic updated ${formatDate(
        freshness.illumin_latest_date
      )}`;

    return;
  }

  if (
    state.selectedPlatform ===
    "meta"
  ) {
    dom.reportFreshness.textContent =
      `Meta updated ${formatDate(
        freshness.meta_latest_date
      )}`;

    return;
  }

  const freshnessParts = [];

  if (
    platformIsAvailable("illumin")
  ) {
    freshnessParts.push(
      `Programmatic ${formatDate(
        freshness.illumin_latest_date
      )}`
    );
  }

  if (
    platformIsAvailable("meta")
  ) {
    freshnessParts.push(
      `Meta ${formatDate(
        freshness.meta_latest_date
      )}`
    );
  }

  dom.reportFreshness.textContent =
    `Updated · ${freshnessParts.join(
      " · "
    )}`;
}

function createKpiCard(
  platform,
  label,
  value,
  detail,
  exactValue
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    `kpi-card kpi-card--${platform}`;

  const labelElement =
    document.createElement("p");

  labelElement.className =
    "kpi-card__label";

  labelElement.textContent =
    label;

  const valueElement =
    document.createElement(
      "strong"
    );

  valueElement.className =
    "kpi-card__value";

  valueElement.textContent =
    value;

  if (
    exactValue !== undefined
  ) {
    valueElement.title =
      formatNumber(exactValue);
  }

  const detailElement =
    document.createElement("p");

  detailElement.className =
    "kpi-card__detail";

  detailElement.textContent =
    detail;

  card.append(
    labelElement,
    valueElement,
    detailElement
  );

  return card;
}

function renderKpis() {
  const cards = [];

  if (
    activePlatforms().includes(
      "illumin"
    )
  ) {
    const rows =
      filteredRows("illumin");

    const impressions =
      sumField(
        rows,
        "impressions"
      );

    const clicks =
      sumField(
        rows,
        "clicks"
      );

    const conversions =
      sumField(
        rows,
        "conversions"
      );

    const primary =
      sumField(
        rows,
        "primary_conv"
      );

    const secondary =
      sumField(
        rows,
        "secondary_conv"
      );

    const tertiary =
      sumField(
        rows,
        "tertiary_conv"
      );

    cards.push(
      createKpiCard(
        "illumin",
        "Programmatic impressions",
        formatCompact(
          impressions
        ),
        `${formatNumber(
          rows.length
        )} daily campaign rows`,
        impressions
      ),

      createKpiCard(
        "illumin",
        "Programmatic clicks",
        formatCompact(clicks),
        `CTR ${formatPercent(
          safeDivide(
            clicks,
            impressions
          ),
          3
        )}`,
        clicks
      ),

      createKpiCard(
        "illumin",
        "Programmatic conversions",
        formatCompact(
          conversions
        ),
        `${formatNumber(
          primary
        )} primary · ${formatNumber(
          secondary
        )} secondary · ${formatNumber(
          tertiary
        )} tertiary`,
        conversions
      )
    );
  }

  if (
    activePlatforms().includes(
      "meta"
    )
  ) {
    const rows =
      filteredRows("meta");

    const impressions =
      sumField(
        rows,
        "impressions"
      );

    const clicks =
      sumField(
        rows,
        "clicks"
      );

    const websiteClicks =
      sumField(
        rows,
        "inline_link_clicks"
      );

    cards.push(
      createKpiCard(
        "meta",
        "Meta impressions",
        formatCompact(
          impressions
        ),
        `${formatNumber(
          rows.length
        )} daily campaign rows`,
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
        formatCompact(
          websiteClicks
        ),
        `Website Clicks CTR ${formatPercent(
          safeDivide(
            websiteClicks,
            impressions
          ),
          2
        )}`,
        websiteClicks
      )
    );
  }

  dom.kpiGrid.replaceChildren(
    ...cards
  );
}

function createHighlightCard(
  platform,
  number,
  title,
  detail
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    `highlight-card highlight-card--${platform}`;

  const numberElement =
    document.createElement(
      "span"
    );

  numberElement.className =
    "highlight-card__number";

  numberElement.textContent =
    number;

  const titleElement =
    document.createElement(
      "strong"
    );

  titleElement.textContent =
    title;

  const detailElement =
    document.createElement(
      "span"
    );

  detailElement.textContent =
    detail;

  card.append(
    numberElement,
    titleElement,
    detailElement
  );

  return card;
}

function renderHighlights() {
  const cards = [];

  if (
    activePlatforms().includes(
      "illumin"
    )
  ) {
    const rows =
      filteredRows("illumin");

    const campaigns =
      aggregateCampaigns(
        rows,
        "illumin"
      );

    const topCampaign =
      campaigns[0];

    const totalImpressions =
      sumField(
        rows,
        "impressions"
      );

    if (topCampaign) {
      cards.push(
        createHighlightCard(
          "illumin",
          cards.length + 1,
          `${topCampaign.name} led Programmatic delivery`,
          `${formatNumber(
            topCampaign.impressions
          )} impressions · ${formatPercent(
            safeDivide(
              topCampaign.impressions,
              totalImpressions
            ),
            1
          )} of Programmatic impressions`
        )
      );
    }
  }

  if (
    activePlatforms().includes(
      "meta"
    )
  ) {
    const rows =
      filteredRows("meta");

    const campaigns =
      aggregateCampaigns(
        rows,
        "meta"
      );

    const topCampaign =
      campaigns[0];

    const totalImpressions =
      sumField(
        rows,
        "impressions"
      );

    if (topCampaign) {
      cards.push(
        createHighlightCard(
          "meta",
          cards.length + 1,
          `${topCampaign.name} led Meta delivery`,
          `${formatNumber(
            topCampaign.impressions
          )} impressions · ${formatPercent(
            safeDivide(
              topCampaign.impressions,
              totalImpressions
            ),
            1
          )} of Meta impressions`
        )
      );
    }
  }

  if (
    state.selectedPlatform ===
      "all" &&
    activePlatforms().includes(
      "illumin"
    ) &&
    activePlatforms().includes(
      "meta"
    )
  ) {
    const illuminImpressions =
      sumField(
        filteredRows(
          "illumin"
        ),
        "impressions"
      );

    const metaImpressions =
      sumField(
        filteredRows("meta"),
        "impressions"
      );

    const combinedImpressions =
      illuminImpressions +
      metaImpressions;

    const leadingPlatform =
      illuminImpressions >=
      metaImpressions
        ? {
            name: "Programmatic",
            value:
              illuminImpressions
          }
        : {
            name: "Meta",
            value:
              metaImpressions
          };

    if (
      combinedImpressions > 0
    ) {
      cards.push(
        createHighlightCard(
          "all",
          cards.length + 1,
          `${leadingPlatform.name} delivered the larger impression share`,
          `${formatPercent(
            safeDivide(
              leadingPlatform.value,
              combinedImpressions
            ),
            1
          )} of impressions across the two available platforms`
        )
      );
    }
  }

  dom.highlightsGrid.replaceChildren(
    ...cards
  );
}

function dailyTotals(
  rows,
  fields
) {
  const totals = new Map();

  for (const row of rows) {
    if (!totals.has(row.date)) {
      totals.set(
        row.date,
        Object.fromEntries(
          fields.map(
            (field) => [
              field,
              0
            ]
          )
        )
      );
    }

    const day =
      totals.get(row.date);

    for (
      const field of fields
    ) {
      day[field] +=
        toNumber(row[field]);
    }
  }

  return totals;
}

function renderTrendChart() {
  state.trendChart?.destroy();
  state.trendChart = null;

  if (
    typeof window.Chart !==
    "function"
  ) {
    setStatus(
      "The chart library did not load. Tables remain available below.",
      "error"
    );

    return;
  }

  const datasets = [];
  const allDates = new Set();
  const dailyByPlatform = {};

  if (
    activePlatforms().includes(
      "meta"
    )
  ) {
    dailyByPlatform.meta =
      dailyTotals(
        filteredRows("meta"),
        [
          "impressions",
          "inline_link_clicks"
        ]
      );

    dailyByPlatform.meta.forEach(
      (value, date) =>
        allDates.add(date)
    );
  }

  if (
    activePlatforms().includes(
      "illumin"
    )
  ) {
    dailyByPlatform.illumin =
      dailyTotals(
        filteredRows(
          "illumin"
        ),
        [
          "impressions",
          "clicks"
        ]
      );

    dailyByPlatform.illumin.forEach(
      (value, date) =>
        allDates.add(date)
    );
  }

  const labels = [
    ...allDates
  ].sort();

  if (
    dailyByPlatform.meta
  ) {
    datasets.push(
      {
        label:
          "Meta impressions",

        data: labels.map(
          (date) =>
            dailyByPlatform.meta.get(
              date
            )?.impressions ?? 0
        ),

        borderColor:
          "#1683ba",

        backgroundColor:
          "rgba(22, 131, 186, 0.12)",

        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "y"
      },

      {
        label:
          "Meta website clicks",

        data: labels.map(
          (date) =>
            dailyByPlatform.meta.get(
              date
            )?.inline_link_clicks ??
            0
        ),

        borderColor:
          "#14658d",

        borderDash: [
          5,
          4
        ],

        borderWidth: 1.8,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "yClicks"
      }
    );
  }

  if (
    dailyByPlatform.illumin
  ) {
    datasets.push(
      {
        label:
          "Programmatic impressions",

        data: labels.map(
          (date) =>
            dailyByPlatform.illumin.get(
              date
            )?.impressions ?? 0
        ),

        borderColor:
          "#e4932e",

        backgroundColor:
          "rgba(228, 147, 46, 0.12)",

        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "y"
      },

      {
        label:
          "Programmatic clicks",

        data: labels.map(
          (date) =>
            dailyByPlatform.illumin.get(
              date
            )?.clicks ?? 0
        ),

        borderColor:
          "#9a611c",

        borderDash: [
          5,
          4
        ],

        borderWidth: 1.8,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.22,
        yAxisID: "yClicks"
      }
    );
  }

  state.trendChart =
    new window.Chart(
      dom.trendCanvas,
      {
        type: "line",

        data: {
          labels,
          datasets
        },

        options: {
          responsive: true,
          maintainAspectRatio:
            false,

          interaction: {
            mode: "index",
            intersect: false
          },

          plugins: {
            legend: {
              position: "top",
              align: "start",

              labels: {
                usePointStyle: true,
                boxWidth: 8,
                boxHeight: 8
              }
            },

            tooltip: {
              callbacks: {
                title(items) {
                  return items.length
                    ? formatDate(
                        items[0]
                          .label
                      )
                    : "";
                },

                label(context) {
                  return `${context.dataset.label}: ${formatNumber(
                    context.raw
                  )}`;
                }
              }
            }
          },

          scales: {
            x: {
              grid: {
                display: false
              },

              ticks: {
                maxTicksLimit: 9,

                callback(value) {
                  return formatDate(
                    labels[
                      value
                    ],
                    true
                  );
                }
              }
            },

            y: {
              beginAtZero: true,

              grid: {
                color:
                  "rgba(148, 163, 184, 0.2)"
              },

              ticks: {
                callback: (
                  value
                ) =>
                  formatCompact(
                    value
                  )
              }
            },

            yClicks: {
              beginAtZero: true,
              position: "right",

              grid: {
                drawOnChartArea:
                  false
              },

              ticks: {
                callback: (
                  value
                ) =>
                  formatCompact(
                    value
                  )
              }
            }
          }
        }
      }
    );
}

function createMixRow(
  label,
  value,
  share,
  platform
) {
  const row =
    document.createElement(
      "div"
    );

  row.className =
    "mix-row";

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "mix-row__header";

  const name =
    document.createElement(
      "span"
    );

  name.className =
    "mix-row__name";

  name.textContent =
    label;

  const amount =
    document.createElement(
      "strong"
    );

  amount.textContent =
    `${formatNumber(
      value
    )} · ${formatPercent(
      share,
      1
    )}`;

  const track =
    document.createElement(
      "div"
    );

  track.className =
    "mix-row__track";

  const fill =
    document.createElement(
      "span"
    );

  fill.className =
    `mix-row__fill mix-row__fill--${platform}`;

  fill.style.width =
    `${share * 100}%`;

  header.append(
    name,
    amount
  );

  track.append(fill);

  row.append(
    header,
    track
  );

  return row;
}

function renderPlatformMix() {
  state.mixChart?.destroy();
  state.mixChart = null;

  const illuminImpressions =
    sumField(
      filteredRows(
        "illumin"
      ),
      "impressions"
    );

  const metaImpressions =
    sumField(
      filteredRows("meta"),
      "impressions"
    );

  const total =
    illuminImpressions +
    metaImpressions;

  const showMix =
    state.selectedPlatform ===
      "all" &&
    platformIsAvailable(
      "illumin"
    ) &&
    platformIsAvailable(
      "meta"
    ) &&
    illuminImpressions > 0 &&
    metaImpressions > 0;

  dom.platformMixSection.hidden =
    !showMix;

  if (
    !showMix ||
    typeof window.Chart !==
      "function"
  ) {
    return;
  }

  state.mixChart =
    new window.Chart(
      dom.mixCanvas,
      {
        type: "doughnut",

        data: {
          labels: [
            "Meta",
            "Programmatic"
          ],

          datasets: [
            {
              data: [
                metaImpressions,
                illuminImpressions
              ],

              backgroundColor: [
                "#1683ba",
                "#e4932e"
              ],

              borderColor:
                "#ffffff",

              borderWidth: 3,
              hoverOffset: 4
            }
          ]
        },

        options: {
          responsive: true,
          maintainAspectRatio:
            false,

          cutout: "66%",

          plugins: {
            legend: {
              display: false
            },

            tooltip: {
              callbacks: {
                label(
                  context
                ) {
                  return `${context.label}: ${formatNumber(
                    context.raw
                  )} impressions`;
                }
              }
            }
          }
        }
      }
    );

  dom.mixSummary.replaceChildren(
    createMixRow(
      "Meta",
      metaImpressions,
      metaImpressions /
        total,
      "meta"
    ),

    createMixRow(
      "Programmatic",
      illuminImpressions,
      illuminImpressions /
        total,
      "illumin"
    )
  );
}

function aggregateCampaigns(
  rows,
  platform
) {
  const campaigns =
    new Map();

  for (const row of rows) {
    const id =
      String(
        row.campaign_id ?? ""
      );

    const name =
      String(
        row.campaign_name ??
          ""
      ).trim();

    const key =
      id ||
      name ||
      "unlabeled";

    if (
      !campaigns.has(key)
    ) {
      campaigns.set(
        key,
        {
          id,

          name:
            name ||
            id ||
            "Unlabeled campaign",

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
        }
      );
    }

    const campaign =
      campaigns.get(key);

    campaign.impressions +=
      toNumber(
        row.impressions
      );

    campaign.clicks +=
      toNumber(
        row.clicks
      );

    if (
      platform ===
      "illumin"
    ) {
      for (
        const field of
        [
          "conversions",
          "primary_conv",
          "secondary_conv",
          "tertiary_conv",
          "video_start",
          "video_first_quartile",
          "video_midpoint",
          "video_third_quartile",
          "video_complete"
        ]
      ) {
        campaign[field] +=
          toNumber(
            row[field]
          );
      }
    }

    if (
      platform === "meta"
    ) {
      campaign.inline_link_clicks +=
        toNumber(
          row.inline_link_clicks
        );
    }
  }

  return [
    ...campaigns.values()
  ].sort(
    (
      first,
      second
    ) =>
      second.impressions -
      first.impressions
  );
}

function appendCampaignNameCell(
  row,
  campaign
) {
  const cell =
    document.createElement(
      "td"
    );

  const name =
    document.createElement(
      "strong"
    );

  name.className =
    "campaign-name";

  name.textContent =
    campaign.name;

  cell.append(name);

  if (campaign.id) {
    const id =
      document.createElement(
        "span"
      );

    id.className =
      "campaign-id";

    id.textContent =
      campaign.id;

    cell.append(id);
  }

  row.append(cell);
}

function appendValueCell(
  row,
  value
) {
  const cell =
    document.createElement(
      "td"
    );

  cell.textContent =
    value;

  row.append(cell);
}

function renderIlluminSection() {
  const rows =
    filteredRows("illumin");

  const showSection =
    activePlatforms().includes(
      "illumin"
    ) &&
    rows.length > 0;

  dom.illuminSection.hidden =
    !showSection;

  if (!showSection) {
    dom.illuminVideo.hidden =
      true;

    return;
  }

  const campaigns =
    aggregateCampaigns(
      rows,
      "illumin"
    );

  const impressions =
    sumField(
      rows,
      "impressions"
    );

  const clicks =
    sumField(
      rows,
      "clicks"
    );

  const conversions =
    sumField(
      rows,
      "conversions"
    );

  dom.illuminSummary.textContent =
    `${formatNumber(
      campaigns.length
    )} campaigns · ${formatNumber(
      impressions
    )} impressions · ${formatNumber(
      conversions
    )} Programmatic conversions`;

  const tableRows =
    campaigns.map(
      (campaign) => {
        const row =
          document.createElement(
            "tr"
          );

        appendCampaignNameCell(
          row,
          campaign
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.impressions
          )
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.clicks
          )
        );

        appendValueCell(
          row,
          formatPercent(
            safeDivide(
              campaign.clicks,
              campaign.impressions
            ),
            3
          )
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.conversions
          )
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.primary_conv
          )
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.secondary_conv
          )
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.tertiary_conv
          )
        );

        return row;
      }
    );

  dom.illuminCampaignBody.replaceChildren(
    ...tableRows
  );

  const videoStarts =
    sumField(
      rows,
      "video_start"
    );

  dom.illuminVideo.hidden =
    videoStarts === 0;

if (videoStarts > 0) {
  const videoMetrics = [
    [
      "Starts",
      "video_start"
    ],
    [
      "25% viewed",
      "video_first_quartile"
    ],
    [
      "50% viewed",
      "video_midpoint"
    ],
    [
      "75% viewed",
      "video_third_quartile"
    ],
    [
      "Completed",
      "video_complete"
    ]
  ];

  const steps =
    videoMetrics.map(
      (
        [
          label,
          field
        ],
        index
      ) => {
        const value =
          sumField(
            rows,
            field
          );

        const ratio =
          index === 0
            ? 1
            : safeDivide(
                value,
                videoStarts
              );

        const percentage =
          Math.min(
            Math.max(
              ratio * 100,
              0
            ),
            100
          );

        const step =
          document.createElement(
            "article"
          );

        step.className =
          "video-step";

        const header =
          document.createElement(
            "div"
          );

        header.className =
          "video-step__header";

        const labelElement =
          document.createElement(
            "span"
          );

        labelElement.className =
          "video-step__label";

        labelElement.textContent =
          label;

        const metrics =
          document.createElement(
            "div"
          );

        metrics.className =
          "video-step__metrics";

        const valueElement =
          document.createElement(
            "strong"
          );

        valueElement.textContent =
          formatNumber(
            value
          );

        const rateElement =
          document.createElement(
            "small"
          );

        rateElement.textContent =
          index === 0
            ? "100.0%"
            : formatPercent(
                ratio,
                1
              );

        metrics.append(
          valueElement,
          rateElement
        );

        header.append(
          labelElement,
          metrics
        );

        const track =
          document.createElement(
            "div"
          );

        track.className =
          "video-step__track";

        track.setAttribute(
          "aria-hidden",
          "true"
        );

        const fill =
          document.createElement(
            "span"
          );

        fill.className =
          "video-step__fill";

        fill.style.width =
          `${percentage}%`;

        track.append(fill);

        step.append(
          header,
          track
        );

        return step;
      }
    );

  dom.videoSteps.replaceChildren(
    ...steps
  );
}
  if (
    clicks === 0 &&
    impressions > 0
  ) {
    dom.illuminSummary.textContent +=
      " · no clicks in range";
  }
}

function renderMetaSection() {
  const rows =
    filteredRows("meta");

  const showSection =
    activePlatforms().includes(
      "meta"
    ) &&
    rows.length > 0;

  dom.metaSection.hidden =
    !showSection;

  if (!showSection) {
    return;
  }

  const campaigns =
    aggregateCampaigns(
      rows,
      "meta"
    );

  const impressions =
    sumField(
      rows,
      "impressions"
    );

  const websiteClicks =
    sumField(
      rows,
      "inline_link_clicks"
    );

  dom.metaSummary.textContent =
    `${formatNumber(
      campaigns.length
    )} campaigns · ${formatNumber(
      impressions
    )} impressions · ${formatNumber(
      websiteClicks
    )} website clicks`;

  const tableRows =
    campaigns.map(
      (campaign) => {
        const row =
          document.createElement(
            "tr"
          );

        appendCampaignNameCell(
          row,
          campaign
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.impressions
          )
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.clicks
          )
        );

        appendValueCell(
          row,
          formatNumber(
            campaign.inline_link_clicks
          )
        );

        appendValueCell(
          row,
          formatPercent(
            safeDivide(
              campaign.inline_link_clicks,
              campaign.impressions
            ),
            2
          )
        );

        return row;
      }
    );

  dom.metaCampaignBody.replaceChildren(
    ...tableRows
  );
}
function aggregateMetaAds(rows) {
  const ads = new Map();

  for (const row of rows) {
    const id = String(row.ad_id ?? "");
    const name = String(row.ad_name ?? "").trim();
    const key = id || name || "unlabeled";

    if (!ads.has(key)) {
      ads.set(key, {
        id,
        name: name || id || "Unlabeled ad",
        campaign_name: String(row.campaign_name ?? "").trim(),
        adset_name: String(row.adset_name ?? "").trim(),
        impressions: 0,
        clicks: 0,
        inline_link_clicks: 0,
        spend: 0
      });
    }

    const ad = ads.get(key);

    ad.impressions += toNumber(row.impressions);
    ad.clicks += toNumber(row.clicks);
    ad.inline_link_clicks += toNumber(row.inline_link_clicks);
    ad.spend += toNumber(row.spend);
  }

  return [...ads.values()].sort(
    (first, second) => second.impressions - first.impressions
  );
}

function aggregateIlluminCreatives(rows) {
  const creatives = new Map();

  for (const row of rows) {
    const id = String(row.creative_id ?? "");
    const name = String(row.creative_name ?? "").trim();
    const key = id || name || "unlabeled";

    if (!creatives.has(key)) {
      creatives.set(key, {
        id,
        name: name || id || "Unlabeled creative",
        creative_type: String(row.creative_type ?? "").trim(),
        journey_name: String(row.journey_name ?? "").trim(),
        views: 0,
        clicks: 0,
        conversions: 0,
        video_complete: 0
      });
    }

    const creative = creatives.get(key);

    creative.views += toNumber(row.views);
    creative.clicks += toNumber(row.clicks);
    creative.conversions += toNumber(row.conversions);
    creative.video_complete += toNumber(row.video_complete);
  }

  return [...creatives.values()].sort(
    (first, second) => second.views - first.views
  );
}
function programmaticTacticLabel(creativeType) {
  const type =
    String(creativeType ?? "").trim();

  switch (type) {
    case "CTV Video":
      return "CTV";

    case "Display Standard":
      return "Display";

    case "Native Display":
      return "Native";

    case "Audio":
      return "Streaming Audio";

    case "Digital Out-Of-Home Display":
      return "DOOH";

    default:
      return type || "Other";
  }
}

function groupProgrammaticCreatives(creatives) {
  const groups = new Map();

  for (const creative of creatives) {
    const tactic =
      programmaticTacticLabel(
        creative.creative_type
      );

    if (!groups.has(tactic)) {
      groups.set(tactic, {
        label: tactic,
        creatives: [],
        views: 0,
        clicks: 0,
        conversions: 0,
        video_complete: 0
      });
    }

    const group = groups.get(tactic);

    group.creatives.push(creative);
    group.views += creative.views;
    group.clicks += creative.clicks;
    group.conversions += creative.conversions;
    group.video_complete +=
      creative.video_complete;
  }

  const tacticOrder = [
    "CTV",
    "Display",
    "Native",
    "Streaming Audio",
    "DOOH"
  ];

  return [...groups.values()].sort(
    (first, second) => {
      const firstIndex =
        tacticOrder.indexOf(first.label);

      const secondIndex =
        tacticOrder.indexOf(second.label);

      if (
        firstIndex !== -1 &&
        secondIndex !== -1
      ) {
        return firstIndex - secondIndex;
      }

      if (firstIndex !== -1) {
        return -1;
      }

      if (secondIndex !== -1) {
        return 1;
      }

      return first.label.localeCompare(
        second.label
      );
    }
  );
}

function createProgrammaticTacticGroup(group) {
  const card =
    document.createElement("article");

  card.className = "tactic-card";

  const header =
    document.createElement("div");

  header.className =
    "tactic-card__header";

  const heading =
    document.createElement("div");

  const label =
    document.createElement("span");

  label.className =
    "tactic-card__label";

  label.textContent =
    group.label;

  const summary =
    document.createElement("p");

  summary.className =
    "tactic-card__summary";

  summary.textContent =
    `${formatNumber(group.creatives.length)} creatives · ` +
    `${formatNumber(group.views)} views · ` +
    `${formatNumber(group.clicks)} clicks · ` +
    `${formatNumber(group.conversions)} conversions`;

  heading.append(
    label,
    summary
  );

  const displayedCreatives =
    group.creatives.slice(0, 5);

  const showing =
    document.createElement("span");

  showing.className =
    "tactic-card__showing";

  showing.textContent =
    group.creatives.length > 5
      ? "Top 5 by views"
      : "All creatives";

  header.append(
    heading,
    showing
  );

  const tableScroll =
    document.createElement("div");

  tableScroll.className =
    "table-scroll tactic-card__table";

  const table =
    document.createElement("table");

  const tableHead =
    document.createElement("thead");

  const headerRow =
    document.createElement("tr");

  for (
    const headingText of
    [
      "Creative",
      "Views",
      "Clicks",
      "CTR",
      "Conversions",
      "Video completes"
    ]
  ) {
    const cell =
      document.createElement("th");

    cell.scope = "col";
    cell.textContent =
      headingText;

    headerRow.append(cell);
  }

  tableHead.append(headerRow);

  const tableBody =
    document.createElement("tbody");

  for (
    const creative of
    displayedCreatives
  ) {
    const row =
      document.createElement("tr");

    appendEntityNameCell(
      row,
      creative.name,
      creative.id,
      creative.journey_name
    );

    appendValueCell(
      row,
      formatNumber(
        creative.views
      )
    );

    appendValueCell(
      row,
      formatNumber(
        creative.clicks
      )
    );

    appendValueCell(
      row,
      formatPercent(
        safeDivide(
          creative.clicks,
          creative.views
        ),
        3
      )
    );

    appendValueCell(
      row,
      formatNumber(
        creative.conversions
      )
    );

    appendValueCell(
      row,
      formatNumber(
        creative.video_complete
      )
    );

    tableBody.append(row);
  }

  table.append(
    tableHead,
    tableBody
  );

  tableScroll.append(table);

  card.append(
    header,
    tableScroll
  );

  return card;
}
function appendEntityNameCell(row, name, id, detail) {
  const cell = document.createElement("td");

  const nameElement = document.createElement("strong");
  nameElement.className = "campaign-name";
  nameElement.textContent = name;

  cell.append(nameElement);

  if (detail) {
    const detailElement = document.createElement("span");
    detailElement.className = "campaign-id";
    detailElement.textContent = detail;
    cell.append(detailElement);
  }

  if (id) {
    const idElement = document.createElement("span");
    idElement.className = "campaign-id";
    idElement.textContent = id;
    cell.append(idElement);
  }

  row.append(cell);
}

function renderMetaAdSection() {
  const rows = filteredMetaAdRows();

  const showSection =
    activePlatforms().includes("meta") &&
    rows.length > 0;

  dom.metaAdSection.hidden = !showSection;

  if (!showSection) {
    return;
  }

  const ads = aggregateMetaAds(rows);
  const displayedAds = ads.slice(0, 10);

  const impressions = sumField(rows, "impressions");
  const websiteClicks = sumField(rows, "inline_link_clicks");

  dom.metaAdSummary.textContent =
    `${formatNumber(ads.length)} ads · ` +
    `${formatNumber(impressions)} impressions · ` +
    `${formatNumber(websiteClicks)} website clicks · ` +
    `showing top ${formatNumber(displayedAds.length)} by impressions`;

  const tableRows = displayedAds.map((ad) => {
    const row = document.createElement("tr");

    appendEntityNameCell(
      row,
      ad.name,
      ad.id,
      [ad.campaign_name, ad.adset_name].filter(Boolean).join(" · ")
    );

    appendValueCell(row, formatNumber(ad.impressions));
    appendValueCell(row, formatNumber(ad.clicks));
    appendValueCell(row, formatNumber(ad.inline_link_clicks));

    appendValueCell(
      row,
      formatPercent(
        safeDivide(ad.inline_link_clicks, ad.impressions),
        2
      )
    );

    return row;
  });

  dom.metaAdBody.replaceChildren(...tableRows);
}
function aggregateAudienceCategory(
  rows,
  categoryField,
  metricField
) {
  const categories = new Map();

  for (const row of rows) {
    const rawLabel =
      String(
        row[categoryField] ?? "Unknown"
      ).trim();

    const label =
      rawLabel || "Unknown";

    if (!categories.has(label)) {
      categories.set(label, {
        label,
        value: 0,
        clicks: 0
      });
    }

    const category =
      categories.get(label);

    category.value +=
      toNumber(row[metricField]);

    category.clicks +=
      toNumber(row.clicks);
  }

  return [...categories.values()];
}

function normalizeGenderLabel(value) {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (normalized === "female") {
    return "Female";
  }

  if (normalized === "male") {
    return "Male";
  }

  if (normalized === "unknown") {
    return "Unknown";
  }

  return value || "Unknown";
}

function sortMetaAgeCategories(categories) {
  const order = [
    "18-24",
    "25-34",
    "35-44",
    "45-54",
    "55-64",
    "65+",
    "Unknown"
  ];

  return categories.sort(
    (first, second) => {
      const firstIndex =
        order.indexOf(first.label);

      const secondIndex =
        order.indexOf(second.label);

      return (
        (firstIndex === -1 ? 99 : firstIndex) -
        (secondIndex === -1 ? 99 : secondIndex)
      );
    }
  );
}

function sortProgrammaticAgeCategories(
  categories
) {
  return categories.sort(
    (first, second) => {
      if (
        first.label.toLowerCase() ===
        "unknown"
      ) {
        return 1;
      }

      if (
        second.label.toLowerCase() ===
        "unknown"
      ) {
        return -1;
      }

      const firstAge =
        Number.parseInt(
          first.label,
          10
        );

      const secondAge =
        Number.parseInt(
          second.label,
          10
        );

      return (
        (Number.isFinite(firstAge)
          ? firstAge
          : 999) -
        (Number.isFinite(secondAge)
          ? secondAge
          : 999)
      );
    }
  );
}

function sortGenderCategories(categories) {
  const order = [
    "female",
    "male",
    "unknown"
  ];

  return categories.sort(
    (first, second) => {
      const firstIndex =
        order.indexOf(
          first.label.toLowerCase()
        );

      const secondIndex =
        order.indexOf(
          second.label.toLowerCase()
        );

      return (
        (firstIndex === -1 ? 99 : firstIndex) -
        (secondIndex === -1 ? 99 : secondIndex)
      );
    }
  );
}

function createAudienceRows(
  categories,
  platform,
  metricLabel,
  showClicks = false
) {
  const total =
    categories.reduce(
      (sum, category) =>
        sum + category.value,
      0
    );

  return categories.map(
    (category) => {
      const share =
        safeDivide(
          category.value,
          total
        ) ?? 0;

      const row =
        document.createElement("div");

      row.className =
        "audience-row";

      const header =
        document.createElement("div");

      header.className =
        "audience-row__header";

      const label =
        document.createElement("strong");

      label.className =
        "audience-row__label";

      label.textContent =
        normalizeGenderLabel(
          category.label
        );

      const metrics =
        document.createElement("span");

      metrics.className =
        "audience-row__metrics";

      const primary =
        document.createElement("strong");

      primary.textContent =
        formatNumber(
          category.value
        );

      const shareElement =
        document.createElement("small");

      shareElement.textContent =
        `${formatPercent(
          share,
          1
        )} of ${metricLabel}`;

      metrics.append(
        primary,
        shareElement
      );

      if (showClicks) {
        const clickElement =
          document.createElement("small");

        clickElement.textContent =
          `${formatNumber(
            category.clicks
          )} clicks`;

        metrics.append(
          clickElement
        );
      }

      header.append(
        label,
        metrics
      );

      const track =
        document.createElement("div");

      track.className =
        "audience-row__track";

      const fill =
        document.createElement("span");

      fill.className =
        `audience-row__fill audience-row__fill--${platform}`;

      fill.style.width =
        `${Math.min(
          share * 100,
          100
        )}%`;

      track.append(fill);

      row.append(
        header,
        track
      );

      return row;
    }
  );
}
function renderMetaAudienceSection() {
  const ageRows =
    filteredAudienceRows(
      "meta",
      "age_daily"
    );

  const genderRows =
    filteredAudienceRows(
      "meta",
      "gender_daily"
    );

  const showSection =
    activePlatforms().includes("meta") &&
    (
      ageRows.length > 0 ||
      genderRows.length > 0
    );

  dom.metaAudienceSection.hidden =
    !showSection;

  if (!showSection) {
    dom.metaAgeBreakdown.replaceChildren();
    dom.metaGenderBreakdown.replaceChildren();
    dom.metaAudienceScopeNote.hidden = true;
    return;
  }

  const ages =
    sortMetaAgeCategories(
      aggregateAudienceCategory(
        ageRows,
        "age",
        "inline_link_clicks"
      )
    );

  const genders =
    sortGenderCategories(
      aggregateAudienceCategory(
        genderRows,
        "gender",
        "inline_link_clicks"
      )
    );

  dom.metaAgeBreakdown.replaceChildren(
    ...createAudienceRows(
      ages,
      "meta",
      "website clicks"
    )
  );

  dom.metaGenderBreakdown.replaceChildren(
    ...createAudienceRows(
      genders,
      "meta",
      "website clicks"
    )
  );

  const scope =
    state.audienceReportData
      ?.platforms
      ?.meta
      ?.scope;

  if (
    scope?.is_shared &&
    scope?.source_name
  ) {
    dom.metaAudienceScopeNote.textContent =
      `Audience demographics reflect campaign-level Meta reporting for ${scope.source_name}.`;

    dom.metaAudienceScopeNote.hidden =
      false;
  } else {
    dom.metaAudienceScopeNote.hidden =
      true;
  }
}
function renderIlluminAudienceSection() {
  const ageRows =
    filteredAudienceRows(
      "illumin",
      "age_daily"
    );

  const genderRows =
    filteredAudienceRows(
      "illumin",
      "gender_daily"
    );

  const showSection =
    activePlatforms().includes(
      "illumin"
    ) &&
    (
      ageRows.length > 0 ||
      genderRows.length > 0
    );

  dom.illuminAudienceSection.hidden =
    !showSection;

  if (!showSection) {
    dom.illuminAgeBreakdown.replaceChildren();
    dom.illuminGenderBreakdown.replaceChildren();
    return;
  }

  const ages =
    sortProgrammaticAgeCategories(
      aggregateAudienceCategory(
        ageRows,
        "age_range",
        "views"
      )
    );

  const genders =
    sortGenderCategories(
      aggregateAudienceCategory(
        genderRows,
        "gender",
        "views"
      )
    );

  dom.illuminAgeBreakdown.replaceChildren(
    ...createAudienceRows(
      ages,
      "illumin",
      "views",
      true
    )
  );

  dom.illuminGenderBreakdown.replaceChildren(
    ...createAudienceRows(
      genders,
      "illumin",
      "views",
      true
    )
  );
}
function renderIlluminCreativeSection() {
  const rows =
    filteredIlluminCreativeRows();

  const showSection =
    activePlatforms().includes(
      "illumin"
    ) &&
    rows.length > 0;

  dom.illuminCreativeSection.hidden =
    !showSection;

  if (!showSection) {
    dom.illuminTacticGroups.replaceChildren();
    return;
  }

  const creatives =
    aggregateIlluminCreatives(rows);

  const tacticGroups =
    groupProgrammaticCreatives(
      creatives
    );

  const views =
    sumField(rows, "views");

  const clicks =
    sumField(rows, "clicks");

  const conversions =
    sumField(
      rows,
      "conversions"
    );

  dom.illuminCreativeSummary.textContent =
    `${formatNumber(creatives.length)} creatives · ` +
    `${formatNumber(tacticGroups.length)} tactics · ` +
    `${formatNumber(views)} views · ` +
    `${formatNumber(clicks)} clicks · ` +
    `${formatNumber(conversions)} conversions`;

  const tacticCards =
    tacticGroups.map(
      createProgrammaticTacticGroup
    );

  dom.illuminTacticGroups.replaceChildren(
    ...tacticCards
  );
}
function updatePrintHeader() {
  if (!state.reportData) {
    return;
  }

  const platformLabel =
    activePlatforms()
      .map(
        (platform) =>
          platform ===
          "illumin"
            ? "Programmatic"
            : "Meta"
      )
      .join(" + ");

  const generatedAt =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(
      new Date()
    );

  dom.printClientName.textContent =
    `${state.reportData.client.client_name} · Performance report`;

  dom.printReportMeta.textContent =
    `${formatDateRange(
      state.startDate,
      state.endDate
    )} · ${
      platformLabel ||
      "No platform data"
    } · Generated ${generatedAt}`;
}

function printReport() {
  if (
    !state.reportData ||
    dom.reportData.hidden
  ) {
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

  const platforms =
    activePlatforms();

  const rowCount =
    platforms.reduce(
      (
        total,
        platform
      ) =>
        total +
        filteredRows(
          platform
        ).length,
      0
    );

  const dayCount =
    inclusiveDayCount(
      state.startDate,
      state.endDate
    );

  dom.report.hidden = false;

  dom.clientReportTitle.textContent =
    state.reportData.client.client_name;

  dom.reportPeriod.textContent =
    `${formatDateRange(
      state.startDate,
      state.endDate
    )} · ${formatNumber(
      dayCount
    )} days`;

  dom.reportRowCount.textContent =
    `${formatNumber(
      rowCount
    )} daily campaign rows`;

  renderPlatformBadges();
  renderFreshness();
  updatePrintHeader();

  const hasRows =
    rowCount > 0;

  dom.noDataPanel.hidden =
    hasRows;

  dom.reportData.hidden =
    !hasRows;

  dom.printButton.disabled =
    !hasRows;

  if (!hasRows) {
    destroyCharts();

    setStatus(
      "No reporting rows match the selected filters.",
      "default"
    );

    return;
  }

  renderKpis();
  renderHighlights();
  renderTrendChart();
  renderPlatformMix();
  renderIlluminSection();
  renderMetaSection();
  renderIlluminCreativeSection();
  renderIlluminAudienceSection();
  renderMetaAdSection();
  renderMetaAudienceSection();

  setStatus(
    `${state.reportData.client.client_name} · ${formatDateRange(
      state.startDate,
      state.endDate
    )}`,
    "success"
  );
}

dom.clientSelect.addEventListener(
  "change",
  (event) => {
    state.selectedClientId =
      event.target.value ||
      null;

    if (
      !state.selectedClientId
    ) {
      resetReport();
      return;
    }

    loadReport(
      state.selectedClientId
    );
  }
);

dom.startDate.addEventListener(
  "change",
  applyCustomDates
);

dom.endDate.addEventListener(
  "change",
  applyCustomDates
);

for (
  const button of
  dom.presetButtons
) {
  button.addEventListener(
    "click",
    () =>
      applyPreset(
        button.dataset.preset
      )
  );
}

for (
  const button of
  dom.platformButtons
) {
  button.addEventListener(
    "click",
    () => {
      state.selectedPlatform =
        button.dataset.platform;

      updatePlatformControls();
      renderReport();
    }
  );
}

dom.printButton.addEventListener(
  "click",
  printReport
);

window.addEventListener(
  "beforeprint",
  () => {
    updatePrintHeader();

    state.trendChart?.resize();
    state.mixChart?.resize();
  }
);

window.addEventListener(
  "afterprint",
  () => {
    state.trendChart?.resize();
    state.mixChart?.resize();
  }
);

loadClients();
