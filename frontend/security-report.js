(() => {
    "use strict";

    const PANEL_ID = "aegis-security-report";

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function findAnchor() {
        const label = Array.from(document.querySelectorAll(".eyebrow"))
            .find((element) =>
                (element.textContent || "").trim().toUpperCase() === "INCIDENT MANAGEMENT"
            );

        return label ? label.closest(".panel") : null;
    }

    function ensurePanel() {
        let panel = document.getElementById(PANEL_ID);

        if (panel) {
            return panel;
        }

        const anchor = findAnchor();

        if (!anchor || !anchor.parentElement) {
            return null;
        }

        panel = document.createElement("section");
        panel.id = PANEL_ID;
        panel.className = "security-report-panel";

        panel.innerHTML = `
            <div class="security-report-header">
                <div>
                    <div class="security-report-kicker">AEGIS X / SECURITY REPORT</div>
                    <h2>Incident Report Generator</h2>
                    <p>Generate a read-only evidence report from stored incident telemetry.</p>
                </div>
                <div class="security-report-controls">
                    <select id="security-report-incident">
                        <option value="">Select incident</option>
                    </select>
                    <button id="security-report-generate" type="button">
                        GENERATE REPORT
                    </button>
                    <button id="security-report-print" type="button" disabled>
                        PRINT REPORT
                    </button>
                </div>
            </div>

            <div id="security-report-status" class="security-report-status">
                Select an incident to generate its report.
            </div>

            <div id="security-report-output" class="security-report-output">
                <div class="security-report-empty">
                    Report output will appear here.
                </div>
            </div>
        `;

        anchor.parentElement.insertBefore(panel, anchor.nextSibling);

        return panel;
    }

    async function loadIncidents() {
        const select = document.getElementById("security-report-incident");

        if (!select) {
            return;
        }

        try {
            const response = await fetch("/api/v1/incidents");

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const incidents = Array.isArray(data) ? data : (data.incidents || []);

            select.innerHTML = `<option value="">Select incident</option>`;

            incidents.forEach((incident) => {
                const option = document.createElement("option");
                option.value = incident.id;
                option.textContent =
                    `#${incident.id} — ${incident.incident_type} — ${incident.risk_level}`;
                select.appendChild(option);
            });
        } catch (error) {
            const status = document.getElementById("security-report-status");

            if (status) {
                status.textContent = `Unable to load incidents: ${error.message}`;
            }
        }
    }

    function renderReport(data) {
        const incident = data.incident || {};
        const summary = data.summary || {};
        const timeline = Array.isArray(data.timeline) ? data.timeline : [];

        const output = document.getElementById("security-report-output");

        if (!output) {
            return;
        }

        output.innerHTML = `
            <div class="security-report-meta">
                <div>
                    <span>REPORT</span>
                    <strong>${esc(data.report_type)}</strong>
                </div>
                <div>
                    <span>VERSION</span>
                    <strong>${esc(data.report_version)}</strong>
                </div>
                <div>
                    <span>MODE</span>
                    <strong>READ-ONLY</strong>
                </div>
                <div>
                    <span>EVIDENCE</span>
                    <strong>${data.evidence_based ? "VERIFIED" : "UNKNOWN"}</strong>
                </div>
            </div>

            <div class="security-report-summary">
                <div class="security-report-section-title">INCIDENT SUMMARY</div>

                <div class="security-report-grid">
                    <div>
                        <span>INCIDENT</span>
                        <strong>#${esc(incident.id)}</strong>
                    </div>
                    <div>
                        <span>TYPE</span>
                        <strong>${esc(incident.incident_type)}</strong>
                    </div>
                    <div>
                        <span>SEVERITY</span>
                        <strong>${esc(incident.severity)}</strong>
                    </div>
                    <div>
                        <span>RISK SCORE</span>
                        <strong>${esc(incident.risk_score)}</strong>
                    </div>
                    <div>
                        <span>RISK LEVEL</span>
                        <strong>${esc(incident.risk_level)}</strong>
                    </div>
                    <div>
                        <span>STATUS</span>
                        <strong>${esc(incident.status)}</strong>
                    </div>
                    <div>
                        <span>SOURCE IP</span>
                        <strong>${esc(incident.source_ip || "N/A")}</strong>
                    </div>
                    <div>
                        <span>TIMELINE ITEMS</span>
                        <strong>${esc(summary.timeline_count)}</strong>
                    </div>
                </div>

                <div class="security-report-description">
                    <span>DESCRIPTION</span>
                    <p>${esc(incident.description)}</p>
                </div>
            </div>

            <div class="security-report-evidence">
                <div class="security-report-section-title">EVIDENCE SUMMARY</div>

                <div class="security-report-counters">
                    <div>
                        <strong>${esc(summary.event_count)}</strong>
                        <span>EVENTS</span>
                    </div>
                    <div>
                        <strong>${esc(summary.alert_count)}</strong>
                        <span>ALERTS</span>
                    </div>
                    <div>
                        <strong>${esc(summary.response_count)}</strong>
                        <span>RESPONSES</span>
                    </div>
                </div>
            </div>

            <div class="security-report-timeline">
                <div class="security-report-section-title">INVESTIGATION TIMELINE</div>

                ${timeline.length
                    ? timeline.map((item) => `
                        <div class="security-report-timeline-item">
                            <div class="security-report-timeline-type">
                                ${esc(item.type)}
                            </div>
                            <div class="security-report-timeline-main">
                                <strong>${esc(item.title)}</strong>
                                <span>${esc(item.timestamp)}</span>
                                <p>${esc(item.description)}</p>
                            </div>
                        </div>
                    `).join("")
                    : `<div class="security-report-empty">No timeline evidence available.</div>`
                }
            </div>

            <div class="security-report-limitations">
                <div class="security-report-section-title">REPORT SCOPE</div>
                ${(data.limitations || []).map((item) =>
                    `<div>• ${esc(item)}</div>`
                ).join("")}
            </div>
        `;
    }

    async function generateReport() {
        const select = document.getElementById("security-report-incident");
        const status = document.getElementById("security-report-status");
        const printButton = document.getElementById("security-report-print");

        if (!select || !select.value) {
            if (status) {
                status.textContent = "Select an incident first.";
            }
            return;
        }

        if (status) {
            status.textContent = "Generating evidence report...";
        }

        try {
            const response = await fetch(
                `/api/v1/security-reports/incidents/${encodeURIComponent(select.value)}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `HTTP ${response.status}`);
            }

            renderReport(data);

            if (printButton) {
                printButton.disabled = false;
            }

            if (status) {
                status.textContent =
                    `Report generated for incident #${select.value}.`;
            }
        } catch (error) {
            if (status) {
                status.textContent = `Report generation failed: ${error.message}`;
            }
        }
    }

    function initialize() {
        const panel = ensurePanel();

        if (!panel) {
            setTimeout(initialize, 1000);
            return;
        }

        loadIncidents();

        document
            .getElementById("security-report-generate")
            ?.addEventListener("click", generateReport);

        document
            .getElementById("security-report-print")
            ?.addEventListener("click", () => window.print());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
