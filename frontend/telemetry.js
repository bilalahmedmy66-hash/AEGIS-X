(() => {
  "use strict";

  const PANEL_ID = "aegis-multi-source-telemetry";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }

  function findAnchor() {
    return document.querySelector("#aegis-realtime-soc, #aegis-security-graph, main, .dashboard, body");
  }

  function renderPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return;

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "telemetry-panel";
    panel.innerHTML = `
      <div class="telemetry-header">
        <div>
          <h2>Multi-Source Telemetry</h2>
          <p>Normalized security event sources feeding the AEGIS X evidence pipeline.</p>
        </div>
        <button type="button" class="telemetry-refresh">Refresh</button>
      </div>
      <div class="telemetry-summary">Loading telemetry sources...</div>
      <div class="telemetry-table-wrap">
        <table>
          <thead>
            <tr><th>Source</th><th>Events</th><th>Last Seen</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    panel.querySelector(".telemetry-refresh").addEventListener("click", loadSources);
    loadSources();
  }

  async function loadSources() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const summary = panel.querySelector(".telemetry-summary");
    const body = panel.querySelector("tbody");

    try {
      const response = await fetch("/api/v1/telemetry/sources");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      summary.textContent = `${data.total_sources} telemetry sources connected`;

      body.innerHTML = data.sources.map(item => `
        <tr>
          <td>${escapeHtml(item.source)}</td>
          <td>${escapeHtml(item.event_count)}</td>
          <td>${escapeHtml(item.last_seen)}</td>
        </tr>
      `).join("");
    } catch (error) {
      summary.textContent = "Telemetry source inventory unavailable.";
      body.innerHTML = `<tr><td colspan="3">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPanel);
  } else {
    renderPanel();
  }
})();
