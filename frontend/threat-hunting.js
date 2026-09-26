(function () {
    "use strict";

    function $(id) {
        return document.getElementById(id);
    }

    function buildQuery() {
        const params = new URLSearchParams();

        const q = $("huntQuery")?.value.trim();
        const eventType = $("huntEventType")?.value;
        const sourceIp = $("huntSourceIp")?.value.trim();
        const user = $("huntUser")?.value.trim();
        const severity = $("huntSeverity")?.value;

        if (q) params.set("q", q);
        if (eventType) params.set("event_type", eventType);
        if (sourceIp) params.set("source_ip", sourceIp);
        if (user) params.set("user", user);
        if (severity) params.set("min_severity", severity);

        params.set("limit", "100");

        return params.toString();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderResults(data) {
        const container = $("huntResults");

        if (!container) {
            return;
        }

        const events = Array.isArray(data?.events) ? data.events : [];

        if (!events.length) {
            container.innerHTML = `
                <div class="threat-hunting-empty">
                    No matching telemetry found.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="threat-hunting-summary">
                <span>${events.length} matching event${events.length === 1 ? "" : "s"}</span>
                <span>Read-only hunt</span>
            </div>

            <div class="threat-hunting-table-wrap">
                <table class="threat-hunting-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>EVENT</th>
                            <th>SOURCE</th>
                            <th>USER</th>
                            <th>SOURCE IP</th>
                            <th>SEVERITY</th>
                            <th>TIMESTAMP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${events.map(event => `
                            <tr>
                                <td>${escapeHtml(event.id)}</td>
                                <td>${escapeHtml(event.event_type)}</td>
                                <td>${escapeHtml(event.source)}</td>
                                <td>${escapeHtml(event.user || "—")}</td>
                                <td>${escapeHtml(event.source_ip || "—")}</td>
                                <td>
                                    <span class="hunt-severity severity-${escapeHtml(event.severity)}">
                                        ${escapeHtml(event.severity)}
                                    </span>
                                </td>
                                <td>${escapeHtml(event.timestamp)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    async function runHunt() {
        const button = $("huntButton");
        const container = $("huntResults");

        if (!button || !container) {
            return;
        }

        button.disabled = true;
        button.textContent = "HUNTING...";

        container.innerHTML = `
            <div class="threat-hunting-empty">
                Searching security telemetry...
            </div>
        `;

        try {
            const query = buildQuery();

            const response = await fetch(
                `/api/v1/threat-hunting/search?${query}`,
                {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Threat hunting request failed: ${response.status}`);
            }

            const data = await response.json();
            renderResults(data);
        } catch (error) {
            console.error("Threat Hunting error:", error);

            container.innerHTML = `
                <div class="threat-hunting-error">
                    Threat hunting request failed. Check the API status.
                </div>
            `;
        } finally {
            button.disabled = false;
            button.textContent = "HUNT";
        }
    }

    function clearHunt() {
        if ($("huntQuery")) $("huntQuery").value = "";
        if ($("huntEventType")) $("huntEventType").value = "";
        if ($("huntSourceIp")) $("huntSourceIp").value = "";
        if ($("huntUser")) $("huntUser").value = "";
        if ($("huntSeverity")) $("huntSeverity").value = "";

        const container = $("huntResults");

        if (container) {
            container.innerHTML = "";
        }
    }

    function initThreatHunting() {
        const huntButton = $("huntButton");
        const clearButton = $("huntClearButton");

        if (!huntButton || !clearButton) {
            return;
        }

        huntButton.addEventListener("click", runHunt);
        clearButton.addEventListener("click", clearHunt);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initThreatHunting);
    } else {
        initThreatHunting();
    }
})();
