(() => {
    "use strict";

    const SOC_ID = "aegis-realtime-soc";
    let timer = null;

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function findDashboardAnchor() {
        /*
         * The SOC belongs inside the existing dashboard.
         * Incident Management is a stable anchor because the
         * existing app.js already renders incidentRows there.
         *
         * Never fall back to <main>. That was causing the SOC
         * to appear before the AEGIS X dashboard itself.
         */

        const incidentRows = document.getElementById("incidentRows");

        if (incidentRows) {
            let node = incidentRows;

            for (let i = 0; i < 7 && node; i++, node = node.parentElement) {
                const text = (node.textContent || "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toUpperCase();

                if (
                    text.includes("INCIDENT MANAGEMENT") ||
                    text.includes("OPEN INCIDENTS") ||
                    node.tagName === "SECTION" ||
                    node.tagName === "ARTICLE"
                ) {
                    return node;
                }
            }

            return incidentRows.closest("table")?.parentElement || null;
        }

        /*
         * If the dashboard has not rendered yet, return null.
         * boot() will retry after the existing dashboard appears.
         */
        return null;
    }
    function ensurePanel() {
        const existing = document.getElementById(SOC_ID);
        if (existing) return existing;

        const anchor = findDashboardAnchor();
        if (!anchor || !anchor.parentElement) return null;

        const panel = document.createElement("section");
        panel.id = SOC_ID;
        panel.className = "aegis-soc";
        anchor.parentElement.insertBefore(panel, anchor.nextSibling);

        return panel;
    }
    function metric(value,label) {
        return `
            <div class="aegis-soc-metric">
                <div class="aegis-soc-metric-value">${esc(value)}</div>
                <div class="aegis-soc-metric-label">${esc(label)}</div>
            </div>
        `;
    }

    function activityRow(item) {
        const kind = String(item.kind || "EVENT").toLowerCase();

        return `
            <div class="aegis-soc-feed-row">
                <div class="aegis-soc-feed-kind ${esc(kind)}">${esc(item.kind)}</div>
                <div>
                    <div class="aegis-soc-feed-type">${esc(item.type || "UNKNOWN")}</div>
                    <div class="aegis-soc-feed-source">${esc(item.source_ip || "Unknown source")} · #${esc(item.id)}</div>
                </div>
                <div class="aegis-soc-feed-severity">${esc(item.severity || "—")}</div>
            </div>
        `;
    }

    function render(data) {
        const panel = ensurePanel();

        const threat = data.threat || {};
        const telemetry = data.telemetry || {};
        const system = data.system || {};
        const latest = data.latest_incident || {};
        const activity = Array.isArray(data.activity) ? data.activity : [];

        const latestRisk = Number(threat.latest_risk || 0);

        panel.innerHTML = `
            <div class="aegis-soc-head">
                <div>
                    <div class="aegis-soc-kicker">AEGIS X · OPERATIONS</div>
                    <div class="aegis-soc-title">Real-Time Security Operations</div>
                </div>

                <div class="aegis-soc-state">
                    <span class="aegis-soc-live-dot"></span>
                    ${esc(system.state || "MONITORING")}
                </div>
            </div>

            <div class="aegis-soc-metrics">
                ${metric(threat.active_incidents ?? 0,"Active incidents")}
                ${metric(threat.critical ?? 0,"Critical")}
                ${metric(threat.high ?? 0,"High")}
                ${metric(threat.medium ?? 0,"Medium")}
                ${metric(latestRisk,"Latest risk")}
            </div>

            <div class="aegis-soc-body">

                <div class="aegis-soc-panel">
                    <div class="aegis-soc-panel-head">
                        <div class="aegis-soc-panel-title">Live Security Activity</div>
                        <div class="aegis-soc-panel-meta">
                            ${esc(telemetry.events_observed || 0)} events ·
                            ${esc(telemetry.alerts_observed || 0)} alerts
                        </div>
                    </div>

                    <div class="aegis-soc-feed">
                        ${
                            activity.length
                            ? activity.map(activityRow).join("")
                            : `<div style="padding:22px;color:#64748b;font-size:11px">No recent activity.</div>`
                        }
                    </div>
                </div>

                <div class="aegis-soc-panel">
                    <div class="aegis-soc-panel-head">
                        <div class="aegis-soc-panel-title">Security Brain</div>
                        <div class="aegis-soc-panel-meta">BACKGROUND INTELLIGENCE</div>
                    </div>

                    <div class="aegis-soc-brain">

                        <div class="aegis-soc-brain-state">
                            <span class="aegis-soc-live-dot"></span>
                            ${esc(system.security_brain || "ACTIVE")}
                        </div>

                        <div class="aegis-soc-brain-grid">
                            <div class="aegis-soc-brain-card">
                                <div class="aegis-soc-brain-card-label">Telemetry</div>
                                <div class="aegis-soc-brain-card-value">${esc(system.telemetry || "ACTIVE")}</div>
                            </div>

                            <div class="aegis-soc-brain-card">
                                <div class="aegis-soc-brain-card-label">Detection</div>
                                <div class="aegis-soc-brain-card-value">${esc(system.detection || "ACTIVE")}</div>
                            </div>

                            <div class="aegis-soc-brain-card">
                                <div class="aegis-soc-brain-card-label">Correlation</div>
                                <div class="aegis-soc-brain-card-value">${esc(system.correlation || "ACTIVE")}</div>
                            </div>

                            <div class="aegis-soc-brain-card">
                                <div class="aegis-soc-brain-card-label">Responses</div>
                                <div class="aegis-soc-brain-card-value">${esc(telemetry.responses_observed || 0)}</div>
                            </div>
                        </div>

                        <div class="aegis-soc-latest">
                            <div class="aegis-soc-latest-title">Latest Incident</div>
                            <div class="aegis-soc-latest-name">
                                #${esc(latest.id || "—")} · ${esc(latest.incident_type || "NO ACTIVE INCIDENT")}
                            </div>
                            <div class="aegis-soc-latest-meta">
                                Risk ${esc(latest.risk_score ?? latestRisk)} ·
                                ${esc(latest.risk_level || threat.latest_level || "LOW")} ·
                                ${esc(latest.source_ip || "Unknown source")}
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            <div class="aegis-soc-footer">
                AEGIS Real-Time SOC · telemetry refresh every 5 seconds · read-only intelligence view
            </div>
        `;

        panel.dataset.updated = String(Date.now());
    }

    async function refresh() {
        try {
            const response = await fetch(
                "/api/v1/soc/state",
                {
                    method:"GET",
                    cache:"no-store"
                }
            );

            if (!response.ok) return;

            const data = await response.json();
            render(data);
        } catch (_) {
            /* Dashboard must remain operational if SOC endpoint is unavailable. */
        }
    }

    function start() {
        if (timer) return;

        refresh();
        timer = setInterval(refresh,5000);
    }

    function boot() {
        if (!document.body) return;

        start();

        /*
         * The existing dashboard can render dynamically.
         * Re-check briefly without touching its existing controller.
         */
        let attempts = 0;

        const observer = new MutationObserver(() => {
            attempts++;

            if (document.getElementById(SOC_ID)) {
                observer.disconnect();
                return;
            }

            if (attempts > 30) {
                observer.disconnect();
            }
        });

        observer.observe(document.body,{
            childList:true,
            subtree:true
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded",boot,{once:true});
    } else {
        boot();
    }

    window.AEGISRealtimeSOC = {
        refresh
    };
})();



