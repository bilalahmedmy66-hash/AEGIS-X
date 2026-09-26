(function () {
    "use strict";

    const state = {
        incidents: []
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        return response.json();
    }

    function findAnchor() {
        const headings = Array.from(document.querySelectorAll("h2, h3"));
        return headings.find((heading) =>
            heading.textContent.trim().toLowerCase() === "evidence explorer"
        ) || headings.find((heading) =>
            heading.textContent.trim().toLowerCase() === "incident management"
        );
    }

    function ensurePanel() {
        let panel = document.getElementById("riskTimelinePanel");
        if (panel) return panel;

        const anchor = findAnchor();
        if (!anchor) return null;

        panel = document.createElement("section");
        panel.id = "riskTimelinePanel";
        panel.className = "panel risk-timeline-panel";

        panel.innerHTML = `
            <div class="panel-header">
                <div>
                    <h3>Risk Timeline</h3>
                    <p class="risk-timeline-subtitle">
                        Evidence-based progression from telemetry to incident risk.
                    </p>
                </div>
            </div>

            <div class="risk-timeline-toolbar">
                <label>
                    Incident
                    <select id="riskTimelineIncidentSelect">
                        <option value="">Select incident</option>
                    </select>
                </label>
                <button id="riskTimelineLoadButton" type="button">LOAD TIMELINE</button>
            </div>

            <div id="riskTimelineStatus" class="risk-timeline-status">
                Select an incident to inspect risk progression.
            </div>

            <div id="riskTimelineContent" class="risk-timeline-content"></div>
        `;

        anchor.closest(".panel, section, .card")?.insertAdjacentElement("afterend", panel)
            || anchor.insertAdjacentElement("afterend", panel);

        return panel;
    }

    function riskValue(item) {
        if (item.risk_score !== undefined && item.risk_score !== null) {
            return Number(item.risk_score);
        }

        if (item.severity !== undefined && item.severity !== null) {
            return Number(item.severity);
        }

        return null;
    }

    function render(incident, timeline) {
        const content = document.getElementById("riskTimelineContent");
        if (!content) return;

        const items = timeline
            .map((item) => ({
                ...item,
                value: riskValue(item)
            }))
            .filter((item) => item.value !== null);

        content.innerHTML = `
            <div class="risk-summary-grid">
                <div>
                    <span>Incident</span>
                    <strong>#${escapeHtml(incident.id)}</strong>
                </div>
                <div>
                    <span>Type</span>
                    <strong>${escapeHtml(incident.incident_type)}</strong>
                </div>
                <div>
                    <span>Risk Score</span>
                    <strong>${escapeHtml(incident.risk_score)}</strong>
                </div>
                <div>
                    <span>Risk Level</span>
                    <strong>${escapeHtml(incident.risk_level)}</strong>
                </div>
                <div>
                    <span>Status</span>
                    <strong>${escapeHtml(incident.status)}</strong>
                </div>
            </div>

            <div class="risk-timeline-track">
                ${items.map((item) => `
                    <div class="risk-timeline-point">
                        <div class="risk-point-value">${escapeHtml(item.value)}</div>
                        <div class="risk-point-marker"></div>
                        <div class="risk-point-type">${escapeHtml(item.type)}</div>
                        <div class="risk-point-title">${escapeHtml(item.title)}</div>
                        <div class="risk-point-time">${escapeHtml(item.timestamp)}</div>
                    </div>
                `).join("")}
            </div>

            <div class="risk-timeline-note">
                Risk values are displayed only where the existing incident evidence provides
                a severity or risk score. No historical risk values are inferred.
            </div>
        `;
    }

    async function loadIncidents() {
        const select = document.getElementById("riskTimelineIncidentSelect");
        if (!select) return;

        const data = await fetchJson("/api/v1/incidents");
        state.incidents = data.incidents || [];

        select.innerHTML = '<option value="">Select incident</option>' +
            state.incidents.map((incident) => `
                <option value="${escapeHtml(incident.id)}">
                    #${escapeHtml(incident.id)} — ${escapeHtml(incident.incident_type)} — ${escapeHtml(incident.severity)}
                </option>
            `).join("");
    }

    async function loadTimeline() {
        const select = document.getElementById("riskTimelineIncidentSelect");
        const status = document.getElementById("riskTimelineStatus");

        if (!select || !status || !select.value) {
            if (status) status.textContent = "Select an incident first.";
            return;
        }

        const incidentId = select.value;
        status.textContent = `Loading risk timeline for incident #${incidentId}...`;

        try {
            const data = await fetchJson(
                `/api/v1/incidents/${incidentId}/timeline`
            );

            render(data.incident, data.timeline || []);

            status.textContent =
                `Timeline loaded — ${data.timeline_count || 0} evidence items.`;
        } catch (error) {
            console.error("Risk Timeline error:", error);
            status.textContent = "Unable to load risk timeline.";
        }
    }

    function init() {
        const panel = ensurePanel();
        if (!panel) return;

        const button = document.getElementById("riskTimelineLoadButton");
        if (button) {
            button.addEventListener("click", loadTimeline);
        }

        loadIncidents().catch((error) => {
            console.error("Risk Timeline incident load error:", error);
            const status = document.getElementById("riskTimelineStatus");
            if (status) status.textContent = "Unable to load incidents.";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
