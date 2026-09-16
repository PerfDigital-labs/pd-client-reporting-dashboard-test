"use strict";

const state = {
  clients: [],
  selectedClientId: null
};

const clientSelect = document.querySelector("#client-select");
const clientStatus = document.querySelector("#client-status");

function setClientStatus(message, type = "default") {
  if (!clientStatus) {
    return;
  }

  clientStatus.textContent = message;
  clientStatus.dataset.type = type;
}

function showClientLoadError(message) {
  if (clientSelect) {
    clientSelect.replaceChildren(new Option("Clients unavailable", ""));
    clientSelect.disabled = true;
  }

  setClientStatus(message, "error");
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

function populateClientSelect(clients) {
  if (!clientSelect) {
    return;
  }

  const options = [new Option("Select a client", "")];

  for (const client of clients) {
    options.push(new Option(client.client_name, client.client_id));
  }

  clientSelect.replaceChildren(...options);
  clientSelect.disabled = false;
}

async function loadClients() {
  if (!clientSelect || !window.REPORT_CONFIG?.clientsApiUrl) {
    showClientLoadError("The client-list configuration is unavailable.");
    return;
  }

  clientSelect.disabled = true;
  setClientStatus("Loading the active client list.", "loading");

  try {
    const response = await fetch(window.REPORT_CONFIG.clientsApiUrl, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Client request failed with status ${response.status}.`);
    }

    const data = await response.json();

    if (!Array.isArray(data.clients)) {
      throw new Error("The client response did not include a clients list.");
    }

    const validClients = data.clients.filter(isValidClient);

    if (validClients.length === 0) {
      throw new Error("No active clients were returned.");
    }

    state.clients = validClients;
    populateClientSelect(state.clients);
    setClientStatus(
      `${state.clients.length} active clients available.`,
      "success"
    );
  } catch (error) {
    console.error("Unable to load the client list.", error);
    showClientLoadError(
      "The client list could not be loaded. Refresh the page to try again."
    );
  }
}

clientSelect?.addEventListener("change", (event) => {
  state.selectedClientId = event.target.value || null;

  if (!state.selectedClientId) {
    setClientStatus(
      `${state.clients.length} active clients available.`,
      "success"
    );
    return;
  }

  const selectedClient = state.clients.find(
    (client) => client.client_id === state.selectedClientId
  );

  if (selectedClient) {
    setClientStatus(
      `${selectedClient.client_name} selected. Campaign data is not loaded yet.`,
      "success"
    );
  }
});

loadClients();
