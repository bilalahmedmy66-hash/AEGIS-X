(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const runButton = $("runScenarioButton");
    const results = $("scenarioLabResults");

    if (!runButton || !results) {
        return;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderStatus(title, message) {
        results.innerHTML = `
            <div class="scenario-lab-status">
                <span class="eyebrow">LAB STATUS</span>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    function renderResult(data) {
        const simulation = data?.simulation || {};
        const events = Array.isArray(data?.events) ? data.events : [];
        const detection = data?.final_detection || {};

        results.innerHTML = `
            <div class="scenario-result-head">
                <div>
                    <span class="eyebrow">SIMULATION COMPLETED</span>
                    <strong>${escapeHtml(simulation.scenario || "UNKNOWN")}</strong>
                </div>
                <span class="tag">SYNTHETIC TELEMETRY</span>
            </div>

            <div class="scenario-result-grid">
                <div>
                    <span>EVENTS GENERATED</span>
                    <strong>${escapeHtml(simulation.events_generated ?? events.length)}</strong>
                </div>
                <div>
                    <span>EVENT TYPE</span>
                    <strong>${escapeHtml(simulation.event_type || "—")}</strong>
                </div>
                <div>
                    <span>SOURCE IP</span>
                    <strong>${escapeHtml(simulation.source_ip || "—")}</strong>
                </div>
                <div>
                    <span>DETECTION RUNS</span>
                    <strong>${escapeHtml(data?.detection_runs ?? 0)}</strong>
                </div>
            </div>

            <div class="scenario-events">
                <div class="eyebrow">GENERATED EVENTS</div>
                ${
                    events.length
                        ? events.map((event) => `
                            <div class="scenario-event-row">
                                <span>#${escapeHtml(event.event_id)}</span>
                                <strong>${escapeHtml(event.event_type)}</strong>
                                <span>${escapeHtml(event.source_ip)}</span>
                            </div>
                        `).join("")
                        : `<p>No generated event records returned.</p>`
                }
            </div>

            <div class="scenario-detection">
                <div class="eyebrow">DETECTION PIPELINE</div>
                <pre>${escapeHtml(JSON.stringify(detection, null, 2))}</pre>
            </div>

            <div class="scenario-safety-note">
                Simulation only. Synthetic telemetry was generated; no real-world blocking,
                isolation, or network modification is performed.
            </div>
        `;
    }

    runButton.addEventListener("click", async () => {
        const payload = {
            scenario: $("scenarioType").value,
            source_ip: $("scenarioSourceIp").value.trim(),
            user: $("scenarioUser").value.trim(),
            source: $("scenarioSource").value.trim(),
            events: Number($("scenarioEvents").value),
            severity: Number($("scenarioSeverity").value)
        };

        if (!payload.source_ip || !payload.user || !payload.source) {
            renderStatus("INPUT REQUIRED", "Source IP, user, and telemetry source are required.");
            return;
        }

        if (
            !Number.isInteger(payload.events) ||
            payload.events < 1 ||
            payload.events > 20
        ) {
            renderStatus("INVALID EVENT COUNT", "Event count must be between 1 and 20.");
            return;
        }

        if (
            !Number.isInteger(payload.severity) ||
            payload.severity < 1 ||
            payload.severity > 10
        ) {
            renderStatus("INVALID SEVERITY", "Severity must be between 1 and 10.");
            return;
        }

        runButton.disabled = true;
        runButton.textContent = "RUNNING…";
        renderStatus(
            "RUNNING",
            "Generating synthetic telemetry and executing the existing detection pipeline."
        );

        try {
            const response = await fetch("/api/v1/simulator/run", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                const detail =
                    typeof data?.detail === "string"
                        ? data.detail
                        : data?.detail?.message || "Simulation request failed.";

                throw new Error(detail);
            }

            renderResult(data);
        } catch (error) {
            renderStatus(
                "SIMULATION FAILED",
                error?.message || "Unable to run the simulation."
            );
        } finally {
            runButton.disabled = false;
            runButton.textContent = "RUN SIMULATION";
        }
    });
})();
