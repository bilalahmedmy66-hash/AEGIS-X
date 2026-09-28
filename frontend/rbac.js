(() => {
  "use strict";

  const PANEL_ID = "aegis-rbac-roles";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }

  function findAnchor() {
    return document.querySelector("#aegis-multi-source-telemetry, #aegis-realtime-soc, main, .dashboard, body");
  }

  async function loadRoles(panel) {
    const summary = panel.querySelector(".rbac-summary");
    const body = panel.querySelector("tbody");

    try {
      const response = await fetch("/api/v1/rbac/roles");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      summary.textContent = `${data.roles.length} prototype roles · Authentication: ${data.authentication}`;

      body.innerHTML = data.roles.map(role => `
        <tr>
          <td><strong>${escapeHtml(role.role)}</strong></td>
          <td>${escapeHtml(role.description)}</td>
          <td>${role.permissions.map(escapeHtml).join(", ")}</td>
        </tr>
      `).join("");
    } catch (error) {
      summary.textContent = "RBAC role information unavailable.";
      body.innerHTML = `<tr><td colspan="3">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  function renderPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return;

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "rbac-panel";
    panel.innerHTML = `
      <div class="rbac-header">
        <div>
          <h2>RBAC / Analyst Roles</h2>
          <p>Academic authorization boundaries for AEGIS X security workflows.</p>
        </div>
        <span class="rbac-mode">PROTOTYPE</span>
      </div>
      <div class="rbac-summary">Loading roles...</div>
      <div class="rbac-table-wrap">
        <table>
          <thead>
            <tr><th>Role</th><th>Scope</th><th>Permissions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    loadRoles(panel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPanel);
  } else {
    renderPanel();
  }
})();
