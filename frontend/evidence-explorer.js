(function () {
    "use strict";

    const state = {
        incidents: [],
        selectedIncident: null,
        timeline: [],
        graph: null
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
            heading.textContent.trim().toLowerCase() === "incident management"
        ) || headings.find((heading) =>
            heading.textContent.trim().toLowerCase() === "security events"
        );
    }

    function ensurePanel() {
        let panel = document.getElementById("evidenceExplorerPanel");
        if (panel) return panel;

        const anchor = findAnchor();
        if (!anchor) return null;

        panel = document.createElement("section");
        panel.id = "evidenceExplorerPanel";
        panel.className = "panel evidence-explorer-panel";
        panel.innerHTML = `
            <div class="panel-header">
                <div>
                    <h3>Evidence Explorer</h3>
                    <p class="evidence-explorer-subtitle">
                        Read-only incident evidence, timeline, and relationship context.
                    </p>
                </div>
            </div>

            <div class="evidence-explorer-toolbar">
                <label>
                    Incident
                    <select id="evidenceIncidentSelect">
                        <option value="">Select incident</option>
                    </select>
                </label>
                <button id="evidenceLoadButton" type="button">LOAD EVIDENCE</button>
            </div>

            <div id="evidenceExplorerStatus" class="evidence-explorer-status">
                Select an incident to inspect its evidence.
            </div>

            <div id="evidenceExplorerContent" class="evidence-explorer-content"></div>
        `;

        anchor.closest(".panel, section, .card")?.insertAdjacentElement("afterend", panel)
            || anchor.insertAdjacentElement("afterend", panel);

        return panel;
    }

    function renderIncidentSummary(incident) {
        return `
            <div class="evidence-summary-grid">
                <div><span>Type</span><strong>${escapeHtml(incident.incident_type)}</strong></div>
                <div><span>Severity</span><strong>${escapeHtml(incident.severity)}</strong></div>
                <div><span>Risk</span><strong>${escapeHtml(incident.risk_score)} / ${escapeHtml(incident.risk_level)}</strong></div>
                <div><span>Status</span><strong>${escapeHtml(incident.status)}</strong></div>
                <div><span>Source IP</span><strong>${escapeHtml(incident.source_ip)}</strong></div>
            </div>
            <div class="evidence-description">
                ${escapeHtml(incident.description)}
            </div>
        `;
    }

    function renderTimeline(timeline) {
        if (!timeline.length) {
            return "<div class=\"evidence-empty\">No timeline evidence found.</div>";
        }

        return `
            <div class="evidence-section">
                <div class="evidence-section-title">Evidence Timeline</div>
                <div class="evidence-timeline">
                    ${timeline.map((item) => `
                        <div class="evidence-timeline-item">
                            <div class="evidence-timeline-meta">
                                <span class="evidence-type">${escapeHtml(item.type)}</span>
                                <span>${escapeHtml(item.timestamp)}</span>
                            </div>
                            <div class="evidence-timeline-title">${escapeHtml(item.title)}</div>
                            <div class="evidence-timeline-description">${escapeHtml(item.description)}</div>
                            <div class="evidence-timeline-details">
                                ${item.source ? `<span>Source: ${escapeHtml(item.source)}</span>` : ""}
                                ${item.user ? `<span>User: ${escapeHtml(item.user)}</span>` : ""}
                                ${item.source_ip ? `<span>IP: ${escapeHtml(item.source_ip)}</span>` : ""}
                                ${item.severity !== undefined ? `<span>Severity: ${escapeHtml(item.severity)}</span>` : ""}
                                ${item.risk_score !== undefined ? `<span>Risk: ${escapeHtml(item.risk_score)}</span>` : ""}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function renderGraph(graph) {
        if (!graph) return "";

        const counts = graph.node_type_counts || {};

        return `
            <div class="evidence-section">
                <div class="evidence-section-title">Evidence Relationships</div>

                <div class="evidence-graph-summary">
                    <div><span>Nodes</span><strong>${escapeHtml(graph.node_count)}</strong></div>
                    <div><span>Relationships</span><strong>${escapeHtml(graph.edge_count)}</strong></div>
                    ${Object.entries(counts).map(([type, count]) =>
                        `<div><span>${escapeHtml(type)}</span><strong>${escapeHtml(count)}</strong></div>`
                    ).join("")}
                </div>

                <div class="evidence-chain">
                    ${graph.edges.map((edge) => `
                        <div class="evidence-chain-row">
                            <span>${escapeHtml(edge.source)}</span>
                            <b>${escapeHtml(edge.relationship)}</b>
                            <span>${escapeHtml(edge.target)}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function renderContent() {
        const content = document.getElementById("evidenceExplorerContent");
        if (!content || !state.selectedIncident) return;

        content.innerHTML =
            renderIncidentSummary(state.selectedIncident) +
            renderTimeline(state.timeline) +
            renderGraph(state.graph);
    }

    async function loadIncidents() {
        const select = document.getElementById("evidenceIncidentSelect");
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

    async function loadEvidence() {
        const select = document.getElementById("evidenceIncidentSelect");
        const status = document.getElementById("evidenceExplorerStatus");

        if (!select || !status || !select.value) {
            if (status) status.textContent = "Select an incident first.";
            return;
        }

        const incidentId = select.value;
        status.textContent = `Loading evidence for incident #${incidentId}...`;

        try {
            const [timelineData, graphData] = await Promise.all([
                fetchJson(`/api/v1/incidents/${incidentId}/timeline`),
                fetchJson(`/api/v1/incidents/${incidentId}/graph`)
            ]);

            state.selectedIncident = timelineData.incident;
            state.timeline = timelineData.timeline || [];
            state.graph = graphData.graph || null;

            renderContent();

            status.textContent =
                `Evidence loaded — ${state.timeline.length} timeline items. Read-only view.`;
        } catch (error) {
            console.error("Evidence Explorer error:", error);
            status.textContent = "Unable to load incident evidence.";
        }
    }

    function init() {
        const panel = ensurePanel();
        if (!panel) return;

        const button = document.getElementById("evidenceLoadButton");
        if (button) {
            button.addEventListener("click", loadEvidence);
        }

        loadIncidents().catch((error) => {
            console.error("Evidence Explorer incident load error:", error);
            const status = document.getElementById("evidenceExplorerStatus");
            if (status) status.textContent = "Unable to load incidents.";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
