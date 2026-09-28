(() => {
    "use strict";

    const PANEL_ID = "aegis-threat-intelligence";

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function findAnchor() {
        return document.querySelector(
            "#aegis-rbac-roles, #aegis-multi-source-telemetry, #aegis-realtime-soc, main, .dashboard, body"
        );
    }

    async function loadThreatIntelligence() {
        const response = await fetch(
            "/api/v1/threat-intelligence?active=true"
        );

        if (!response.ok) {
            throw new Error(`Threat Intelligence request failed: ${response.status}`);
        }

        return response.json();
    }

    function render(records) {
        const existing = document.getElementById(PANEL_ID);
        if (existing) {
            existing.remove();
        }

        const panel = document.createElement("section");
        panel.id = PANEL_ID;
        panel.className = "threat-intel-panel";

        const rows = records.length
            ? records.map(record => `
                <tr>
                    <td><code>${escapeHtml(record.indicator)}</code></td>
                    <td>${escapeHtml(record.indicator_type)}</td>
                    <td>${escapeHtml(record.threat_type)}</td>
                    <td>${escapeHtml(record.severity)}</td>
                    <td>${escapeHtml(record.confidence)}%</td>
                    <td>${escapeHtml(record.source)}</td>
                    <td>${escapeHtml(record.last_seen)}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="7" class="threat-intel-empty">
                        No active threat intelligence records.
                    </td>
                </tr>
            `;

        panel.innerHTML = `
            <div class="threat-intel-header">
                <div>
                    <h2>Threat Intelligence Center</h2>
                    <p>Local, explainable indicator intelligence for AEGIS X investigations.</p>
                </div>
                <span class="threat-intel-mode">LOCAL INTELLIGENCE</span>
            </div>

            <div class="threat-intel-summary">
                <strong>${records.length}</strong> active intelligence record(s)
            </div>

            <div class="threat-intel-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Indicator</th>
                            <th>Type</th>
                            <th>Threat Type</th>
                            <th>Severity</th>
                            <th>Confidence</th>
                            <th>Source</th>
                            <th>Last Seen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        const anchor = findAnchor();

        if (anchor && anchor !== document.body) {
            anchor.parentNode.insertBefore(panel, anchor);
        } else {
            document.body.appendChild(panel);
        }
    }

    async function initialize() {
        try {
            const data = await loadThreatIntelligence();
            render(data.records || []);
        } catch (error) {
            console.error("AEGIS Threat Intelligence:", error);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
