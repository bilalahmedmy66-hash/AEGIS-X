(function () {
    "use strict";

    const state = {
        incidents: [],
        analysis: null
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Request failed: ${response.status}`);
        }
        return response.json();
    }

    function findAnchor() {
        const headings = Array.from(document.querySelectorAll("h2, h3"));
        return headings.find((heading) =>
            heading.textContent.trim().toLowerCase() === "risk timeline"
        ) || headings.find((heading) =>
            heading.textContent.trim().toLowerCase() === "campaign intelligence"
        ) || headings.find((heading) =>
            heading.textContent.trim().toLowerCase() === "incident management"
        );
    }

    function ensurePanel() {
        let panel = document.getElementById("responsePlaybookPanel");
        if (panel) return panel;

        const anchor = findAnchor();
        if (!anchor) return null;

        panel = document.createElement("section");
        panel.id = "responsePlaybookPanel";
        panel.className = "panel response-playbook-panel";

        panel.innerHTML = `
            <div class="panel-header">
                <div>
                    <h3>Response Playbook Simulator</h3>
                    <p class="response-playbook-subtitle">
                        Evidence-based response recommendation and simulation.
                    </p>
                </div>
            </div>

            <div class="response-playbook-toolbar">
                <label>
                    Incident
                    <select id="responsePlaybookIncidentSelect">
                        <option value="">Select incident</option>
                    </select>
                </label>

                <button id="responsePlaybookAnalyzeButton" type="button">
                    ANALYZE RESPONSE
                </button>
            </div>

            <div id="responsePlaybookStatus" class="response-playbook-status">
                Select an incident to analyze the recommended response.
            </div>

            <div id="responsePlaybookContent" class="response-playbook-content"></div>
        `;

        anchor.closest(".panel, section, .card")?.insertAdjacentElement("afterend", panel)
            || anchor.insertAdjacentElement("afterend", panel);

        return panel;
    }

    function renderAnalysis(incident, response) {
        const content = document.getElementById("responsePlaybookContent");
        if (!content) return;

        const action = response.action || "UNKNOWN";
        const riskScore = response.risk_score ?? incident.risk_score;
        const riskLevel = response.risk_level || incident.risk_level;

        content.innerHTML = `
            <div class="response-summary-grid">
                <div>
                    <span>Incident</span>
                    <strong>#${escapeHtml(incident.id)}</strong>
                </div>
                <div>
                    <span>Risk Score</span>
                    <strong>${escapeHtml(riskScore)}</strong>
                </div>
                <div>
                    <span>Risk Level</span>
                    <strong>${escapeHtml(riskLevel)}</strong>
                </div>
                <div>
                    <span>Recommended Action</span>
                    <strong>${escapeHtml(action)}</strong>
                </div>
            </div>

            <div class="response-playbook-decision">
                <div>
                    <span>Decision Basis</span>
                    <strong>
                        ${escapeHtml(riskLevel)} risk / score ${escapeHtml(riskScore)}
                    </strong>
                </div>
                <div>
                    <span>Execution Mode</span>
                    <strong>SIMULATION ONLY</strong>
                </div>
            </div>

            <div class="response-playbook-warning">
                No real blocking, isolation, network modification, or endpoint action
                is performed. Execution only records a simulated response.
            </div>

            <button
                id="responsePlaybookExecuteButton"
                class="response-execute-button"
                type="button"
            >
                EXECUTE SIMULATION
            </button>

            <div id="responsePlaybookExecution"></div>
        `;

        const executeButton = document.getElementById("responsePlaybookExecuteButton");
        if (executeButton) {
            executeButton.addEventListener("click", executeSimulation);
        }
    }

    async function loadIncidents() {
        const select = document.getElementById("responsePlaybookIncidentSelect");
        if (!select) return;

        const data = await fetchJson("/api/v1/incidents");
        state.incidents = data.incidents || [];

        select.innerHTML =
            '<option value="">Select incident</option>' +
            state.incidents.map((incident) => `
                <option value="${escapeHtml(incident.id)}">
                    #${escapeHtml(incident.id)} — ${escapeHtml(incident.incident_type)} — ${escapeHtml(incident.severity)}
                </option>
            `).join("");
    }

    async function analyzeResponse() {
        const select = document.getElementById("responsePlaybookIncidentSelect");
        const status = document.getElementById("responsePlaybookStatus");

        if (!select || !status || !select.value) {
            if (status) status.textContent = "Select an incident first.";
            return;
        }

        const incidentId = select.value;
        const incident = state.incidents.find(
            (item) => String(item.id) === String(incidentId)
        );

        if (!incident) {
            status.textContent = "Incident data is unavailable.";
            return;
        }

        status.textContent = `Analyzing response for incident #${incidentId}...`;

        try {
            const data = await fetchJson(`/api/v1/incidents/${incidentId}/timeline`);
            const incidentData = data.incident || incident;

            const response = await fetchJson(
                `/api/v1/incidents/${incidentId}/response-preview`
            );

            state.analysis = {
                incident: incidentData,
                response
            };

            renderAnalysis(incidentData, response.response || {});
            status.textContent = "Response analysis loaded.";
        } catch (error) {
            console.error("Response Playbook analysis error:", error);
            status.textContent = "Unable to analyze response.";
        }
    }

    async function executeSimulation() {
        const status = document.getElementById("responsePlaybookStatus");
        const execution = document.getElementById("responsePlaybookExecution");
        const button = document.getElementById("responsePlaybookExecuteButton");

        if (!state.analysis || !execution) return;

        button.disabled = true;
        status.textContent = "Recording simulated response...";

        try {
            const incidentId = state.analysis.incident.id;
            const action = state.analysis.response.response.action;

            const result = await fetchJson(
                `/api/v1/incidents/${incidentId}/respond`,
                {
                    method: "POST"
                }
            );

            execution.innerHTML = `
                <div class="response-execution-result">
                    <div><span>Status</span><strong>${escapeHtml(result.execution?.status || "SIMULATED")}</strong></div>
                    <div><span>Action</span><strong>${escapeHtml(result.execution?.action || action)}</strong></div>
                    <div><span>Mode</span><strong>${escapeHtml(result.execution?.mode || "SIMULATION")}</strong></div>
                    <div><span>Response ID</span><strong>${escapeHtml(result.execution?.response_id || "")}</strong></div>
                </div>
            `;

            status.textContent = "Simulation executed and recorded.";
        } catch (error) {
            console.error("Response Playbook execution error:", error);
            status.textContent = "Unable to execute simulation.";
            button.disabled = false;
        }
    }

    function init() {
        const panel = ensurePanel();
        if (!panel) return;

        const analyzeButton = document.getElementById("responsePlaybookAnalyzeButton");
        if (analyzeButton) {
            analyzeButton.addEventListener("click", analyzeResponse);
        }

        loadIncidents().catch((error) => {
            console.error("Response Playbook incident load error:", error);
            const status = document.getElementById("responsePlaybookStatus");
            if (status) status.textContent = "Unable to load incidents.";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
