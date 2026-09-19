
window.activeInvestigationIncidentId = null;

// ============================================================
// AEGIS_AUTO_FIX_START
// ============================================================

async function autoFixIncident(incidentId) {
    try {
        if (!incidentId) {
            showToast("Invalid incident ID", "error");
            return;
        }

        showToast("Preparing remediation plan...", "info");

        const previewResponse = await fetch(
            `/api/v1/incidents/${incidentId}/auto-fix/preview`
        );

        if (!previewResponse.ok) {
            throw new Error(
                `Preview failed (${previewResponse.status})`
            );
        }

        const previewData = await previewResponse.json();
        const preview = previewData.preview;

        const action =
            preview?.recommended_action || "NO_ACTION";

        const source =
            preview?.source_ip || "Unknown source";

        const risk =
            preview?.risk_level || "UNKNOWN";

        const message =
            "AEGIS X AUTO-FIX\n\n" +
            "Incident: #" + incidentId + "\n" +
            "Type: " + (preview?.incident_type || "Unknown") + "\n" +
            "Source: " + source + "\n" +
            "Risk: " + risk + "\n" +
            "Recommended action: " + action + "\n\n" +
            "This action runs in SIMULATION mode only.\n\n" +
            "Continue?";

        const confirmed = window.confirm(message);

        if (!confirmed) {
            showToast("Auto-fix cancelled", "info");
            return;
        }

        showToast("Executing remediation...", "info");

        const response = await fetch(
            `/api/v1/incidents/${incidentId}/auto-fix`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result?.detail ||
                `Auto-fix failed (${response.status})`
            );
        }

        if (result.success) {
            const verified =
                result.audit_verified === true;

            showToast(
                verified
                    ? "AUTO-FIX completed and verified"
                    : "AUTO-FIX completed",
                "success"
            );

            setTimeout(() => {
                try {
                    if (typeof load === "function") {
                        load();
                    }
                } catch (_) {}

                try {
                    if (typeof investigate === "function") {
                        investigate(incidentId);
                    }
                } catch (_) {}
            }, 600);
        }
        else {
            showToast("Auto-fix did not complete", "error");
        }

    } catch (error) {
        console.error("AEGIS X AUTO-FIX ERROR:", error);

        showToast(
            error?.message || "Auto-fix failed",
            "error"
        );
    }
}


// Make the function globally available.
window.autoFixIncident = autoFixIncident;

// AEGIS_AUTO_FIX_END


let activeInvestigationIncidentId = null;
/* ============================================================
   AEGIS X — FRONTEND CONTROLLER
   ============================================================ */

const $ = id => document.getElementById(id);

let currentIncidentId = null;


/* ============================================================
   API
   ============================================================ */

async function api(
    path,
    options = {}
) {

    const response =
        await fetch(
            path,
            {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                }
            }
        );


    if (!response.ok) {

        let message =
            `HTTP ${response.status}`;

        try {

            const data =
                await response.json();

            if (data?.detail) {
                message = data.detail;
            }

        } catch (_) {}

        throw new Error(message);
    }


    return response.json();
}


/* ============================================================
   HELPERS
   ============================================================ */

function esc(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function time(value) {

    if (!value) {
        return "—";
    }

    try {

        return new Date(value).toLocaleString(
            undefined,
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

    } catch (_) {

        return String(value);

    }
}


function normalizeStatus(value) {

    return String(
        value || ""
    )
        .trim()
        .toUpperCase()
        .replaceAll(" ", "_");
}


function toast(message) {

    const element =
        $("toast");

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.classList.add(
        "show"
    );

    setTimeout(
        () => {
            element.classList.remove(
                "show"
            );
        },
        2800
    );
}


/* ============================================================
   DASHBOARD RENDERING
   ============================================================ */

function renderDetections(
    detections,
    alerts
) {

    const container =
        $("detections");

    if (!container) {
        return;
    }


    const list =
        Array.isArray(
            detections?.detections
        )
            ? detections.detections
            : Array.isArray(
                alerts?.alerts
            )
                ? alerts.alerts
                : [];


    if (!list.length) {

        container.innerHTML =
            `<div class="empty">No detections.</div>`;

        return;
    }


    container.innerHTML =
        list.slice(0, 3)
            .map(
                item => `

                    <div class="detection">

                        <div class="rowline">

                            <strong>
                                ${esc(
                                    item.alert_type ||
                                    item.type ||
                                    item.event_type ||
                                    "DETECTION"
                                )}
                            </strong>

                            <span class="risk">
                                ${esc(
                                    item.risk_level ||
                                    item.severity ||
                                    "UNKNOWN"
                                )}
                            </span>

                        </div>

                        <div class="meta">

                            Source:
                            ${esc(
                                item.source_ip ||
                                "N/A"
                            )}

                            · Risk:
                            ${esc(
                                item.risk_score ??
                                0
                            )}

                        </div>

                    </div>

                `
            )
            .join("");
}


function renderResponses(
    responses
) {

    const container =
        $("responses");

    if (!container) {
        return;
    }


    const list =
        Array.isArray(
            responses?.responses
        )
            ? responses.responses
            : [];


    if (!list.length) {

        container.innerHTML =
            `<div class="empty">No response actions recorded.</div>`;

        return;
    }


    container.innerHTML =
        list.slice(0, 3)
            .map(
                item => `

                    <div class="activity">

                        <div class="rowline">

                            <strong>
                                ${esc(
                                    item.action ||
                                    "RESPONSE"
                                )}
                            </strong>

                            <span class="status">
                                ${esc(
                                    item.status ||
                                    "SIMULATED"
                                )}
                            </span>

                        </div>

                        <small>

                            Incident #
                            ${esc(
                                item.incident_id ??
                                "N/A"
                            )}

                            ·

                            ${esc(
                                item.source_ip ||
                                "N/A"
                            )}

                            ·

                            ${esc(
                                time(
                                    item.executed_at ||
                                    item.created_at
                                )
                            )}

                        </small>

                    </div>

                `
            )
            .join("");
}


function renderIncidents(
    data
) {

    const container =
        $("incidentRows");

    if (!container) {
        return;
    }


    const list =
        Array.isArray(
            data?.incidents
        )
            ? data.incidents
            : [];


    if (!list.length) {

        container.innerHTML = `

            <tr>
                <td
                    colspan="8"
                    class="empty"
                >
                    No incidents.
                </td>
            </tr>

        `;

        return;
    }


    container.innerHTML =
        list.map(
            incident => {

                const status =
                    normalizeStatus(
                        incident.status ||
                        "OPEN"
                    );


                return `

                    <tr>

                        <td>
                            #${esc(
                                incident.id
                            )}
                        </td>

                        <td>
                            <strong>
                                ${esc(
                                    incident.incident_type ||
                                    "UNKNOWN"
                                )}
                            </strong>
                        </td>

                        <td>
                            ${esc(
                                incident.source_ip ||
                                "N/A"
                            )}
                        </td>

                        <td>
                            <span class="risk-badge">
                                ${esc(
                                    incident.risk_score ??
                                    0
                                )}
                            </span>
                        </td>

                        <td>
                            ${esc(
                                incident.risk_level ||
                                "UNKNOWN"
                            )}
                        </td>

                        <td>
                            ${esc(status)}
                        </td>

                        <td>
                            ${esc(
                                time(
                                    incident.last_seen
                                )
                            )}
                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    class="action-btn investigate-btn"
                                    onclick="investigate(${incident.id})"
                                >
                                    INVESTIGATE
                                </button>
                                <button
                                    class="action-btn auto-fix-btn"
                                    type="button"
                                    onclick="autoFixIncident(${incident.id})"
                                >
                                    AUTO-FIX
                                </button>

                                ${
                                    status !== "RESOLVED"
                                        ? `
                                            <button
                                                class="action-btn"
                                                onclick="respond(${incident.id})"
                                            >
                                                RESPOND
                                            </button>
                                          `
                                        : ""
                                }

                                ${
                                    status === "OPEN"
                                        ? `
                                            <button
                                                class="action-btn"
                                                onclick="setIncident(${incident.id}, 'ACKNOWLEDGED')"
                                            >
                                                ACK
                                            </button>
                                          `
                                        : ""
                                }

                                ${
                                    status === "ACKNOWLEDGED"
                                        ? `
                                            <button
                                                class="action-btn"
                                                onclick="setIncident(${incident.id}, 'RESOLVED')"
                                            >
                                                RESOLVE
                                            </button>
                                          `
                                        : ""
                                }

                            </div>

                        </td>

                    </tr>

                `;

            }
        )
        .join("");
}


function renderAlerts(
    data
) {

    const container =
        $("alertRows");

    if (!container) {
        return;
    }


    const list =
        Array.isArray(
            data?.alerts
        )
            ? data.alerts
            : [];


    if (!list.length) {

        container.innerHTML = `

            <tr>
                <td
                    colspan="7"
                    class="empty"
                >
                    No alerts.
                </td>
            </tr>

        `;

        return;
    }


    container.innerHTML =
        list.map(
            alert => `

                <tr>

                    <td>
                        #${esc(alert.id)}
                    </td>

                    <td>
                        ${esc(
                            alert.alert_type ||
                            alert.type ||
                            "UNKNOWN"
                        )}
                    </td>

                    <td>
                        ${esc(
                            alert.source_ip ||
                            "N/A"
                        )}
                    </td>

                    <td>
                        <span class="risk-badge">
                            ${esc(
                                alert.risk_score ??
                                0
                            )}
                        </span>
                    </td>

                    <td>
                        ${esc(
                            alert.risk_level ||
                            alert.severity ||
                            "UNKNOWN"
                        )}
                    </td>

                    <td>
                        ${esc(
                            alert.status ||
                            "NEW"
                        )}
                    </td>

                    <td>
                        ${esc(
                            time(
                                alert.created_at
                            )
                        )}
                    </td>

                </tr>

            `
        )
        .join("");
}


function renderEvents(
    data
) {

    const container =
        $("eventRows");

    if (!container) {
        return;
    }


    const list =
        Array.isArray(
            data?.events
        )
            ? data.events
            : [];


    if (!list.length) {

        container.innerHTML = `

            <tr>
                <td
                    colspan="7"
                    class="empty"
                >
                    No security events.
                </td>
            </tr>

        `;

        return;
    }


    container.innerHTML =
        list.map(
            event => `

                <tr>

                    <td>
                        #${esc(event.id)}
                    </td>

                    <td>
                        ${esc(
                            event.event_type ||
                            event.type ||
                            "UNKNOWN"
                        )}
                    </td>

                    <td>
                        ${esc(
                            event.source_ip ||
                            "N/A"
                        )}
                    </td>

                    <td>
                        ${esc(
                            event.source_host ||
                            event.host ||
                            "N/A"
                        )}
                    </td>

                    <td>
                        ${esc(
                            event.username ||
                            "N/A"
                        )}
                    </td>

                    <td>
                        ${esc(
                            event.severity ??
                            "N/A"
                        )}
                    </td>

                    <td>
                        ${esc(
                            time(
                                event.timestamp ||
                                event.created_at
                            )
                        )}
                    </td>

                </tr>

            `
        )
        .join("");
}


/* ============================================================
   MAIN LOAD
   ============================================================ */

async function load() {

    try {

        const [
            health,
            events,
            alerts,
            incidents,
            responses,
            detections
        ] = await Promise.all([

            api("/health"),
            api("/api/v1/events"),
            api("/api/v1/alerts"),
            api("/api/v1/incidents"),
            api("/api/v1/responses"),
            api("/api/v1/detections")

        ]);


        const eventList =
            Array.isArray(events?.events)
                ? events.events
                : [];


        const alertList =
            Array.isArray(alerts?.alerts)
                ? alerts.alerts
                : [];


        const incidentList =
            Array.isArray(incidents?.incidents)
                ? incidents.incidents
                : [];


        const responseList =
            Array.isArray(responses?.responses)
                ? responses.responses
                : [];


        const activeAlerts =
            alertList.filter(
                item =>
                    normalizeStatus(
                        item.status ||
                        "NEW"
                    ) !== "RESOLVED"
            );


        const openIncidents =
            incidentList.filter(
                item =>
                    normalizeStatus(
                        item.status ||
                        "OPEN"
                    ) !== "RESOLVED"
            );


        const highestRisk =
            openIncidents.length
                ? Math.max(
                    ...openIncidents.map(
                        item =>
                            Number(
                                item.risk_score ||
                                0
                            )
                    )
                )
                : 0;


        const healthText =
            $("healthText");

        if (healthText) {

            healthText.textContent =
                health?.status === "healthy"
                    ? "Operational"
                    : "Degraded";

        }


        const healthDot =
            $("healthDot");

        if (healthDot) {

            healthDot.classList.toggle(
                "healthy",
                health?.status === "healthy"
            );

        }


        $("eventsCount").textContent =
            eventList.length;


        $("activeAlerts").textContent =
            activeAlerts.length;


        $("openIncidents").textContent =
            openIncidents.length;


        $("highestRisk").textContent =
            highestRisk;

        const socEventStatus =
            $("socEventStatus");

        if (socEventStatus) {
            socEventStatus.textContent =
                `${eventList.length} EVENTS`;
        }

        const socAlertStatus =
            $("socAlertStatus");

        if (socAlertStatus) {
            socAlertStatus.textContent =
                `${activeAlerts.length} ALERTS`;
        }

        const socIncidentStatus =
            $("socIncidentStatus");

        if (socIncidentStatus) {
            socIncidentStatus.textContent =
                `${openIncidents.length} INCIDENTS`;
        }

        const socRiskStatus =
            $("socRiskStatus");

        if (socRiskStatus) {
            socRiskStatus.textContent =
                `RISK ${highestRisk}`;
        }


        const detectionTag =
            $("detectionTag");

        if (detectionTag) {

            detectionTag.textContent =
                `${alertList.length} detected`;

        }


        const responseTag =
            $("responseTag");

        if (responseTag) {

            responseTag.textContent =
                `${responseList.length} actions`;

        }


        const lastUpdated =
            $("lastUpdated");

        if (lastUpdated) {

            lastUpdated.textContent =
                `Updated ${new Date().toLocaleTimeString()}`;

        }


        renderDetections(
            detections,
            alerts
        );

        renderResponses(
            responses
        );

        renderIncidents(
            incidents
        );

        renderAlerts(
            alerts
        );

        renderEvents(
            events
        );


        console.log(
            "AEGIS X dashboard loaded successfully."
        );

    } catch (error) {

        console.error(
            "AEGIS X dashboard error:",
            error
        );

        const healthText =
            $("healthText");

        if (healthText) {
            healthText.textContent =
                "Unavailable";
        }

        toast(
            error.message
        );

    }

}


/* ============================================================
   INCIDENT ACTIONS
   ============================================================ */

async function setIncident(
    id,
    status
) {

    try {

        await api(
            `/api/v1/incidents/${id}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    status
                })
            }
        );

        toast(
            `Incident #${id}: ${status}`
        );

        await load();

    } catch (error) {

        console.error(error);

        toast(
            error.message
        );

    }

}


async function respond(
    id
) {

    try {

        const result =
            await api(
                `/api/v1/incidents/${id}/respond`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        action: "BLOCK_SOURCE",
                        mode: "SIMULATION"
                    })
                }
            );


        toast(
            result?.message ||
            `Response executed for Incident #${id}`
        );


        await load();

    } catch (error) {

        console.error(error);

        toast(
            error.message
        );

    }

}


/* ============================================================
   INVESTIGATION
   ============================================================ */

async function investigate(
    id
) {
    activeInvestigationIncidentId = id;

    currentIncidentId =
        id;


    const overlay =
        $("investigationOverlay");


    if (!overlay) {

        toast(
            "Investigation interface not found."
        );

        return;
    }


    overlay.classList.add(
        "open"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    $("investigationTitle").textContent =
        `Incident #${id}`;


    $("investigationSubtitle").textContent =
        "Loading security intelligence...";


    $("investigationContent").innerHTML = `

        <section class="investigation-section">

            <div class="investigation-loading">

                <div class="investigation-spinner"></div>

                Loading investigation...

            </div>

        </section>

    `;


    try {

        const [
            investigation,
            timeline,
            graph
        ] = await Promise.all([

            api(
                `/api/v1/incidents/${id}/investigation`
            ),

            api(
                `/api/v1/incidents/${id}/timeline`
            ),

            api(
                `/api/v1/incidents/${id}/graph`
            )

        ]);


        renderInvestigation(
            investigation,
            timeline,
            graph
        );


    } catch (error) {

        console.error(
            "Investigation error:",
            error
        );


        $("investigationContent").innerHTML = `

            <div class="investigation-error">

                <strong>
                    Investigation unavailable
                </strong>

                <p>
                    ${esc(error.message)}
                </p>

                <button
                    class="action-btn"
                    onclick="investigate(${id})"
                >
                    RETRY
                </button>

            </div>

        `;

    }

}


function closeInvestigation() {

    const overlay =
        $("investigationOverlay");

    if (!overlay) {
        return;
    }

    overlay.classList.remove(
        "open"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* ============================================================
   INVESTIGATION RENDERER
   ============================================================ */

function renderInvestigation(
    investigation,
    timelineData,
    graph
) {

    const incident =
        investigation?.incident ||
        graph?.incident ||
        {};


    const timeline =
        Array.isArray(
            timelineData?.timeline
        )
            ? timelineData.timeline
            : [];


    $("investigationTitle").textContent =
        `Incident #${incident.id ?? "—"}`;


    $("investigationSubtitle").textContent =
        `${incident.incident_type || "SECURITY INCIDENT"} · ${incident.source_ip || "Unknown source"}`;


    const content =
        $("investigationContent");


    
content.innerHTML = `

        <section class="evidence-chain-panel">
            <div id="aiInvestigationEvidenceChain"></div>
        </section>


        <div id="aiInvestigationContainer"></div>

        <section class="investigation-section">

            <div id="attackStory"></div>

        </section>


        <section class="investigation-section">

            <div class="investigation-section-header">

                <div>

                    <div class="eyebrow">
                        SECURITY GRAPH
                    </div>

                    <h3>
                        Security Relationship Graph
                    </h3>

                    <p>
                        Correlated entities, detections,
                        risk and response relationships.
                    </p>

                </div>

                <div id="graphStats" class="graph-stats"></div>

            </div>

            <div id="securityGraph"></div>

            <div id="graphLegend" class="graph-legend"></div>

        </section>


        <section class="investigation-section">

            <div class="investigation-section-header">

                <div>

                    <div class="eyebrow">
                        INVESTIGATION TIMELINE
                    </div>

                    <h3>
                        Evidence &amp; Response History
                    </h3>

                </div>

            </div>

            <div
                id="investigationTimeline"
                class="investigation-timeline"
            ></div>

        </section>

    `;


    renderAIInvestigation(
        investigation,
        incident
    );

    renderInvestigationEvidenceChain(
        investigation,
        incident
    );


    renderAttackStory(
        graph,
        incident
    );


    renderSecurityGraph(
        graph
    );


    renderTimeline(
        timeline
    );

}


/* ============================================================
   AI INVESTIGATION
   ============================================================ */


function positionInvestigationEvidenceChain() {
    const evidence =
        document.getElementById(
            "aiInvestigationEvidenceChain"
        );

    const investigationContent =
        document.getElementById(
            "investigationContent"
        );

    if (!evidence || !investigationContent) {
        return;
    }

    investigationContent.prepend(
        evidence.parentElement || evidence
    );
}
function renderInvestigationEvidenceChain(
    data,
    incident
) {
    const content =
        document.getElementById(
            "aiInvestigationEvidenceChain"
        );

    if (!content) {
        return;
    }

    const analysis =
        data?.analysis || {};

    const threat =
        data?.threat_assessment || {};

    const story =
        data?.attack_story || {};

    const mitre =
        data?.mitre_attack || {};

    const evidence =
        Array.isArray(data?.evidence)
            ? data.evidence
            : [];

    const responses =
        Array.isArray(data?.responses)
            ? data.responses
            : [];

    const progression =
        Array.isArray(story.progression)
            ? story.progression
            : [];

    const techniques =
        Array.isArray(mitre.techniques)
            ? mitre.techniques
            : [];

    const eventCount =
        analysis.event_count ??
        evidence.filter(
            item =>
                String(
                    item?.source || ""
                ).toUpperCase() === "EVENT"
        ).length;

    const alertCount =
        analysis.alert_count ??
        evidence.filter(
            item =>
                String(
                    item?.source || ""
                ).toUpperCase() === "ALERT"
        ).length;

    const responseCount =
        analysis.response_count ??
        responses.length;

    const riskScore =
        threat.risk_score ??
        incident.risk_score ??
        0;

    const riskLevel =
        threat.priority ||
        incident.risk_level ||
        "UNKNOWN";

    const stageHtml =
        progression.length
            ? progression
                .map(
                    (stage, index) => `
                        <div class="evidence-chain-stage">
                            <span>
                                ${esc(stage)}
                            </span>
                            ${
                                index <
                                progression.length - 1
                                    ? `
                                        <b>
                                            &rarr;
                                        </b>
                                    `
                                    : ""
                            }
                        </div>
                    `
                )
                .join("")
            : `
                <div class="evidence-chain-empty">
                    No attack progression available.
                </div>
            `;

    const mitreHtml =
        mitre.mapped && techniques.length
            ? techniques
                .map(
                    technique => `
                        <div class="evidence-mitre-item">

                            <div>
                                <strong>
                                    ${esc(
                                        technique.id ||
                                        "TECHNIQUE"
                                    )}
                                </strong>

                                <span>
                                    ${esc(
                                        technique.name ||
                                        "Unknown"
                                    )}
                                </span>
                            </div>

                            ${
                                technique.confidence !== undefined
                                    ? `
                                        <b>
                                            ${esc(
                                                technique.confidence
                                            )}%
                                        </b>
                                    `
                                    : ""
                            }

                        </div>
                    `
                )
                .join("")
            : `
                <div class="evidence-chain-empty">
                    No deterministic MITRE technique mapping
                    was established from the available evidence.
                </div>
            `;

    content.innerHTML = `

        <div class="evidence-chain-header">

            <div>
                <div class="investigation-label">
                    EVIDENCE CHAIN
                </div>

                <h3>
                    Explainable Investigation Path
                </h3>

                <p>
                    Each conclusion is tied to observed
                    security evidence.
                </p>
            </div>

            <div class="evidence-chain-risk">

                <span>
                    RISK
                </span>

                <strong>
                    ${esc(riskScore)}
                </strong>

                <small>
                    ${esc(riskLevel)}
                </small>

            </div>

        </div>


        <div class="evidence-chain-metrics">

            <div>
                <strong>
                    ${esc(eventCount)}
                </strong>
                <span>Events</span>
            </div>

            <div>
                <strong>
                    ${esc(alertCount)}
                </strong>
                <span>Alerts</span>
            </div>

            <div>
                <strong>
                    ${esc(responseCount)}
                </strong>
                <span>Responses</span>
            </div>

            <div>
                <strong>
                    ${esc(
                        mitre.mapped
                            ? techniques.length
                            : 0
                    )}
                </strong>
                <span>MITRE Techniques</span>
            </div>

        </div>


        <div class="evidence-chain-flow">

            <div class="evidence-chain-node">
                <span>01</span>
                <strong>OBSERVE</strong>
                <small>
                    ${esc(eventCount)}
                    security events
                </small>
            </div>

            <div class="evidence-chain-arrow">
                &rarr;
            </div>

            <div class="evidence-chain-node">
                <span>02</span>
                <strong>DETECT</strong>
                <small>
                    ${esc(alertCount)}
                    detection alerts
                </small>
            </div>

            <div class="evidence-chain-arrow">
                &rarr;
            </div>

            <div class="evidence-chain-node">
                <span>03</span>
                <strong>ASSESS</strong>
                <small>
                    Risk ${esc(riskScore)}
                </small>
            </div>

            <div class="evidence-chain-arrow">
                &rarr;
            </div>

            <div class="evidence-chain-node">
                <span>04</span>
                <strong>INVESTIGATE</strong>
                <small>
                    Incident #${esc(
                        incident.id ?? "—"
                    )}
                </small>
            </div>

        </div>


        <div class="evidence-chain-section">

            <div class="investigation-label">
                ATTACK PROGRESSION
            </div>

            <div class="evidence-chain-progression">
                ${stageHtml}
            </div>

        </div>


        <div class="evidence-chain-section">

            <div class="investigation-label">
                MITRE ATT&amp;CK COVERAGE
            </div>

            <div class="evidence-mitre-list">
                ${mitreHtml}
            </div>

        </div>

    `;
}

function renderAIInvestigation(
    data,
    incident
) {

    const container =
        $("aiInvestigationContainer");


    if (!container) {
        return;
    }


    const threat =
        data?.threat_assessment ||
        {};


    const story =
        data?.attack_story ||
        {};


    const mitre =
        data?.mitre_attack ||
        {};


    const evidence =
        Array.isArray(
            data?.evidence
        )
            ? data.evidence
            : [];


    const recommendations =
        Array.isArray(
            data?.recommendations
        )
            ? data.recommendations
            : [];


    const confidence =
        data?.confidence?.score ??
        0;


    const analysis =
        data?.analysis ||
        {};


    const progression =
        Array.isArray(
            story.progression
        )
            ? story.progression
            : [];


    const tactics =
        Array.isArray(
            mitre.tactics
        )
            ? mitre.tactics
            : [];


    const techniques =
        Array.isArray(
            mitre.techniques
        )
            ? mitre.techniques
            : [];


    container.innerHTML = `

        <section class="investigation-section ai-investigation-section">

            <div class="investigation-section-header">

                <div>

                    <div class="eyebrow">
                        AEGIS X AI INVESTIGATION ENGINE
                    </div>

                    <h3>
                        Explainable Threat Assessment
                    </h3>

                    <p>
                        Local explainable analysis based on
                        correlated security evidence.
                    </p>

                </div>

                <span class="ai-engine-badge">
                    LOCAL EXPLAINABLE AI
                </span>

            </div>


            <div class="ai-threat-grid">

                <div class="ai-threat-card">

                    <span>
                        PRIORITY
                    </span>

                    <strong class="risk-${esc(
                        threat.priority ||
                        incident.risk_level ||
                        "LOW"
                    )}">
                        ${esc(
                            threat.priority ||
                            incident.risk_level ||
                            "UNKNOWN"
                        )}
                    </strong>

                </div>


                <div class="ai-threat-card">

                    <span>
                        RISK SCORE
                    </span>

                    <strong>
                        ${esc(
                            threat.risk_score ??
                            incident.risk_score ??
                            0
                        )}
                    </strong>

                </div>


                <div class="ai-threat-card">

                    <span>
                        CLASSIFICATION
                    </span>

                    <strong>
                        ${esc(
                            threat.classification ||
                            story.classification ||
                            "Unknown"
                        )}
                    </strong>

                </div>


                <div class="ai-threat-card">

                    <span>
                        CONFIDENCE
                    </span>

                    <strong>
                        ${esc(confidence)}%
                    </strong>

                </div>

            </div>


            <div class="ai-assessment">

                <div class="eyebrow">
                    THREAT ASSESSMENT
                </div>

                <p>
                    ${esc(
                        threat.assessment ||
                        "No assessment available."
                    )}
                </p>

            </div>


            <div class="ai-attack-progression">

                <div class="eyebrow">
                    ATTACK PROGRESSION
                </div>

                <div class="ai-stage-flow">

                    ${
                        progression.length
                            ? progression.map(
                                (stage, index) => `

                                    <span class="ai-stage">

                                        <b>
                                            ${index + 1}
                                        </b>

                                        ${esc(
                                            String(stage)
                                                .replaceAll(
                                                    "_",
                                                    " "
                                                )
                                        )}

                                    </span>

                                    ${
                                        index <
                                        progression.length - 1
                                            ? `
                                                <span class="ai-stage-arrow">
                                                    →
                                                </span>
                                              `
                                            : ""
                                    }

                                `
                            ).join("")
                            : `
                                <span class="empty">
                                    No progression available.
                                </span>
                              `
                    }

                </div>

            </div>


            <div class="ai-mitre ai-evidence">

                <div class="investigation-section-header">

                    <div>

                        <div class="eyebrow">
                            MITRE ATT&amp;CK
                        </div>

                        <h3>
                            Technique Mapping
                        </h3>

                    </div>

                    <span class="mitre-status">
                        ${
                            mitre.mapped
                                ? "MAPPED"
                                : "NOT MAPPED"
                        }
                    </span>

                </div>


                <div class="mitre-tactics">

                    ${
                        tactics.length
                            ? tactics.map(
                                tactic => `

                                    <span class="mitre-tag">

                                        ${esc(tactic.id)}
                                        ·
                                        ${esc(tactic.name)}

                                    </span>

                                `
                            ).join("")
                            : ""
                    }

                </div>


                ${
                    techniques.length
                        ? techniques.map(
                            technique => `

                                <div class="mitre-technique">

                                    <div>

                                        <strong>
                                            ${esc(
                                                technique.id
                                            )}
                                        </strong>

                                        <span>
                                            ${esc(
                                                technique.name
                                            )}
                                        </span>

                                    </div>

                                    <div class="mitre-confidence">
                                        Confidence:
                                        ${esc(
                                            technique.confidence ??
                                            confidence
                                        )}%
                                    </div>

                                    <p>
                                        ${esc(
                                            technique.reason ||
                                            ""
                                        )}
                                    </p>

                                </div>

                            `
                        ).join("")
                        : `
                            <div class="empty">
                                No MITRE ATT&amp;CK techniques mapped.
                            </div>
                          `
                }

            </div>


            <div class="ai-evidence">

                <div class="eyebrow">
                    EVIDENCE
                </div>

                ${
                    evidence.length
                        ? evidence.map(
                            item => `

                                <div class="evidence-item">

                                    <div class="evidence-header">

                                        <strong>
                                            ${esc(
                                                item.type ||
                                                "EVIDENCE"
                                            )}
                                        </strong>

                                        <span class="evidence-strength">
                                            ${esc(
                                                item.strength ||
                                                "MEDIUM"
                                            )}
                                        </span>

                                    </div>

                                    <p>
                                        ${esc(
                                            item.finding ||
                                            item.description ||
                                            ""
                                        )}
                                    </p>

                                </div>

                            `
                        ).join("")
                        : `
                            <div class="empty">
                                No evidence available.
                            </div>
                          `
                }

            </div>


            <div class="ai-recommendations">

                <div class="eyebrow">
                    RECOMMENDATIONS
                </div>

                ${
                    recommendations.length
                        ? recommendations.map(
                            item => `

                                <div class="recommendation-item">

                                    <div class="recommendation-header">

                                        <strong>
                                            ${esc(
                                                item.action ||
                                                "Review"
                                            )}
                                        </strong>

                                        <span class="recommendation-priority">
                                            ${esc(
                                                item.priority ||
                                                "MEDIUM"
                                            )}
                                        </span>

                                    </div>

                                    <p>
                                        ${esc(
                                            item.reason ||
                                            ""
                                        )}
                                    </p>

                                </div>

                            `
                        ).join("")
                        : `
                            <div class="empty">
                                No recommendations available.
                            </div>
                          `
                }

            </div>


            <div class="ai-analysis-summary">

                <div class="eyebrow">
                    INVESTIGATION ANALYSIS
                </div>

                <div class="analysis-stat-grid">

                    <div>
                        <span>EVENTS</span>
                        <strong>
                            ${esc(
                                analysis.event_count ??
                                0
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>ALERTS</span>
                        <strong>
                            ${esc(
                                analysis.alert_count ??
                                0
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>ATTACK STAGES</span>
                        <strong>
                            ${esc(
                                analysis.attack_stage_count ??
                                progression.length
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>ACTIVITY</span>
                        <strong>
                            ${esc(
                                analysis.activity_count ??
                                0
                            )}
                        </strong>
                    </div>

                </div>

            </div>


            ${
                data?.conclusion
                    ? `

                        <div class="ai-conclusion">

                            <div class="eyebrow">
                                CONCLUSION
                            </div>

                            <p>
                                ${esc(
                                    data.conclusion
                                )}
                            </p>

                        </div>

                      `
                    : ""
            }

        </section>

    `;

}


/* ============================================================
   ATTACK STORY
   ============================================================ */

function renderAttackStory(
    graph,
    incident
) {

    const container =
        $("attackStory");


    if (!container) {
        return;
    }


    const story =
        graph?.attack_story ||
        {};


    const source =
        story.source ||
        incident.source_ip ||
        "Unknown";


    const detection =
        story.detection ||
        incident.incident_type ||
        "Unknown";


    const risk =
        story.risk ||
        {};


    const progression =
        Array.isArray(
            story.progression
        )
            ? story.progression
            : [];


    const responses =
        Array.isArray(
            story.responses
        )
            ? story.responses
            : [];


    container.innerHTML = `

        <div class="investigation-section-header">

            <div>

                <div class="eyebrow">
                    ATTACK STORY ENGINE
                </div>

                <h3>
                    Attack Story &amp; Progression
                </h3>

                <p>
                    Security activity correlated into a
                    structured attack story.
                </p>

            </div>

        </div>


        <div class="attack-story-summary">

            <div class="attack-story-card">

                <span class="investigation-label">
                    SOURCE
                </span>

                <strong>
                    ${esc(source)}
                </strong>

            </div>


            <div class="attack-story-card">

                <span class="investigation-label">
                    DETECTION
                </span>

                <strong>
                    ${esc(detection)}
                </strong>

            </div>


            <div class="attack-story-card">

                <span class="investigation-label">
                    CLASSIFICATION
                </span>

                <strong>
                    ${esc(
                        story.classification ||
                        "Security Incident"
                    )}
                </strong>

            </div>


            <div class="attack-story-card">

                <span class="investigation-label">
                    RISK
                </span>

                <strong>
                    ${esc(
                        risk.score ??
                        incident.risk_score ??
                        0
                    )}
                    ·
                    ${esc(
                        risk.level ??
                        incident.risk_level ??
                        "UNKNOWN"
                    )}
                </strong>

            </div>

        </div>


        <div class="attack-story-progression">

            <div class="eyebrow">
                ATTACK PROGRESSION
            </div>

            <div class="attack-stage-list">

                ${
                    progression.length
                        ? progression.map(
                            (stage, index) => `

                                <div class="attack-stage">

                                    <div class="attack-stage-number">
                                        ${index + 1}
                                    </div>

                                    <div class="attack-stage-content">

                                        <strong>
                                            ${esc(
                                                String(stage)
                                                    .replaceAll(
                                                        "_",
                                                        " "
                                                    )
                                            )}
                                        </strong>

                                    </div>

                                </div>

                                ${
                                    index <
                                    progression.length - 1
                                        ? `
                                            <div class="attack-stage-connector">
                                                →
                                            </div>
                                          `
                                        : ""
                                }

                            `
                        ).join("")
                        : `
                            <div class="empty">
                                No progression available.
                            </div>
                          `
                }

            </div>

        </div>


        <div class="attack-story-flow">

            <div class="attack-flow-node">

                <span>SOURCE</span>

                <strong>
                    ${esc(source)}
                </strong>

            </div>

            <div class="attack-flow-arrow">
                →
            </div>

            <div class="attack-flow-node">

                <span>DETECTION</span>

                <strong>
                    ${esc(detection)}
                </strong>

            </div>

            <div class="attack-flow-arrow">
                →
            </div>

            <div class="attack-flow-node">

                <span>RISK</span>

                <strong>
                    ${esc(
                        risk.score ??
                        incident.risk_score ??
                        0
                    )}
                </strong>

            </div>

            <div class="attack-flow-arrow">
                →
            </div>

            <div class="attack-flow-node">

                <span>INCIDENT</span>

                <strong>
                    #${esc(
                        incident.id ??
                        "?"
                    )}
                </strong>

            </div>

        </div>


        <div class="attack-response-list">

            <div class="eyebrow">
                RESPONSE ACTIVITY
            </div>

            ${
                responses.length
                    ? responses.map(
                        item => `

                            <div class="attack-response">

                                <div>

                                    <strong>
                                        ${esc(
                                            item.action ||
                                            item.type ||
                                            "RESPONSE"
                                        )}
                                    </strong>

                                    <small>
                                        ${esc(
                                            item.mode ||
                                            item.status ||
                                            "SIMULATION"
                                        )}
                                    </small>

                                </div>

                                <span>
                                    ${esc(
                                        item.status ||
                                        "SIMULATED"
                                    )}
                                </span>

                            </div>

                        `
                    ).join("")
                    : `
                        <div class="empty">
                            No response actions recorded.
                        </div>
                      `
            }

        </div>

    `;

}


/* ============================================================
   SECURITY GRAPH
   ============================================================ */

function renderSecurityGraph(
    data
) {

    const container =
        $("securityGraph");


    if (!container) {
        return;
    }


    const graph =
        data?.graph ||
        {};


    const nodes =
        Array.isArray(
            graph.nodes
        )
            ? graph.nodes
            : [];


    const edges =
        Array.isArray(
            graph.edges
        )
            ? graph.edges
            : [];


    const counts =
        graph.node_type_counts ||
        {};


    $("graphStats").innerHTML = `

        <div class="graph-stat">

            <strong>
                ${nodes.length}
            </strong>

            <span>
                Nodes
            </span>

        </div>


        <div class="graph-stat">

            <strong>
                ${edges.length}
            </strong>

            <span>
                Relationships
            </span>

        </div>

    `;


    const order = [

        "SOURCE",
        "EVENT",
        "DETECTION",
        "ALERT",
        "RISK",
        "INCIDENT",
        "RESPONSE",
        "STATUS"

    ];


    const groups = {};


    nodes.forEach(
        node => {

            const type =
                String(
                    node.type ||
                    node.node_type ||
                    "UNKNOWN"
                ).toUpperCase();


            if (!groups[type]) {
                groups[type] = [];
            }


            groups[type].push(
                node
            );

        }
    );


    const labels = {

        SOURCE: "Source",
        EVENT: "Events",
        DETECTION: "Detection",
        ALERT: "Alerts",
        RISK: "Risk",
        INCIDENT: "Incident",
        RESPONSE: "Response",
        STATUS: "Status"

    };


    const types =
        order.filter(
            type =>
                groups[type]?.length
        );


    container.innerHTML = `

        <div class="security-graph-wrapper">

            <div class="security-graph-columns">

                ${
                    types.map(
                        type => `

                            <div class="security-graph-column">

                                <div class="security-graph-column-title">

                                    <span>
                                        ${labels[type]}
                                    </span>

                                    <b>
                                        ${
                                            counts[type] ??
                                            groups[type].length
                                        }
                                    </b>

                                </div>


                                ${
                                    groups[type].map(
                                        node => {

                                            const label =
                                                node.label ||
                                                node.name ||
                                                node.title ||
                                                node.value ||
                                                node.id ||
                                                type;


                                            const secondary =
                                                node.description ||
                                                node.source_ip ||
                                                "";


                                            return `

                                                <div
                                                    class="security-graph-node"
                                                    data-node-type="${esc(type)}"
                                                >

                                                    <div class="security-graph-node-type">

                                                        ${esc(
                                                            labels[type] ||
                                                            type
                                                        )}

                                                    </div>


                                                    <strong>
                                                        ${esc(label)}
                                                    </strong>


                                                    ${
                                                        secondary &&
                                                        String(
                                                            secondary
                                                        ) !==
                                                        String(label)
                                                            ? `
                                                                <small>
                                                                    ${esc(
                                                                        String(
                                                                            secondary
                                                                        ).slice(
                                                                            0,
                                                                            100
                                                                        )
                                                                    )}
                                                                </small>
                                                              `
                                                            : ""
                                                    }

                                                </div>

                                            `;

                                        }
                                    ).join("")
                                }

                            </div>

                        `
                    ).join("")
                }

            </div>


            <div class="security-graph-relationships">

                <div class="eyebrow">
                    RELATIONSHIPS
                </div>

                ${
                    edges.length
                        ? edges.map(
                            edge => `

                                <div class="graph-relationship">

                                    <span>
                                        ${esc(
                                            edge.source ??
                                            edge.from ??
                                            edge.source_id ??
                                            "?"
                                        )}
                                    </span>

                                    <b>→</b>

                                    <strong>
                                        ${esc(
                                            edge.label ||
                                            edge.relationship ||
                                            edge.type ||
                                            "RELATED_TO"
                                        )}
                                    </strong>

                                    <b>→</b>

                                    <span>
                                        ${esc(
                                            edge.target ??
                                            edge.to ??
                                            edge.target_id ??
                                            "?"
                                        )}
                                    </span>

                                </div>

                            `
                        ).join("")
                        : `
                            <div class="empty">
                                No graph relationships available.
                            </div>
                          `
                }

            </div>

        </div>

    `;


    const legend =
        $("graphLegend");


    if (legend) {

        legend.innerHTML =
            types.map(
                type => `

                    <span class="graph-legend-item">

                        <i class="graph-legend-dot"></i>

                        ${esc(
                            labels[type] ||
                            type
                        )}

                    </span>

                `
            ).join("");

    }

}


/* ============================================================
   TIMELINE
   ============================================================ */

function renderTimeline(
    timeline
) {

    const container =
        $("investigationTimeline");


    if (!container) {
        return;
    }


    if (!timeline.length) {

        container.innerHTML =
            `<div class="empty">No timeline available.</div>`;

        return;
    }


    container.innerHTML =
        timeline.map(
            (item, index) => {

                const type =
                    String(
                        item.type ||
                        item.event_type ||
                        item.kind ||
                        "EVENT"
                    ).toUpperCase();


                const timestamp =
                    item.timestamp ||
                    item.created_at ||
                    item.occurred_at ||
                    item.time;


                const title =
                    item.title ||
                    item.name ||
                    item.alert_type ||
                    item.event_type ||
                    item.action ||
                    item.status ||
                    type;


                const description =
                    item.description ||
                    item.message ||
                    item.finding ||
                    item.reason ||
                    "";


                const severity =
                    item.severity ||
                    item.risk_level ||
                    "";


                return `

                    <div class="timeline-item">

                        <div class="timeline-marker">

                            <span>
                                ${index + 1}
                            </span>

                        </div>


                        <div class="timeline-content">

                            <div class="timeline-meta">

                                <span class="timeline-type">
                                    ${esc(type)}
                                </span>

                                <span>
                                    ${esc(
                                        time(timestamp)
                                    )}
                                </span>

                            </div>


                            <div class="timeline-title">

                                ${esc(title)}

                                ${
                                    severity
                                        ? `
                                            <span class="timeline-severity">
                                                ${esc(severity)}
                                            </span>
                                          `
                                        : ""
                                }

                            </div>


                            ${
                                description
                                    ? `
                                        <div class="timeline-description">
                                            ${esc(description)}
                                        </div>
                                      `
                                    : ""
                            }


                            ${
                                item.source_ip
                                    ? `
                                        <div class="timeline-source">
                                            Source:
                                            ${esc(
                                                item.source_ip
                                            )}
                                        </div>
                                      `
                                    : ""
                            }

                        </div>

                    </div>

                `;

            }
        ).join("");

}


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const refresh =
            $("refreshBtn");


        if (refresh) {

            refresh.addEventListener(
                "click",
                load
            );

        }


        const close =
            $("closeInvestigation");


        if (close) {

            close.addEventListener(
                "click",
                closeInvestigation
            );

        }


        const overlay =
            $("investigationOverlay");


        if (overlay) {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        closeInvestigation();

                    }

                }
            );

        }


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeInvestigation();

                }

            }
        );


        load();

        setInterval(
            load,
            15000
        );

    }
);


/* ============================================================
   AEGIS X V5 — VISUAL SECURITY INTELLIGENCE GRAPH
   ============================================================ */

function renderSecurityGraph(data) {

    const container =
        document.getElementById("securityGraph");

    if (!container) {
        return;
    }

    const graph =
        data?.graph
        || data
        || {};

    const nodes =
        Array.isArray(graph.nodes)
            ? graph.nodes
            : [];

    const edges =
        Array.isArray(graph.edges)
            ? graph.edges
            : [];

    if (!nodes.length) {

        container.innerHTML = `
            <div class="loading">
                No graph intelligence available.
            </div>
        `;

        return;
    }


    /*
     * Identify the important node types.
     */

    const byType = type =>
        nodes.filter(
            node =>
                String(node.type || "").toUpperCase()
                === type
        );


    const source =
        byType("SOURCE")[0];

    const event =
        byType("EVENT")[0];

    const detection =
        byType("DETECTION")[0];

    const alert =
        byType("ALERT")[0];

    const risk =
        byType("RISK")[0];

    const incident =
        byType("INCIDENT")[0];

    const response =
        byType("RESPONSE")[0];


    /*
     * Escape graph text safely.
     */

    const safe = value =>
        esc(
            value === null ||
            value === undefined
                ? "—"
                : String(value)
        );


    const nodeTitle = node => {

        if (!node) {
            return "—";
        }

        return (
            node.label
            || node.name
            || node.title
            || node.id
            || "NODE"
        );

    };


    const nodeDetail = node => {

        if (!node) {
            return "";
        }

        return (
            node.description
            || node.value
            || node.source_ip
            || node.status
            || ""
        );

    };


    /*
     * Fixed intelligence layout.
     *
     * This deliberately creates a relationship view
     * instead of the previous database-style columns.
     */

    const positions = {

        source: {
            x: 12,
            y: 50
        },

        event: {
            x: 29,
            y: 25
        },

        detection: {
            x: 47,
            y: 25
        },

        alert: {
            x: 66,
            y: 25
        },

        risk: {
            x: 66,
            y: 73
        },

        incident: {
            x: 48,
            y: 50
        },

        response: {
            x: 84,
            y: 73
        }

    };


    const nodeHTML =
        (node, key, className) => {

            if (!node) {
                return "";
            }

            const pos =
                positions[key];

            return `
                <div
                    class="aegis-node ${className}"
                    style="
                        left:${pos.x}%;
                        top:${pos.y}%;
                    "
                    title="${safe(nodeTitle(node))}"
                >

                    <div class="aegis-node-type">
                        ${safe(node.type || key)}
                    </div>

                    <div class="aegis-node-title">
                        ${safe(nodeTitle(node))}
                    </div>

                    ${
                        nodeDetail(node)
                            ? `
                                <div class="aegis-node-detail">
                                    ${safe(nodeDetail(node))}
                                </div>
                              `
                            : ""
                    }

                </div>
            `;

        };


    /*
     * SVG relationship layer.
     */

    const line =
        (x1, y1, x2, y2, cls = "") => `
            <line
                class="aegis-edge ${cls}"
                x1="${x1}%"
                y1="${y1}%"
                x2="${x2}%"
                y2="${y2}%"
            />
        `;


    let svg = `
        <svg
            class="aegis-network-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
        >

            <defs>

                <filter id="aegisGlow">
                    <feGaussianBlur
                        stdDeviation="1.5"
                        result="blur"
                    />

                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>

            </defs>
    `;


    /*
     * Source → Event
     */

    if (source && event) {

        svg += line(
            positions.source.x,
            positions.source.y,
            positions.event.x,
            positions.event.y
        );

    }


    /*
     * Event → Detection
     */

    if (event && detection) {

        svg += line(
            positions.event.x,
            positions.event.y,
            positions.detection.x,
            positions.detection.y
        );

    }


    /*
     * Detection → Alert
     */

    if (detection && alert) {

        svg += line(
            positions.detection.x,
            positions.detection.y,
            positions.alert.x,
            positions.alert.y,
            "alert"
        );

    }


    /*
     * Alert → Incident
     */

    if (alert && incident) {

        svg += line(
            positions.alert.x,
            positions.alert.y,
            positions.incident.x,
            positions.incident.y,
            "alert"
        );

    }


    /*
     * Incident → Risk
     */

    if (incident && risk) {

        svg += line(
            positions.incident.x,
            positions.incident.y,
            positions.risk.x,
            positions.risk.y,
            "risk"
        );

    }


    /*
     * Incident → Response
     */

    if (incident && response) {

        svg += line(
            positions.incident.x,
            positions.incident.y,
            positions.response.x,
            positions.response.y,
            "response"
        );

    }


    /*
     * Also draw relationships returned by backend
     * where possible.
     */

    svg += `
        </svg>
    `;


    const legend = `
        <div class="aegis-network-legend">

            <div class="aegis-network-legend-item">
                <i class="aegis-network-legend-dot source"></i>
                SOURCE
            </div>

            <div class="aegis-network-legend-item">
                <i class="aegis-network-legend-dot event"></i>
                EVENT
            </div>

            <div class="aegis-network-legend-item">
                <i class="aegis-network-legend-dot detection"></i>
                DETECTION
            </div>

            <div class="aegis-network-legend-item">
                <i class="aegis-network-legend-dot alert"></i>
                ALERT
            </div>

            <div class="aegis-network-legend-item">
                <i class="aegis-network-legend-dot incident"></i>
                INCIDENT
            </div>

            <div class="aegis-network-legend-item">
                <i class="aegis-network-legend-dot response"></i>
                RESPONSE
            </div>

        </div>
    `;


    container.innerHTML = `

        <div class="aegis-network">

            <div class="aegis-network-label">
                LIVE SECURITY RELATIONSHIP GRAPH
            </div>

            <div
                class="aegis-network-pulse"
            ></div>

            <div
                class="aegis-network-pulse"
            ></div>

            ${svg}

            ${nodeHTML(
                source,
                "source",
                "source"
            )}

            ${nodeHTML(
                event,
                "event",
                "event"
            )}

            ${nodeHTML(
                detection,
                "detection",
                "detection"
            )}

            ${nodeHTML(
                alert,
                "alert",
                "alert"
            )}

            ${nodeHTML(
                risk,
                "risk",
                "risk"
            )}

            ${nodeHTML(
                incident,
                "incident",
                "incident"
            )}

            ${nodeHTML(
                response,
                "response",
                "response"
            )}

            ${legend}

        </div>
    `;


    /*
     * Update graph statistics when available.
     */

    const graphStats =
        document.getElementById("graphStats");

    if (graphStats) {

        const counts =
            graph.node_type_counts
            || {};

        graphStats.innerHTML = `

            <div class="graph-stat">
                <strong>
                    ${safe(
                        graph.node_count
                        ?? nodes.length
                    )}
                </strong>
                <span>Nodes</span>
            </div>

            <div class="graph-stat">
                <strong>
                    ${safe(
                        graph.edge_count
                        ?? edges.length
                    )}
                </strong>
                <span>Relations</span>
            </div>

            <div class="graph-stat">
                <strong>
                    ${safe(
                        counts.EVENT
                        ?? byType("EVENT").length
                    )}
                </strong>
                <span>Events</span>
            </div>

            <div class="graph-stat">
                <strong>
                    ${safe(
                        counts.ALERT
                        ?? byType("ALERT").length
                    )}
                </strong>
                <span>Alerts</span>
            </div>

        `;

    }

}


/* ============================================================
   AEGIS X — UEBA INVESTIGATION UI
   Phase 3.5
   ============================================================ */

(function () {
    "use strict";

    async function loadUEBAInvestigation(incidentId) {
        if (!incidentId) {
            console.warn("AEGIS X UEBA: missing incident ID");
            return;
        }

        try {
            const response = await fetch(
                `/api/v1/incidents/${incidentId}/ueba`
            );

            if (!response.ok) {
                throw new Error(
                    `UEBA API returned ${response.status}`
                );
            }

            const data = await response.json();

            renderUEBAInvestigation(data);

        } catch (error) {
            console.error(
                "AEGIS X UEBA investigation error:",
                error
            );

            renderUEBAError(error);
        }
    }


    function getInvestigationContent() {
        return (
            document.getElementById("investigationContent") ||
            document.querySelector("#investigationContent")
        );
    }


    function ensureUEBASection() {
        const content = getInvestigationContent();

        if (!content) {
            return null;
        }

        let section = document.getElementById(
            "uebaInvestigationSection"
        );

        if (section) {
            return section;
        }

        section = document.createElement("section");

        section.id = "uebaInvestigationSection";
        section.className = "aegis-ueba-section";

        section.innerHTML = `
            <div class="aegis-ueba-header">
                <div>
                    <div class="aegis-ueba-eyebrow">
                        BEHAVIORAL INTELLIGENCE
                    </div>

                    <h2 class="aegis-ueba-title">
                        UEBA Analysis
                    </h2>

                    <p class="aegis-ueba-subtitle">
                        User and Entity Behavior Analytics
                    </p>
                </div>

                <div
                    id="uebaHeaderRisk"
                    class="aegis-ueba-risk-badge"
                >
                    ANALYZING
                </div>
            </div>

            <div
                id="uebaEntityBar"
                class="aegis-ueba-entity-bar"
            >
                <span class="aegis-ueba-entity-label">
                    ENTITY
                </span>

                <span
                    id="uebaEntityValue"
                    class="aegis-ueba-entity-value"
                >
                    —
                </span>
            </div>

            <div class="aegis-ueba-score-grid">

                <div class="aegis-ueba-score-card">
                    <div class="aegis-ueba-card-label">
                        UEBA SCORE
                    </div>

                    <div
                        id="uebaScore"
                        class="aegis-ueba-score"
                    >
                        —
                    </div>

                    <div class="aegis-ueba-progress">
                        <div
                            id="uebaScoreBar"
                            class="aegis-ueba-progress-fill"
                        ></div>
                    </div>
                </div>

                <div class="aegis-ueba-mini-card">
                    <div class="aegis-ueba-card-label">
                        RISK LEVEL
                    </div>

                    <div
                        id="uebaRiskLevel"
                        class="aegis-ueba-mini-value"
                    >
                        —
                    </div>
                </div>

                <div class="aegis-ueba-mini-card">
                    <div class="aegis-ueba-card-label">
                        BASELINE
                    </div>

                    <div
                        id="uebaBaseline"
                        class="aegis-ueba-mini-value"
                    >
                        —
                    </div>
                </div>

                <div class="aegis-ueba-mini-card">
                    <div class="aegis-ueba-card-label">
                        CONFIDENCE
                    </div>

                    <div
                        id="uebaConfidence"
                        class="aegis-ueba-mini-value"
                    >
                        —
                    </div>
                </div>

            </div>


            <div class="aegis-ueba-section-title">
                BEHAVIOR SIGNALS
            </div>

            <div class="aegis-ueba-behavior-grid">

                <div class="aegis-ueba-stat">
                    <span>Events</span>
                    <strong id="uebaEvents">—</strong>
                </div>

                <div class="aegis-ueba-stat">
                    <span>Failed Auth</span>
                    <strong id="uebaFailedAuth">—</strong>
                </div>

                <div class="aegis-ueba-stat">
                    <span>Failure Rate</span>
                    <strong id="uebaFailureRate">—</strong>
                </div>

                <div class="aegis-ueba-stat">
                    <span>5-Min Burst</span>
                    <strong id="uebaBurst">—</strong>
                </div>

            </div>


            <div class="aegis-ueba-section-title">
                BEHAVIORAL SIGNAL BREAKDOWN
            </div>

            <div class="aegis-ueba-signals">

                <div class="aegis-ueba-signal-row">
                    <span>Frequency</span>
                    <strong id="uebaFrequencyScore">0</strong>
                </div>

                <div class="aegis-ueba-signal-row">
                    <span>Authentication</span>
                    <strong id="uebaAuthScore">0</strong>
                </div>

                <div class="aegis-ueba-signal-row">
                    <span>Burst Activity</span>
                    <strong id="uebaBurstScore">0</strong>
                </div>

                <div class="aegis-ueba-signal-row">
                    <span>Failure Rate</span>
                    <strong id="uebaFailureRateScore">0</strong>
                </div>

            </div>


            <div class="aegis-ueba-section-title">
                WHY AEGIS X FLAGGED THIS ENTITY
            </div>

            <div
                id="uebaReasons"
                class="aegis-ueba-reasons"
            >
                <div class="aegis-ueba-loading">
                    Analyzing behavioral evidence...
                </div>
            </div>


            <div class="aegis-ueba-comparison">

                <div class="aegis-ueba-comparison-card">
                    <span>
                        DETECTION ENGINE
                    </span>

                    <strong id="uebaDetectionRisk">
                        —
                    </strong>

                    <small id="uebaDetectionScore">
                        —
                    </small>
                </div>

                <div class="aegis-ueba-comparison-divider">
                    +
                </div>

                <div class="aegis-ueba-comparison-card">
                    <span>
                        UEBA ENGINE
                    </span>

                    <strong id="uebaBehaviorRisk">
                        —
                    </strong>

                    <small id="uebaBehaviorScore">
                        —
                    </small>
                </div>

            </div>

            <div class="aegis-ueba-footer">
                <span class="aegis-ueba-dot"></span>

                <span>
                    AEGIS X behavioral analysis
                    • local deterministic engine
                </span>
            </div>
        `;

        /*
         * Put UEBA before the AI Investigation section.
         * This keeps behavioral intelligence near the top.
         */
        const aiContainer = document.getElementById(
            "aiInvestigationContainer"
        );

        if (aiContainer) {
            content.insertBefore(section, aiContainer);
        } else {
            content.prepend(section);
        }

        return section;
    }


    function renderUEBAInvestigation(data) {
        const section = ensureUEBASection();

        if (!section) {
            console.warn(
                "AEGIS X UEBA: investigation content not found"
            );
            return;
        }

        const entity = data.entity;

        if (!entity) {
            renderUEBAError(
                new Error("No UEBA entity returned")
            );
            return;
        }

        const entityInfo = entity.entity || {};
        const behavior = entity.behavior || {};
        const signals = entity.signals || {};

        const score = Number(entity.score || 0);
        const confidence = Number(
            entity.confidence || 0
        );

        const riskLevel =
            String(entity.risk_level || "LOW").toUpperCase();

        const baseline =
            String(
                entity.baseline_status || "NORMAL"
            ).toUpperCase();

        const incident = data.incident || {};

        const entityValue =
            entityInfo.value ||
            incident.source_ip ||
            "Unknown Entity";

        setText(
            "uebaEntityValue",
            entityValue
        );

        setText(
            "uebaScore",
            `${score} / 100`
        );

        setText(
            "uebaRiskLevel",
            riskLevel
        );

        setText(
            "uebaBaseline",
            baseline
        );

        setText(
            "uebaConfidence",
            `${confidence}%`
        );

        setText(
            "uebaEvents",
            behavior.event_count ?? 0
        );

        setText(
            "uebaFailedAuth",
            behavior.failed_auth_count ?? 0
        );

        const failureRate =
            Number(behavior.failure_rate || 0);

        setText(
            "uebaFailureRate",
            `${Math.round(failureRate * 100)}%`
        );

        setText(
            "uebaBurst",
            behavior.max_5_minute_burst ?? 0
        );

        setText(
            "uebaFrequencyScore",
            `${signals.frequency_score || 0}`
        );

        setText(
            "uebaAuthScore",
            `${signals.authentication_score || 0}`
        );

        setText(
            "uebaBurstScore",
            `${signals.burst_score || 0}`
        );

        setText(
            "uebaFailureRateScore",
            `${signals.failure_rate_score || 0}`
        );


        const scoreBar =
            document.getElementById(
                "uebaScoreBar"
            );

        if (scoreBar) {
            scoreBar.style.width =
                `${Math.max(0, Math.min(100, score))}%`;
        }


        const riskBadge =
            document.getElementById(
                "uebaHeaderRisk"
            );

        if (riskBadge) {
            riskBadge.textContent =
                `UEBA ${riskLevel}`;

            riskBadge.className =
                `aegis-ueba-risk-badge aegis-ueba-risk-${riskLevel.toLowerCase()}`;
        }


        const riskElement =
            document.getElementById(
                "uebaRiskLevel"
            );

        if (riskElement) {
            riskElement.className =
                `aegis-ueba-mini-value aegis-ueba-risk-text-${riskLevel.toLowerCase()}`;
        }


        const baselineElement =
            document.getElementById(
                "uebaBaseline"
            );

        if (baselineElement) {
            baselineElement.className =
                `aegis-ueba-mini-value aegis-ueba-baseline-${baseline.toLowerCase()}`;
        }


        renderUEBAReasons(
            entity.reasons || []
        );


        /*
         * Compare the behavioral assessment
         * with the existing detection engine.
         */
        setText(
            "uebaDetectionRisk",
            incident.risk_level || "—"
        );

        setText(
            "uebaDetectionScore",
            incident.risk_score != null
                ? `Risk score ${incident.risk_score}/100`
                : "No detection score"
        );

        setText(
            "uebaBehaviorRisk",
            riskLevel
        );

        setText(
            "uebaBehaviorScore",
            `Behavior score ${score}/100`
        );

        section.dataset.loaded = "true";
    }


    function renderUEBAReasons(reasons) {
        const container =
            document.getElementById(
                "uebaReasons"
            );

        if (!container) {
            return;
        }

        if (!reasons.length) {
            container.innerHTML = `
                <div class="aegis-ueba-reason-empty">
                    No significant behavioral anomalies detected.
                </div>
            `;

            return;
        }

        container.innerHTML =
            reasons.map(
                (reason) => `
                    <div class="aegis-ueba-reason">
                        <span class="aegis-ueba-reason-icon">
                            ✓
                        </span>

                        <span>
                            ${escapeUEBAHTML(reason)}
                        </span>
                    </div>
                `
            ).join("");
    }


    function renderUEBAError(error) {
        const section = ensureUEBASection();

        if (!section) {
            return;
        }

        const reasons =
            document.getElementById(
                "uebaReasons"
            );

        if (reasons) {
            reasons.innerHTML = `
                <div class="aegis-ueba-error">
                    UEBA analysis unavailable.
                    <small>
                        ${escapeUEBAHTML(
                            error?.message ||
                            "Unknown error"
                        )}
                    </small>
                </div>
            `;
        }
    }


    function setText(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                String(value);
        }
    }


    function escapeUEBAHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /*
     * Hook into the existing investigation function.
     *
     * The original investigation flow remains untouched.
     * UEBA simply loads after the investigation opens.
     */
    function attachUEBAInvestigationHook() {
        if (
            typeof window.investigate !== "function"
        ) {
            console.warn(
                "AEGIS X UEBA: investigate() not available yet."
            );

            return false;
        }

        if (
            window.investigate.__aegisUEBAHooked
        ) {
            return true;
        }

        const originalInvestigate =
            window.investigate;

        async function wrappedInvestigate(
            incidentId
        ) {
            const result =
                await originalInvestigate.apply(
                    this,
                    arguments
                );

            /*
             * Small delay gives the investigation
             * drawer time to render.
             */
            setTimeout(
                () => {
                    loadUEBAInvestigation(
                        incidentId
                    );
                },
                150
            );

            return result;
        }

        wrappedInvestigate.__aegisUEBAHooked =
            true;

        wrappedInvestigate.__aegisOriginal =
            originalInvestigate;

        window.investigate =
            wrappedInvestigate;

        return true;
    }


    /*
     * Some builds define investigate after this
     * script executes, so retry briefly.
     */
    let hookAttempts = 0;

    const hookTimer =
        setInterval(
            () => {
                hookAttempts++;

                if (
                    attachUEBAInvestigationHook() ||
                    hookAttempts >= 30
                ) {
                    clearInterval(
                        hookTimer
                    );
                }
            },
            200
        );


    /*
     * Expose the loader for debugging/testing.
     */
    window.loadUEBAInvestigation =
        loadUEBAInvestigation;


    console.log(
        "AEGIS X UEBA Investigation UI loaded."
    );

})();


/* ============================================================
   AEGIS X — UEBA VISUAL STYLES
   ============================================================ */

(function () {
    "use strict";

    if (
        document.getElementById(
            "aegisUEBAStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "aegisUEBAStyles";

    style.textContent = `
        .aegis-ueba-section {
            margin: 22px 0;
            padding: 24px;
            border-radius: 20px;
            border: 1px solid rgba(120, 150, 190, 0.18);
            background:
                linear-gradient(
                    145deg,
                    rgba(18, 27, 43, 0.96),
                    rgba(10, 17, 29, 0.96)
                );
            box-shadow:
                0 18px 50px rgba(0, 0, 0, 0.25),
                inset 0 1px 0 rgba(255,255,255,0.035);
        }

        .aegis-ueba-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 18px;
        }

        .aegis-ueba-eyebrow {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.16em;
            opacity: 0.58;
            margin-bottom: 5px;
        }

        .aegis-ueba-title {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .aegis-ueba-subtitle {
            margin: 5px 0 0;
            font-size: 13px;
            opacity: 0.58;
        }

        .aegis-ueba-risk-badge {
            padding: 9px 14px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.08em;
            white-space: nowrap;
            background: rgba(255,255,255,0.08);
        }

        .aegis-ueba-risk-critical {
            background: rgba(255, 70, 70, 0.18);
        }

        .aegis-ueba-risk-high {
            background: rgba(255, 140, 60, 0.18);
        }

        .aegis-ueba-risk-medium {
            background: rgba(245, 190, 60, 0.16);
        }

        .aegis-ueba-risk-low {
            background: rgba(80, 190, 130, 0.15);
        }

        .aegis-ueba-entity-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 13px 15px;
            margin-bottom: 18px;
            border-radius: 12px;
            background: rgba(255,255,255,0.035);
            border: 1px solid rgba(255,255,255,0.055);
        }

        .aegis-ueba-entity-label {
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.12em;
            opacity: 0.48;
        }

        .aegis-ueba-entity-value {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 14px;
            font-weight: 700;
        }

        .aegis-ueba-score-grid {
            display: grid;
            grid-template-columns: 1.5fr repeat(3, 1fr);
            gap: 12px;
        }

        .aegis-ueba-score-card,
        .aegis-ueba-mini-card {
            min-height: 100px;
            padding: 18px;
            border-radius: 15px;
            background: rgba(255,255,255,0.035);
            border: 1px solid rgba(255,255,255,0.055);
        }

        .aegis-ueba-card-label {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.12em;
            opacity: 0.5;
            margin-bottom: 9px;
        }

        .aegis-ueba-score {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: -0.04em;
        }

        .aegis-ueba-progress {
            height: 6px;
            margin-top: 13px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(255,255,255,0.07);
        }

        .aegis-ueba-progress-fill {
            width: 0%;
            height: 100%;
            border-radius: inherit;
            background: currentColor;
            transition: width 700ms ease;
        }

        .aegis-ueba-mini-value {
            font-size: 18px;
            font-weight: 850;
        }

        .aegis-ueba-risk-text-critical,
        .aegis-ueba-risk-text-high {
            font-weight: 900;
        }

        .aegis-ueba-baseline-abnormal {
            font-weight: 900;
        }

        .aegis-ueba-section-title {
            margin: 24px 0 10px;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.15em;
            opacity: 0.48;
        }

        .aegis-ueba-behavior-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
        }

        .aegis-ueba-stat {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 13px 15px;
            border-radius: 11px;
            background: rgba(255,255,255,0.028);
            border: 1px solid rgba(255,255,255,0.045);
        }

        .aegis-ueba-stat span {
            font-size: 12px;
            opacity: 0.58;
        }

        .aegis-ueba-stat strong {
            font-size: 15px;
            font-weight: 850;
        }

        .aegis-ueba-signals {
            display: grid;
            gap: 7px;
        }

        .aegis-ueba-signal-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 11px 14px;
            border-radius: 9px;
            background: rgba(255,255,255,0.025);
        }

        .aegis-ueba-signal-row span {
            font-size: 12px;
            opacity: 0.64;
        }

        .aegis-ueba-signal-row strong {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
        }

        .aegis-ueba-reasons {
            display: grid;
            gap: 7px;
        }

        .aegis-ueba-reason {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 14px;
            border-radius: 10px;
            background: rgba(255,255,255,0.028);
            font-size: 12px;
            line-height: 1.45;
        }

        .aegis-ueba-reason-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 19px;
            height: 19px;
            border-radius: 50%;
            background: rgba(100, 180, 130, 0.12);
            font-size: 10px;
            font-weight: 900;
        }

        .aegis-ueba-comparison {
            display: flex;
            align-items: stretch;
            gap: 12px;
            margin-top: 22px;
        }

        .aegis-ueba-comparison-card {
            flex: 1;
            padding: 16px;
            border-radius: 13px;
            background: rgba(255,255,255,0.035);
            border: 1px solid rgba(255,255,255,0.055);
        }

        .aegis-ueba-comparison-card span {
            display: block;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.1em;
            opacity: 0.48;
            margin-bottom: 8px;
        }

        .aegis-ueba-comparison-card strong {
            display: block;
            font-size: 18px;
            font-weight: 900;
        }

        .aegis-ueba-comparison-card small {
            display: block;
            margin-top: 4px;
            font-size: 11px;
            opacity: 0.52;
        }

        .aegis-ueba-comparison-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            font-size: 16px;
            opacity: 0.35;
        }

        .aegis-ueba-footer {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 18px;
            font-size: 10px;
            opacity: 0.42;
        }

        .aegis-ueba-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
        }

        .aegis-ueba-loading,
        .aegis-ueba-error,
        .aegis-ueba-reason-empty {
            padding: 14px;
            border-radius: 10px;
            background: rgba(255,255,255,0.025);
            font-size: 12px;
            opacity: 0.65;
        }

        .aegis-ueba-error small {
            display: block;
            margin-top: 5px;
            opacity: 0.6;
        }

        @media (max-width: 900px) {
            .aegis-ueba-score-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .aegis-ueba-behavior-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        @media (max-width: 600px) {
            .aegis-ueba-header {
                align-items: flex-start;
                flex-direction: column;
            }

            .aegis-ueba-score-grid,
            .aegis-ueba-behavior-grid {
                grid-template-columns: 1fr;
            }

            .aegis-ueba-comparison {
                flex-direction: column;
            }

            .aegis-ueba-comparison-divider {
                width: auto;
                height: 18px;
            }
        }
    `;

    document.head.appendChild(style);

})();


/* ============================================================
   AEGIS X — SIMPLE UEBA LAUNCHER
   ============================================================ */

(function () {
    "use strict";

    function addUEBAButton() {

        if (document.getElementById("aegisSimpleUEBAButton")) {
            return;
        }

        const button = document.createElement("button");

        button.id = "aegisSimpleUEBAButton";
        button.innerHTML = "◉ RUN UEBA";
        
        button.style.cssText = `
            position: fixed;
            right: 24px;
            bottom: 24px;
            z-index: 99999;
            padding: 12px 18px;
            border: 1px solid rgba(120,180,255,.35);
            border-radius: 12px;
            background: rgba(15,25,42,.96);
            color: #ffffff;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: .08em;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,.35);
            backdrop-filter: blur(12px);
        `;

        button.addEventListener("click", async function () {

            button.textContent = "◌ ANALYZING...";
            button.disabled = true;

            try {

                const response = await fetch(
                    "/api/v1/incidents/2/ueba"
                );

                if (!response.ok) {
                    throw new Error(
                        "UEBA API returned " +
                        response.status
                    );
                }

                const data = await response.json();

                /*
                 * Open the existing investigation drawer
                 * if the dashboard provides the function.
                 */
                if (typeof window.investigate === "function") {
                    try {
                        await window.investigate(2);
                    } catch (e) {
                        console.warn(
                            "Investigation drawer could not be opened:",
                            e
                        );
                    }
                }

                /*
                 * Give the drawer time to appear.
                 */
                setTimeout(function () {

                    if (
                        typeof window.renderUEBAInvestigation ===
                        "function"
                    ) {
                        window.renderUEBAInvestigation(data);
                    } else {
                        /*
                         * Fallback: directly create a simple
                         * UEBA panel.
                         */
                        showSimpleUEBA(data);
                    }

                }, 300);

                button.textContent = "✓ UEBA LOADED";

                setTimeout(function () {
                    button.textContent = "◉ RUN UEBA";
                    button.disabled = false;
                }, 2000);

            } catch (error) {

                console.error(
                    "UEBA launcher error:",
                    error
                );

                button.textContent = "⚠ UEBA ERROR";

                setTimeout(function () {
                    button.textContent = "◉ RUN UEBA";
                    button.disabled = false;
                }, 2000);
            }
        });

        document.body.appendChild(button);
    }


    function showSimpleUEBA(data) {

        const entity = data.entity || {};
        const behavior = entity.behavior || {};
        const signals = entity.signals || {};
        const incident = data.incident || {};

        let panel =
            document.getElementById(
                "aegisSimpleUEBAPanel"
            );

        if (!panel) {

            panel = document.createElement("div");

            panel.id =
                "aegisSimpleUEBAPanel";

            panel.style.cssText = `
                position: fixed;
                right: 24px;
                top: 80px;
                width: 420px;
                max-width: calc(100vw - 48px);
                z-index: 99998;
                padding: 24px;
                border-radius: 18px;
                background: rgba(12,20,34,.98);
                border: 1px solid rgba(120,180,255,.25);
                color: white;
                box-shadow: 0 25px 70px rgba(0,0,0,.55);
                backdrop-filter: blur(18px);
                font-family: Inter, system-ui, sans-serif;
            `;

            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:20px;
            ">
                <div>
                    <div style="
                        font-size:10px;
                        letter-spacing:.16em;
                        opacity:.5;
                        font-weight:800;
                    ">
                        BEHAVIORAL INTELLIGENCE
                    </div>

                    <div style="
                        font-size:22px;
                        font-weight:850;
                        margin-top:5px;
                    ">
                        UEBA Analysis
                    </div>
                </div>

                <button
                    onclick="
                        document.getElementById(
                            'aegisSimpleUEBAPanel'
                        ).remove()
                    "
                    style="
                        border:0;
                        background:rgba(255,255,255,.07);
                        color:white;
                        border-radius:8px;
                        width:32px;
                        height:32px;
                        cursor:pointer;
                    "
                >
                    ×
                </button>
            </div>

            <div style="
                padding:12px;
                border-radius:10px;
                background:rgba(255,255,255,.04);
                margin-bottom:16px;
            ">
                <div style="
                    font-size:9px;
                    opacity:.45;
                    letter-spacing:.12em;
                ">
                    ENTITY
                </div>

                <div style="
                    margin-top:5px;
                    font-family:monospace;
                    font-weight:700;
                ">
                    ${entity.entity?.value || incident.source_ip || "Unknown"}
                </div>
            </div>

            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:10px;
            ">

                <div style="
                    padding:15px;
                    border-radius:10px;
                    background:rgba(255,255,255,.04);
                ">
                    <div style="font-size:9px;opacity:.45;">
                        UEBA SCORE
                    </div>
                    <div style="
                        font-size:25px;
                        font-weight:900;
                        margin-top:5px;
                    ">
                        ${entity.score || 0}/100
                    </div>
                </div>

                <div style="
                    padding:15px;
                    border-radius:10px;
                    background:rgba(255,255,255,.04);
                ">
                    <div style="font-size:9px;opacity:.45;">
                        RISK
                    </div>
                    <div style="
                        font-size:20px;
                        font-weight:900;
                        margin-top:8px;
                    ">
                        ${entity.risk_level || "LOW"}
                    </div>
                </div>

                <div style="
                    padding:15px;
                    border-radius:10px;
                    background:rgba(255,255,255,.04);
                ">
                    <div style="font-size:9px;opacity:.45;">
                        BASELINE
                    </div>
                    <div style="
                        font-size:16px;
                        font-weight:800;
                        margin-top:8px;
                    ">
                        ${entity.baseline_status || "NORMAL"}
                    </div>
                </div>

                <div style="
                    padding:15px;
                    border-radius:10px;
                    background:rgba(255,255,255,.04);
                ">
                    <div style="font-size:9px;opacity:.45;">
                        CONFIDENCE
                    </div>
                    <div style="
                        font-size:16px;
                        font-weight:800;
                        margin-top:8px;
                    ">
                        ${entity.confidence || 0}%
                    </div>
                </div>

            </div>

            <div style="
                margin-top:18px;
                font-size:10px;
                letter-spacing:.12em;
                opacity:.45;
                font-weight:800;
            ">
                BEHAVIOR SIGNALS
            </div>

            <div style="
                margin-top:8px;
                display:grid;
                gap:6px;
            ">

                <div style="
                    display:flex;
                    justify-content:space-between;
                    padding:9px;
                    background:rgba(255,255,255,.03);
                    border-radius:7px;
                    font-size:12px;
                ">
                    <span>Events</span>
                    <strong>
                        ${behavior.event_count || 0}
                    </strong>
                </div>

                <div style="
                    display:flex;
                    justify-content:space-between;
                    padding:9px;
                    background:rgba(255,255,255,.03);
                    border-radius:7px;
                    font-size:12px;
                ">
                    <span>Failed Authentication</span>
                    <strong>
                        ${behavior.failed_auth_count || 0}
                    </strong>
                </div>

                <div style="
                    display:flex;
                    justify-content:space-between;
                    padding:9px;
                    background:rgba(255,255,255,.03);
                    border-radius:7px;
                    font-size:12px;
                ">
                    <span>Failure Rate</span>
                    <strong>
                        ${Math.round(
                            (behavior.failure_rate || 0) * 100
                        )}%
                    </strong>
                </div>

                <div style="
                    display:flex;
                    justify-content:space-between;
                    padding:9px;
                    background:rgba(255,255,255,.03);
                    border-radius:7px;
                    font-size:12px;
                ">
                    <span>5-Minute Burst</span>
                    <strong>
                        ${behavior.max_5_minute_burst || 0}
                    </strong>
                </div>

            </div>

            <div style="
                margin-top:18px;
                font-size:10px;
                letter-spacing:.12em;
                opacity:.45;
                font-weight:800;
            ">
                WHY AEGIS X FLAGGED IT
            </div>

            <div style="
                margin-top:8px;
                display:grid;
                gap:6px;
            ">
                ${(entity.reasons || []).map(
                    reason => `
                        <div style="
                            padding:10px;
                            border-radius:8px;
                            background:rgba(255,255,255,.03);
                            font-size:11px;
                            line-height:1.4;
                        ">
                            ✓ ${reason}
                        </div>
                    `
                ).join("")}
            </div>

            <div style="
                margin-top:18px;
                padding-top:14px;
                border-top:1px solid rgba(255,255,255,.07);
                font-size:10px;
                opacity:.4;
            ">
                Detection: ${incident.risk_level || "—"}
                • ${incident.risk_score ?? "—"}/100
                &nbsp;&nbsp;|&nbsp;&nbsp;
                UEBA: ${entity.risk_level || "—"}
                • ${entity.score || 0}/100
            </div>
        `;
    }


    window.renderUEBAInvestigation =
        window.renderUEBAInvestigation ||
        function (data) {
            showSimpleUEBA(data);
        };


    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            addUEBAButton
        );
    } else {
        addUEBAButton();
    }

})();

(function () {
    "use strict";

    const oldButton =
        document.getElementById("aegisSimpleUEBAButton");

    if (oldButton) {
        oldButton.remove();
    }

    const button = document.createElement("button");

    button.id = "aegisSimpleUEBAButton";
    button.textContent = "◉ RUN UEBA";

    button.style.cssText = `
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 999999;
        padding: 13px 20px;
        border: 1px solid rgba(100,190,255,.45);
        border-radius: 12px;
        background: #0d1728;
        color: white;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
        cursor: pointer;
        box-shadow: 0 10px 35px rgba(0,0,0,.45);
    `;

    button.onclick = async function () {

        button.textContent = "◌ ANALYZING...";
        button.disabled = true;

        try {

            const response = await fetch(
                "/api/v1/incidents/2/ueba"
            );

            if (!response.ok) {
                throw new Error(
                    "UEBA API error: " + response.status
                );
            }

            const data = await response.json();

            showUEBAModal(data);

            button.textContent = "✓ UEBA COMPLETE";

            setTimeout(() => {
                button.textContent = "◉ RUN UEBA";
                button.disabled = false;
            }, 1500);

        } catch (error) {

            console.error(error);

            button.textContent = "⚠ UEBA ERROR";

            setTimeout(() => {
                button.textContent = "◉ RUN UEBA";
                button.disabled = false;
            }, 2000);
        }
    };

    document.body.appendChild(button);


    function showUEBAModal(data) {

        const old =
            document.getElementById("aegisUEBAModal");

        if (old) {
            old.remove();
        }

        const entity = data.entity || {};
        const behavior = entity.behavior || {};
        const signals = entity.signals || {};
        const incident = data.incident || {};

        const score = entity.score ?? 0;
        const risk = entity.risk_level || "LOW";
        const baseline =
            entity.baseline_status || "NORMAL";
        const confidence =
            entity.confidence ?? 0;

        const failureRate =
            Math.round(
                (behavior.failure_rate || 0) * 100
            );

        const reasons =
            entity.reasons || [];

        const modal =
            document.createElement("div");

        modal.id = "aegisUEBAModal";

        modal.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 999998;
            background: rgba(0,0,0,.72);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
        `;

        modal.innerHTML = `
            <div style="
                width: min(850px, 95vw);
                max-height: 88vh;
                overflow-y: auto;
                background: #0b1322;
                color: #fff;
                border: 1px solid rgba(100,190,255,.25);
                border-radius: 22px;
                box-shadow: 0 30px 100px rgba(0,0,0,.65);
                padding: 30px;
                font-family: Inter, system-ui, sans-serif;
            ">

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:20px;
                ">

                    <div>

                        <div style="
                            color:#62c9ff;
                            font-size:10px;
                            font-weight:900;
                            letter-spacing:.18em;
                        ">
                            AEGIS X • BEHAVIORAL INTELLIGENCE
                        </div>

                        <h1 style="
                            margin:8px 0 4px;
                            font-size:30px;
                        ">
                            UEBA Analysis
                        </h1>

                        <div style="
                            opacity:.55;
                            font-size:13px;
                        ">
                            User & Entity Behavior Analytics
                        </div>

                    </div>

                    <button
                        id="closeUEBAModal"
                        style="
                            width:36px;
                            height:36px;
                            border:0;
                            border-radius:9px;
                            background:rgba(255,255,255,.07);
                            color:white;
                            font-size:22px;
                            cursor:pointer;
                        "
                    >
                        ×
                    </button>

                </div>


                <div style="
                    margin-top:22px;
                    padding:15px 18px;
                    border-radius:12px;
                    background:rgba(255,255,255,.04);
                    border:1px solid rgba(255,255,255,.06);
                ">

                    <div style="
                        font-size:9px;
                        opacity:.45;
                        letter-spacing:.14em;
                    ">
                        ANALYZED ENTITY
                    </div>

                    <div style="
                        margin-top:7px;
                        font-family:monospace;
                        font-size:16px;
                        font-weight:800;
                    ">
                        ${entity.entity?.value || incident.source_ip || "Unknown"}
                    </div>

                </div>


                <div style="
                    display:grid;
                    grid-template-columns:1.4fr 1fr 1fr 1fr;
                    gap:12px;
                    margin-top:14px;
                ">

                    <div style="
                        padding:20px;
                        border-radius:14px;
                        background:rgba(255,255,255,.04);
                    ">
                        <div style="
                            font-size:9px;
                            opacity:.45;
                            letter-spacing:.12em;
                        ">
                            UEBA SCORE
                        </div>

                        <div style="
                            font-size:30px;
                            font-weight:900;
                            margin-top:7px;
                        ">
                            ${score}/100
                        </div>

                        <div style="
                            height:5px;
                            margin-top:12px;
                            border-radius:99px;
                            background:rgba(255,255,255,.08);
                        ">
                            <div style="
                                width:${score}%;
                                height:100%;
                                border-radius:99px;
                                background:#62c9ff;
                            "></div>
                        </div>
                    </div>


                    <div style="
                        padding:20px;
                        border-radius:14px;
                        background:rgba(255,255,255,.04);
                    ">
                        <div style="
                            font-size:9px;
                            opacity:.45;
                        ">
                            RISK
                        </div>

                        <div style="
                            font-size:19px;
                            font-weight:900;
                            margin-top:12px;
                        ">
                            ${risk}
                        </div>
                    </div>


                    <div style="
                        padding:20px;
                        border-radius:14px;
                        background:rgba(255,255,255,.04);
                    ">
                        <div style="
                            font-size:9px;
                            opacity:.45;
                        ">
                            BASELINE
                        </div>

                        <div style="
                            font-size:17px;
                            font-weight:900;
                            margin-top:12px;
                        ">
                            ${baseline}
                        </div>
                    </div>


                    <div style="
                        padding:20px;
                        border-radius:14px;
                        background:rgba(255,255,255,.04);
                    ">
                        <div style="
                            font-size:9px;
                            opacity:.45;
                        ">
                            CONFIDENCE
                        </div>

                        <div style="
                            font-size:19px;
                            font-weight:900;
                            margin-top:12px;
                        ">
                            ${confidence}%
                        </div>
                    </div>

                </div>


                <div style="
                    margin-top:26px;
                    font-size:10px;
                    font-weight:900;
                    letter-spacing:.15em;
                    opacity:.48;
                ">
                    BEHAVIOR SIGNALS
                </div>


                <div style="
                    display:grid;
                    grid-template-columns:repeat(4,1fr);
                    gap:9px;
                    margin-top:10px;
                ">

                    <div class="ueba-stat">
                        <span>Events</span>
                        <strong>${behavior.event_count || 0}</strong>
                    </div>

                    <div class="ueba-stat">
                        <span>Failed Auth</span>
                        <strong>${behavior.failed_auth_count || 0}</strong>
                    </div>

                    <div class="ueba-stat">
                        <span>Failure Rate</span>
                        <strong>${failureRate}%</strong>
                    </div>

                    <div class="ueba-stat">
                        <span>5-Min Burst</span>
                        <strong>${behavior.max_5_minute_burst || 0}</strong>
                    </div>

                </div>


                <div style="
                    margin-top:26px;
                    font-size:10px;
                    font-weight:900;
                    letter-spacing:.15em;
                    opacity:.48;
                ">
                    SIGNAL BREAKDOWN
                </div>


                <div style="
                    margin-top:10px;
                    display:grid;
                    gap:6px;
                ">

                    ${[
                        ["Frequency", signals.frequency_score],
                        ["Authentication", signals.authentication_score],
                        ["Burst Activity", signals.burst_score],
                        ["Failure Rate", signals.failure_rate_score]
                    ].map(item => `
                        <div style="
                            display:flex;
                            justify-content:space-between;
                            padding:11px 14px;
                            border-radius:9px;
                            background:rgba(255,255,255,.035);
                            font-size:12px;
                        ">
                            <span style="opacity:.65;">
                                ${item[0]}
                            </span>

                            <strong>
                                ${item[1] || 0}
                            </strong>
                        </div>
                    `).join("")}

                </div>


                <div style="
                    margin-top:26px;
                    font-size:10px;
                    font-weight:900;
                    letter-spacing:.15em;
                    opacity:.48;
                ">
                    WHY AEGIS X FLAGGED THIS ENTITY
                </div>


                <div style="
                    margin-top:10px;
                    display:grid;
                    gap:7px;
                ">

                    ${reasons.map(reason => `
                        <div style="
                            padding:12px 14px;
                            border-radius:9px;
                            background:rgba(255,255,255,.035);
                            font-size:12px;
                        ">
                            <span style="
                                margin-right:8px;
                                color:#62c9ff;
                            ">
                                ✓
                            </span>
                            ${reason}
                        </div>
                    `).join("")}

                </div>


                <div style="
                    display:grid;
                    grid-template-columns:1fr 30px 1fr;
                    align-items:center;
                    gap:10px;
                    margin-top:26px;
                ">

                    <div style="
                        padding:17px;
                        border-radius:12px;
                        background:rgba(255,255,255,.035);
                    ">
                        <div style="
                            font-size:9px;
                            opacity:.45;
                        ">
                            DETECTION ENGINE
                        </div>

                        <strong style="
                            display:block;
                            margin-top:7px;
                            font-size:18px;
                        ">
                            ${incident.risk_level || "—"}
                        </strong>

                        <small style="opacity:.5;">
                            ${incident.risk_score ?? "—"}/100
                        </small>
                    </div>


                    <div style="
                        text-align:center;
                        opacity:.35;
                        font-size:18px;
                    ">
                        +
                    </div>


                    <div style="
                        padding:17px;
                        border-radius:12px;
                        background:rgba(255,255,255,.035);
                    ">
                        <div style="
                            font-size:9px;
                            opacity:.45;
                        ">
                            UEBA ENGINE
                        </div>

                        <strong style="
                            display:block;
                            margin-top:7px;
                            font-size:18px;
                        ">
                            ${risk}
                        </strong>

                        <small style="opacity:.5;">
                            ${score}/100
                        </small>
                    </div>

                </div>


                <div style="
                    margin-top:22px;
                    padding-top:15px;
                    border-top:1px solid rgba(255,255,255,.07);
                    font-size:10px;
                    opacity:.4;
                ">
                    AEGIS X UEBA Engine v1.0
                    • Local deterministic behavioral analysis
                    • Incident #${incident.id || 2}
                </div>

            </div>
        `;

        document.body.appendChild(modal);

        document
            .getElementById("closeUEBAModal")
            .onclick = () => modal.remove();

        modal.onclick = function (event) {
            if (event.target === modal) {
                modal.remove();
            }
        };
    }

})();
/* ============================================================
   AEGIS X — UNIFIED SECURITY INTELLIGENCE CORRELATION
   Phase 3.6
   ============================================================ */

(function () {
    "use strict";

    /* Remove the old floating UEBA button */
    function removeOldUEBAButton() {
        const button = document.getElementById(
            "aegisSimpleUEBAButton"
        );

        if (button) {
            button.remove();
        }
    }

    removeOldUEBAButton();


    async function loadUnifiedCorrelation() {

        const modal = document.getElementById(
            "aegisUEBAModal"
        );

        if (!modal) {
            return;
        }

        if (
            document.getElementById(
                "aegisUnifiedCorrelation"
            )
        ) {
            return;
        }

        try {

            const [uebaResponse, attackResponse] =
                await Promise.all([
                    fetch("/api/v1/incidents/2/ueba"),
                    fetch("/api/v1/incidents/2/attack-chain")
                ]);

            if (!uebaResponse.ok) {
                throw new Error(
                    "UEBA API: " +
                    uebaResponse.status
                );
            }

            if (!attackResponse.ok) {
                throw new Error(
                    "Attack Chain API: " +
                    attackResponse.status
                );
            }

            const ueba =
                await uebaResponse.json();

            const attack =
                await attackResponse.json();

            renderUnifiedCorrelation(
                modal,
                ueba,
                attack
            );

        } catch (error) {

            console.error(
                "AEGIS X Unified Correlation error:",
                error
            );

        }
    }


    function renderUnifiedCorrelation(
        modal,
        ueba,
        attack
    ) {

        const entity =
            ueba.entity || {};

        const incident =
            ueba.incident || {};

        const attackSummary =
            attack.summary || {};

        const attackAnalysis =
            attack.analysis || {};

        const mitre =
            attack.mitre_attack || {};

        const uebaScore =
            entity.score ?? 0;

        const uebaRisk =
            entity.risk_level || "LOW";

        const detectionScore =
            incident.risk_score ?? 0;

        const detectionRisk =
            incident.risk_level || "UNKNOWN";

        const classification =
            attackSummary.classification ||
            attackAnalysis.classification ||
            "Security Incident";

        const confidence =
            attackSummary.confidence ??
            attackAnalysis.confidence ??
            entity.confidence ??
            0;

        const progression =
            attackSummary.attack_progression ||
            attackAnalysis.attack_progression ||
            attack.stage_order ||
            [];

        const techniques =
            mitre.techniques || [];

        const responses =
            attack.responses ||
            attackAnalysis.responses ||
            [];


        const section =
            document.createElement("div");

        section.id =
            "aegisUnifiedCorrelation";

        section.innerHTML = `
            <div class="aegis-unified-header">

                <div>

                    <div class="aegis-unified-eyebrow">
                        SECURITY INTELLIGENCE CORRELATION
                    </div>

                    <h2>
                        Unified Attack Assessment
                    </h2>

                    <p>
                        AEGIS X correlates detection,
                        behavior, attack progression,
                        MITRE intelligence and response.
                    </p>

                </div>

                <div class="aegis-unified-confidence">
                    ${confidence}% CONFIDENCE
                </div>

            </div>


            <div class="aegis-unified-chain">

                <div class="aegis-chain-node">
                    <span>SOURCE</span>
                    <strong>
                        ${escapeHTML(
                            entity.entity?.value ||
                            incident.source_ip ||
                            "Unknown"
                        )}
                    </strong>
                </div>

                <div class="aegis-chain-arrow">
                    →
                </div>

                <div class="aegis-chain-node">
                    <span>BEHAVIOR</span>
                    <strong>
                        ${entity.behavior?.event_count || 0}
                        EVENTS
                    </strong>
                </div>

                <div class="aegis-chain-arrow">
                    →
                </div>

                <div class="aegis-chain-node">
                    <span>DETECTION</span>
                    <strong>
                        ${escapeHTML(
                            incident.incident_type ||
                            "UNKNOWN"
                        )}
                    </strong>
                </div>

                <div class="aegis-chain-arrow">
                    →
                </div>

                <div class="aegis-chain-node">
                    <span>UEBA</span>
                    <strong>
                        ${uebaScore}/100
                    </strong>
                </div>

                <div class="aegis-chain-arrow">
                    →
                </div>

                <div class="aegis-chain-node">
                    <span>INCIDENT</span>
                    <strong>
                        #${incident.id || 2}
                    </strong>
                </div>

            </div>


            <div class="aegis-unified-grid">

                <div class="aegis-unified-card">

                    <div class="aegis-unified-card-label">
                        DETECTION ENGINE
                    </div>

                    <div class="aegis-unified-big">
                        ${detectionRisk}
                    </div>

                    <div class="aegis-unified-small">
                        Risk score
                        ${detectionScore}/100
                    </div>

                </div>


                <div class="aegis-unified-card">

                    <div class="aegis-unified-card-label">
                        UEBA ENGINE
                    </div>

                    <div class="aegis-unified-big">
                        ${uebaRisk}
                    </div>

                    <div class="aegis-unified-small">
                        Behavior score
                        ${uebaScore}/100
                    </div>

                </div>


                <div class="aegis-unified-card">

                    <div class="aegis-unified-card-label">
                        CLASSIFICATION
                    </div>

                    <div class="aegis-unified-big aegis-unified-classification">
                        ${escapeHTML(
                            classification
                        )}
                    </div>

                    <div class="aegis-unified-small">
                        Correlated attack behavior
                    </div>

                </div>

            </div>


            <div class="aegis-unified-title">
                ATTACK PROGRESSION
            </div>

            <div class="aegis-progression">

                ${
                    progression.length
                    ? progression.map(
                        (stage, index) => `
                            <div class="aegis-progression-item">

                                <div class="aegis-progression-number">
                                    ${index + 1}
                                </div>

                                <div>
                                    <strong>
                                        ${escapeHTML(stage)}
                                    </strong>

                                    <small>
                                        Correlated activity stage
                                    </small>
                                </div>

                            </div>

                            ${
                                index <
                                progression.length - 1
                                ? `<div class="aegis-progression-arrow">→</div>`
                                : ""
                            }
                        `
                    ).join("")
                    : `
                        <div class="aegis-unified-empty">
                            Attack progression unavailable.
                        </div>
                    `
                }

            </div>


            <div class="aegis-unified-title">
                MITRE ATT&CK CORRELATION
            </div>

            <div class="aegis-mitre-row">

                ${
                    techniques.length
                    ? techniques.map(
                        technique => `
                            <div class="aegis-mitre-card">

                                <div class="aegis-mitre-id">
                                    ${escapeHTML(
                                        technique.id ||
                                        "UNKNOWN"
                                    )}
                                </div>

                                <strong>
                                    ${escapeHTML(
                                        technique.name ||
                                        "Unknown Technique"
                                    )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        technique.tactic ||
                                        ""
                                    )}
                                </small>

                            </div>
                        `
                    ).join("")
                    : `
                        <div class="aegis-unified-empty">
                            No MITRE mapping available.
                        </div>
                    `
                }

            </div>


            <div class="aegis-unified-title">
                CORRELATED EVIDENCE
            </div>

            <div class="aegis-evidence-grid">

                <div class="aegis-evidence-item">
                    <strong>
                        ${attackAnalysis.event_count ?? 0}
                    </strong>
                    <span>
                        Security Events
                    </span>
                </div>

                <div class="aegis-evidence-item">
                    <strong>
                        ${attackAnalysis.alert_count ?? 0}
                    </strong>
                    <span>
                        Detection Alerts
                    </span>
                </div>

                <div class="aegis-evidence-item">
                    <strong>
                        ${entity.behavior?.failed_auth_count ?? 0}
                    </strong>
                    <span>
                        Failed Auth
                    </span>
                </div>

                <div class="aegis-evidence-item">
                    <strong>
                        ${entity.behavior?.failure_rate
                            ? Math.round(
                                entity.behavior.failure_rate *
                                100
                            )
                            : 0}%
                    </strong>
                    <span>
                        Failure Rate
                    </span>
                </div>

            </div>


            <div class="aegis-unified-conclusion">

                <div class="aegis-conclusion-icon">
                    ✓
                </div>

                <div>

                    <div class="aegis-conclusion-label">
                        AEGIS X CORRELATION
                    </div>

                    <div class="aegis-conclusion-text">
                        The observed activity from
                        <strong>
                            ${escapeHTML(
                                entity.entity?.value ||
                                incident.source_ip ||
                                "the identified entity"
                            )}
                        </strong>
                        generated a
                        <strong>
                            ${escapeHTML(
                                incident.incident_type ||
                                "security detection"
                            )}
                        </strong>
                        detection and exhibited
                        behavioral deviation according
                        to the UEBA engine.
                    </div>

                </div>

            </div>


            <div class="aegis-unified-footer">
                AEGIS X Intelligence Fabric
                • Detection + UEBA + Attack Chain + MITRE
            </div>
        `;


        const content =
            modal.querySelector(
                "div"
            );

        if (content) {

            /*
             * Insert before the modal footer.
             * If no footer exists, append to modal content.
             */
            content.appendChild(section);

        }

    }


    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /*
     * Watch for the existing UEBA modal.
     */
    const observer =
        new MutationObserver(() => {

            const modal =
                document.getElementById(
                    "aegisUEBAModal"
                );

            if (
                modal &&
                !document.getElementById(
                    "aegisUnifiedCorrelation"
                )
            ) {

                setTimeout(
                    loadUnifiedCorrelation,
                    100
                );

            }

        });


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    /*
     * Styles
     */
    const style =
        document.createElement("style");

    style.textContent = `

        #aegisUnifiedCorrelation {
            margin-top: 28px;
            padding-top: 26px;
            border-top: 1px solid rgba(255,255,255,.08);
        }

        .aegis-unified-header {
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:20px;
        }

        .aegis-unified-eyebrow {
            font-size:10px;
            font-weight:900;
            letter-spacing:.16em;
            color:#62c9ff;
            opacity:.9;
        }

        .aegis-unified-header h2 {
            margin:7px 0 4px;
            font-size:24px;
            font-weight:900;
        }

        .aegis-unified-header p {
            margin:0;
            font-size:12px;
            opacity:.5;
            line-height:1.5;
        }

        .aegis-unified-confidence {
            padding:9px 12px;
            border-radius:999px;
            background:rgba(98,201,255,.1);
            border:1px solid rgba(98,201,255,.18);
            font-size:10px;
            font-weight:900;
            white-space:nowrap;
        }

        .aegis-unified-chain {
            display:flex;
            align-items:center;
            gap:7px;
            margin-top:20px;
            padding:15px;
            overflow-x:auto;
            border-radius:13px;
            background:rgba(255,255,255,.025);
        }

        .aegis-chain-node {
            min-width:125px;
            padding:12px;
            border-radius:10px;
            background:rgba(255,255,255,.045);
            border:1px solid rgba(255,255,255,.06);
        }

        .aegis-chain-node span {
            display:block;
            font-size:8px;
            font-weight:900;
            letter-spacing:.12em;
            opacity:.4;
            margin-bottom:6px;
        }

        .aegis-chain-node strong {
            font-size:11px;
            font-weight:850;
        }

        .aegis-chain-arrow {
            font-size:16px;
            opacity:.3;
            flex-shrink:0;
        }

        .aegis-unified-grid {
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:10px;
            margin-top:12px;
        }

        .aegis-unified-card {
            padding:16px;
            border-radius:12px;
            background:rgba(255,255,255,.035);
            border:1px solid rgba(255,255,255,.055);
        }

        .aegis-unified-card-label {
            font-size:9px;
            font-weight:800;
            letter-spacing:.11em;
            opacity:.42;
        }

        .aegis-unified-big {
            margin-top:8px;
            font-size:18px;
            font-weight:900;
        }

        .aegis-unified-classification {
            font-size:15px;
        }

        .aegis-unified-small {
            margin-top:4px;
            font-size:10px;
            opacity:.45;
        }

        .aegis-unified-title {
            margin-top:24px;
            margin-bottom:9px;
            font-size:9px;
            font-weight:900;
            letter-spacing:.14em;
            opacity:.45;
        }

        .aegis-progression {
            display:flex;
            align-items:center;
            gap:8px;
            overflow-x:auto;
        }

        .aegis-progression-item {
            display:flex;
            align-items:center;
            gap:9px;
            min-width:150px;
            padding:11px;
            border-radius:10px;
            background:rgba(255,255,255,.035);
        }

        .aegis-progression-number {
            display:flex;
            align-items:center;
            justify-content:center;
            width:25px;
            height:25px;
            border-radius:50%;
            background:rgba(98,201,255,.1);
            color:#62c9ff;
            font-size:10px;
            font-weight:900;
        }

        .aegis-progression-item strong {
            display:block;
            font-size:10px;
        }

        .aegis-progression-item small {
            display:block;
            margin-top:3px;
            font-size:8px;
            opacity:.4;
        }

        .aegis-progression-arrow {
            opacity:.3;
        }

        .aegis-mitre-row {
            display:flex;
            gap:8px;
            flex-wrap:wrap;
        }

        .aegis-mitre-card {
            min-width:170px;
            padding:13px;
            border-radius:10px;
            background:rgba(255,255,255,.035);
            border:1px solid rgba(255,255,255,.05);
        }

        .aegis-mitre-id {
            font-family:monospace;
            font-size:10px;
            color:#62c9ff;
            font-weight:900;
        }

        .aegis-mitre-card strong {
            display:block;
            margin-top:5px;
            font-size:12px;
        }

        .aegis-mitre-card small {
            display:block;
            margin-top:4px;
            font-size:9px;
            opacity:.45;
        }

        .aegis-evidence-grid {
            display:grid;
            grid-template-columns:repeat(4,1fr);
            gap:8px;
        }

        .aegis-evidence-item {
            padding:14px;
            text-align:center;
            border-radius:10px;
            background:rgba(255,255,255,.035);
        }

        .aegis-evidence-item strong {
            display:block;
            font-size:20px;
            font-weight:900;
        }

        .aegis-evidence-item span {
            display:block;
            margin-top:4px;
            font-size:9px;
            opacity:.45;
        }

        .aegis-unified-conclusion {
            display:flex;
            gap:12px;
            margin-top:20px;
            padding:16px;
            border-radius:12px;
            background:rgba(98,201,255,.045);
            border:1px solid rgba(98,201,255,.12);
        }

        .aegis-conclusion-icon {
            display:flex;
            align-items:center;
            justify-content:center;
            width:28px;
            height:28px;
            flex-shrink:0;
            border-radius:50%;
            background:rgba(98,201,255,.1);
            color:#62c9ff;
            font-weight:900;
        }

        .aegis-conclusion-label {
            font-size:9px;
            font-weight:900;
            letter-spacing:.12em;
            opacity:.5;
        }

        .aegis-conclusion-text {
            margin-top:6px;
            font-size:11px;
            line-height:1.55;
            opacity:.75;
        }

        .aegis-unified-footer {
            margin-top:16px;
            font-size:9px;
            opacity:.3;
        }

        .aegis-unified-empty {
            padding:12px;
            font-size:10px;
            opacity:.45;
        }

        @media (max-width:700px) {

            .aegis-unified-grid {
                grid-template-columns:1fr;
            }

            .aegis-evidence-grid {
                grid-template-columns:repeat(2,1fr);
            }

            .aegis-unified-header {
                flex-direction:column;
            }

        }

    `;

    document.head.appendChild(style);

    console.log(
        "AEGIS X Unified Intelligence Correlation loaded."
    );

})();
(function () {
    "use strict";

    /* Remove duplicate standalone UEBA modal */
    const modal = document.getElementById("aegisUEBAModal");

    if (modal) {
        modal.remove();
    }

    /* Remove floating RUN UEBA button */
    const button = document.getElementById(
        "aegisSimpleUEBAButton"
    );

    if (button) {
        button.remove();
    }

    /* Remove old unified correlation if it exists */
    const correlation = document.getElementById(
        "aegisUnifiedCorrelation"
    );

    if (correlation) {
        correlation.remove();
    }

    console.log(
        "AEGIS X UI cleanup complete."
    );

})();
(function () {
    "use strict";

    /* ============================================
       AEGIS X — UEBA CLEANUP / SINGLE-PANEL MODE
       ============================================ */

    function cleanupUEBA() {

        /* Remove standalone modal */
        const modal =
            document.getElementById("aegisUEBAModal");

        if (modal) {
            modal.remove();
        }

        /* Remove floating button */
        const button =
            document.getElementById(
                "aegisSimpleUEBAButton"
            );

        if (button) {
            button.remove();
        }

        /* Remove duplicate unified correlation */
        const unified =
            document.getElementById(
                "aegisUnifiedCorrelation"
            );

        if (unified) {
            unified.remove();
        }

        /* Remove any old launcher buttons by text */
        document
            .querySelectorAll("button")
            .forEach(function (btn) {

                const text =
                    (btn.textContent || "")
                        .trim()
                        .toUpperCase();

                if (
                    text.includes("RUN UEBA") ||
                    text.includes("UEBA COMPLETE") ||
                    text.includes("ANALYZING")
                ) {
                    btn.remove();
                }
            });
    }


    /*
     * Run immediately.
     */
    cleanupUEBA();


    /*
     * The old code may recreate the modal after
     * investigation opens. Watch the DOM and remove
     * standalone elements whenever they appear.
     */
    const observer =
        new MutationObserver(function () {

            const modal =
                document.getElementById(
                    "aegisUEBAModal"
                );

            if (modal) {
                modal.remove();
            }

            const button =
                document.getElementById(
                    "aegisSimpleUEBAButton"
                );

            if (button) {
                button.remove();
            }

            const unified =
                document.getElementById(
                    "aegisUnifiedCorrelation"
                );

            if (unified) {
                unified.remove();
            }

        });


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    console.log(
        "AEGIS X — UEBA single-panel mode enabled."
    );

})();

/* =========================================================
   CAMPAIGN INTELLIGENCE
   ========================================================= */

async function loadCampaigns() {

    const summary = document.getElementById("campaignSummary");
    const list = document.getElementById("campaignList");

    if (!summary || !list) {
        console.warn("Campaign Intelligence elements not found.");
        return;
    }

    try {

        const response = await fetch(
            "/api/v1/correlation",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Correlation API returned ${response.status}`
            );
        }

        const data = await response.json();

        const campaigns = Array.isArray(data.campaigns)
            ? data.campaigns
            : [];

        summary.textContent =
            `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`;

        if (!campaigns.length) {

            list.innerHTML = `
                <div class="campaign-empty">
                    No correlated attack campaigns detected.
                </div>
            `;

            return;
        }

        list.innerHTML = campaigns.map(campaign => {

            const riskLevel =
                campaign.risk_level || "UNKNOWN";

            const riskScore =
                campaign.risk_score ?? "N/A";

            const riskClass =
                String(riskLevel).toLowerCase() === "critical"
                    ? "campaign-risk-critical"
                    : String(riskLevel).toLowerCase() === "high"
                        ? "campaign-risk-high"
                        : "campaign-risk-medium";

            const classification =
                campaign.classification ||
                "Correlated Security Activity";

            const source =
                campaign.source_ip ||
                "Unknown source";

            const incidents =
                campaign.incident_count ?? 0;

            const detections =
                campaign.detection_count ?? 0;

            const stages =
                Array.isArray(campaign.attack_progression)
                    ? campaign.attack_progression
                    : [];

            const status =
                campaign.status || "ACTIVE";

            return `
                <article class="campaign-card">

                    <div class="campaign-card-head">

                        <div>

                            <div class="campaign-eyebrow">
                                ATTACK CAMPAIGN
                            </div>

                            <div class="campaign-title">
                                ${esc(classification)}
                            </div>

                            <div class="campaign-source">
                                SOURCE · ${esc(source)}
                            </div>

                        </div>

                        <div class="campaign-risk ${riskClass}">
                            ${esc(riskLevel)}
                            · ${esc(String(riskScore))}
                        </div>

                    </div>

                    <div class="campaign-meta">

                        <span class="campaign-chip">
                            ${incidents}
                            incident${incidents === 1 ? "" : "s"}
                        </span>

                        <span class="campaign-chip">
                            ${detections}
                            detection${detections === 1 ? "" : "s"}
                        </span>

                        <span class="campaign-chip">
                            ${esc(status)}
                        </span>

                        <span class="campaign-chip">
                            24h correlation
                        </span>

                    </div>

                    ${
                        stages.length
                            ? `
                                <div class="campaign-progression">

                                    ${stages.map((stage, index) => `
                                        ${
                                            index > 0
                                                ? `<span class="campaign-arrow">&rarr;</span>`
                                                : ""
                                        }

                                        <span class="campaign-stage">
                                            ${esc(stage)}
                                        </span>
                                    `).join("")}

                                </div>
                            `
                            : ""
                    }

                </article>
            `;

        }).join("");

    } catch (error) {

        console.error(
            "Campaign Intelligence:",
            error
        );

        summary.textContent = "Unavailable";

        list.innerHTML = `
            <div class="campaign-empty">
                Campaign intelligence is currently unavailable.
            </div>
        `;

    }
}
/* =========================================================
   CAMPAIGN INTELLIGENCE STARTUP
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    loadCampaigns();
});


/* =========================================================
   CAMPAIGN INTELLIGENCE STARTUP
   ========================================================= */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadCampaigns);
} else {
    loadCampaigns();
}




/* =========================================================
   CAMPAIGN INTELLIGENCE
   ========================================================= */

async function loadCampaigns() {

    const summary =
        document.getElementById("campaignSummary");

    const list =
        document.getElementById("campaignList");

    if (!summary || !list) {
        return;
    }

    try {

        const response = await fetch(
            "/api/v1/correlation",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Correlation API returned ${response.status}`
            );
        }

        const data = await response.json();

        const campaigns =
            Array.isArray(data.campaigns)
                ? data.campaigns
                : [];

        summary.innerHTML = `
            <strong>${campaigns.length}</strong>
            <span>
                ACTIVE CAMPAIGN${campaigns.length === 1 ? "" : "S"}
            </span>
        `;

        if (!campaigns.length) {

            list.innerHTML = `
                <div class="campaign-empty">
                    No correlated attack campaigns detected.
                </div>
            `;

            return;
        }

        list.innerHTML = campaigns.map(
            (campaign, index) => {

                const riskLevel =
                    campaign.risk_level || "UNKNOWN";

                const riskScore =
                    campaign.risk_score ?? "N/A";

                const riskClass =
                    String(riskLevel).toLowerCase() === "critical"
                        ? "campaign-risk-critical"
                        : String(riskLevel).toLowerCase() === "high"
                            ? "campaign-risk-high"
                            : "campaign-risk-medium";

                const classification =
                    campaign.classification ||
                    "Correlated Security Activity";

                const source =
                    campaign.source_ip ||
                    "Unknown source";

                const incidents =
                    campaign.incident_count ?? 0;

                const detections =
                    campaign.detection_count ?? 0;

                const status =
                    campaign.status || "ACTIVE";

                const progression =
                    Array.isArray(
                        campaign.attack_progression
                    )
                        ? campaign.attack_progression
                        : [];

                const detectionTypes =
                    Array.isArray(
                        campaign.detection_types
                    )
                        ? campaign.detection_types
                        : [];

                return `
                    <article
                        class="campaign-card"
                        data-campaign-source="${esc(source)}"
                    >

                        <div class="campaign-card-top">

                            <div class="campaign-index">
                                ${String(index + 1).padStart(2, "0")}
                            </div>

                            <div class="campaign-main">

                                <div class="campaign-eyebrow">
                                    CORRELATED ATTACK CAMPAIGN
                                </div>

                                <div class="campaign-title">
                                    ${esc(classification)}
                                </div>

                                <div class="campaign-source">
                                    SOURCE
                                    <span>${esc(source)}</span>
                                </div>

                            </div>

                            <div
                                class="campaign-risk ${riskClass}"
                            >

                                <div>
                                    ${esc(riskLevel)}
                                </div>

                                <strong>
                                    ${esc(String(riskScore))}
                                </strong>

                            </div>

                        </div>


                        <div class="campaign-stats">

                            <div class="campaign-stat">

                                <span>INCIDENTS</span>

                                <strong>
                                    ${incidents}
                                </strong>

                            </div>

                            <div class="campaign-stat">

                                <span>DETECTIONS</span>

                                <strong>
                                    ${detections}
                                </strong>

                            </div>

                            <div class="campaign-stat">

                                <span>STATUS</span>

                                <strong>
                                    ${esc(status)}
                                </strong>

                            </div>

                            <div class="campaign-stat">

                                <span>CORRELATION</span>

                                <strong>
                                    24H
                                </strong>

                            </div>

                        </div>


                        ${
                            detectionTypes.length
                                ? `
                                    <div class="campaign-detections">

                                        <span class="campaign-label">
                                            DETECTION TYPES
                                        </span>

                                        <div class="campaign-chip-row">

                                            ${detectionTypes.map(
                                                type => `
                                                    <span
                                                        class="campaign-chip"
                                                    >
                                                        ${esc(type)}
                                                    </span>
                                                `
                                            ).join("")}

                                        </div>

                                    </div>
                                  `
                                : ""
                        }


                        ${
                            progression.length
                                ? `
                                    <div class="campaign-attack-path">

                                        <div class="campaign-label">
                                            ATTACK PROGRESSION
                                        </div>

                                        <div class="campaign-progression">

                                            ${progression.map(
                                                (stage, stageIndex) => `
                                                    ${
                                                        stageIndex > 0
                                                            ? `
                                                                <span
                                                                    class="campaign-arrow"
                                                                >
                                                                    &rarr;
                                                                </span>
                                                              `
                                                            : ""
                                                    }

                                                    <span
                                                        class="campaign-stage"
                                                    >
                                                        ${esc(stage)}
                                                    </span>
                                                `
                                            ).join("")}

                                        </div>

                                    </div>
                                  `
                                : ""
                        }

                    </article>
                `;

            }
        ).join("");

    }
    catch (error) {

        console.error(
            "AEGIS X Campaign Intelligence:",
            error
        );

        summary.innerHTML = `
            <strong>—</strong>
            <span>UNAVAILABLE</span>
        `;

        list.innerHTML = `
            <div class="campaign-empty">

                <strong>
                    Campaign intelligence unavailable
                </strong>

                <span>
                    The correlation engine could not be reached.
                </span>

            </div>
        `;
    }
}


/* =========================================================
   CAMPAIGN INTELLIGENCE STARTUP
   ========================================================= */

function startCampaignIntelligence() {

    if (
        document.getElementById("campaignSummary") &&
        document.getElementById("campaignList")
    ) {

        loadCampaigns();

    }

}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        startCampaignIntelligence,
        {
            once: true
        }
    );

}
else {

    startCampaignIntelligence();

}


/* =========================================================
   CAMPAIGN INVESTIGATION INTERACTION
   ========================================================= */

async function openCampaignInvestigation(sourceIp) {

    const overlay =
        document.getElementById(
            "campaign-investigation-overlay"
        );

    const title =
        document.getElementById(
            "campaignInvestigationTitle"
        );

    const source =
        document.getElementById(
            "campaignInvestigationSource"
        );

    const body =
        document.getElementById(
            "campaignInvestigationBody"
        );

    if (!overlay || !body) {
        return;
    }

    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");

    title.textContent = "Campaign Investigation";
    source.textContent = sourceIp;

    body.innerHTML = `
        <div class="campaign-investigation-loading">
            Analyzing correlated campaign evidence...
        </div>
    `;

    try {

        const response = await fetch(
            `/api/v1/campaigns/${encodeURIComponent(sourceIp)}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Campaign API returned ${response.status}`
            );
        }

        const data = await response.json();

        const campaign =
            data.campaign || {};

        const classification =
            campaign.classification ||
            "Campaign Investigation";

        const riskScore =
            campaign.risk_score ?? "N/A";

        const riskLevel =
            campaign.risk_level || "UNKNOWN";

        const incidents =
            Array.isArray(data.incidents)
                ? data.incidents
                : Array.isArray(campaign.incidents)
                    ? campaign.incidents
                    : [];

        const detections =
            Array.isArray(data.detections)
                ? data.detections
                : [];

        const progression =
            Array.isArray(
                campaign.attack_progression
            )
                ? campaign.attack_progression
                : [];

        const analysis =
            data.analysis || {};

        title.textContent = classification;
        source.textContent =
            `SOURCE · ${sourceIp}`;

        body.innerHTML = `

            <div class="campaign-investigation-grid">

                <div class="campaign-investigation-stat">
                    <span>RISK SCORE</span>
                    <strong>${esc(String(riskScore))}</strong>
                </div>

                <div class="campaign-investigation-stat">
                    <span>RISK LEVEL</span>
                    <strong>${esc(riskLevel)}</strong>
                </div>

                <div class="campaign-investigation-stat">
                    <span>INCIDENTS</span>
                    <strong>${incidents.length}</strong>
                </div>

                <div class="campaign-investigation-stat">
                    <span>DETECTIONS</span>
                    <strong>${detections.length || campaign.detection_count || 0}</strong>
                </div>

            </div>


            ${
                progression.length
                    ? `
                        <section
                            class="campaign-investigation-section"
                        >

                            <h4>
                                Attack Progression
                            </h4>

                            <div class="campaign-story">

                                ${progression.map(
                                    (stage, index) => `
                                        ${
                                            index > 0
                                                ? `
                                                    <span
                                                        class="campaign-story-arrow"
                                                    >
                                                        &rarr;
                                                    </span>
                                                  `
                                                : ""
                                        }

                                        <span
                                            class="campaign-story-stage"
                                        >
                                            ${esc(stage)}
                                        </span>
                                    `
                                ).join("")}

                            </div>

                        </section>
                      `
                    : ""
            }


            <section
                class="campaign-investigation-section"
            >

                <h4>
                    Correlated Incidents
                </h4>

                <div class="campaign-incident-list">

                    ${
                        incidents.length
                            ? incidents.map(
                                incident => `
                                    <div
                                        class="campaign-incident-row"
                                    >

                                        <span
                                            class="campaign-incident-id"
                                        >
                                            #${esc(
                                                String(
                                                    incident.id ??
                                                    "?"
                                                )
                                            )}
                                        </span>

                                        <span
                                            class="campaign-incident-type"
                                        >
                                            ${esc(
                                                incident.incident_type ||
                                                "UNKNOWN"
                                            )}
                                        </span>

                                        <span
                                            class="campaign-incident-risk"
                                        >
                                            ${esc(
                                                incident.risk_level ||
                                                incident.severity ||
                                                "UNKNOWN"
                                            )}
                                            ·
                                            ${esc(
                                                String(
                                                    incident.risk_score ??
                                                    "N/A"
                                                )
                                            )}
                                        </span>

                                    </div>
                                `
                            ).join("")
                            : `
                                <div class="campaign-analysis">
                                    No incident details returned.
                                </div>
                              `
                    }

                </div>

            </section>


            ${
                data.attack_story
                    ? `
                        <section
                            class="campaign-investigation-section"
                        >

                            <h4>
                                Attack Story
                            </h4>

                            <div class="campaign-analysis">

                                ${
                                    typeof data.attack_story === "string"
                                        ? esc(data.attack_story)
                                        : esc(
                                            JSON.stringify(
                                                data.attack_story,
                                                null,
                                                2
                                            )
                                        )
                                }

                            </div>

                        </section>
                      `
                    : ""
            }


            ${
                analysis
                    ? `
                        <section
                            class="campaign-investigation-section"
                        >

                            <h4>
                                Intelligence Analysis
                            </h4>

                            <div class="campaign-analysis">

                                ${
                                    typeof analysis === "string"
                                        ? esc(analysis)
                                        : esc(
                                            JSON.stringify(
                                                analysis,
                                                null,
                                                2
                                            )
                                        )
                                }

                            </div>

                        </section>
                      `
                    : ""
            }

        `;

    }
    catch (error) {

        console.error(
            "Campaign Investigation:",
            error
        );

        body.innerHTML = `
            <div class="campaign-empty">

                <strong>
                    Campaign investigation unavailable
                </strong>

                <span>
                    ${esc(error.message)}
                </span>

            </div>
        `;
    }
}


function closeCampaignInvestigation() {

    const overlay =
        document.getElementById(
            "campaign-investigation-overlay"
        );

    if (!overlay) {
        return;
    }

    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
}


document.addEventListener(
    "click",
    event => {

        const card =
            event.target.closest(
                ".campaign-card"
            );

        if (card) {

            const source =
                card.getAttribute(
                    "data-campaign-source"
                );

            if (source) {
                openCampaignInvestigation(source);
            }

            return;
        }

        if (
            event.target.closest(
                "#closeCampaignInvestigation"
            ) ||
            event.target.classList.contains(
                "campaign-investigation-backdrop"
            )
        ) {

            closeCampaignInvestigation();

        }

    }
);


document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            closeCampaignInvestigation();
        }

    }
);


/* =========================================================
   CAMPAIGN INVESTIGATION — READABLE INTELLIGENCE RENDERER
   ========================================================= */

function renderCampaignIntelligence(data, sourceIp) {

    const body =
        document.getElementById(
            "campaignInvestigationBody"
        );

    if (!body) {
        return;
    }

    const campaign =
        data.campaign || {};

    const threat =
        data.threat_assessment || {};

    const story =
        data.attack_story || {};

    const analysis =
        data.analysis || {};

    const incidents =
        Array.isArray(data.incidents?.items)
            ? data.incidents.items
            : Array.isArray(campaign.incidents)
                ? campaign.incidents
                : [];

    const detections =
        Array.isArray(data.detections?.types)
            ? data.detections.types
            : [];

    const attackChains =
        Array.isArray(data.attack_chains?.items)
            ? data.attack_chains.items
            : [];

    const securityGraph =
        data.security_graph || {};

    const progression =
        Array.isArray(campaign.attack_progression)
            ? campaign.attack_progression
            : [];

    const detectionTypes =
        Array.isArray(campaign.detection_types)
            ? campaign.detection_types
            : [];

    const riskScore =
        campaign.risk_score ??
        threat.risk_score ??
        "N/A";

    const riskLevel =
        campaign.risk_level ||
        threat.risk_level ||
        "UNKNOWN";

    const classification =
        campaign.classification ||
        threat.classification ||
        "Correlated Security Campaign";

    const status =
        campaign.status ||
        "ACTIVE";

    const confidence =
        threat.confidence ??
        data.confidence ??
        "N/A";

    const narrative =
        typeof story === "string"
            ? story
            : Array.isArray(story.narrative)
                ? story.narrative.join(" ")
                : (
                    story.narrative ||
                    story.summary ||
                    analysis.narrative ||
                    analysis.summary ||
                    "AEGIS X correlated related security activity within the defined campaign window."
                );

    const graphNodes =
        securityGraph.node_count ??
        securityGraph.nodes?.length ??
        data.analysis?.unique_graph_nodes ??
        "N/A";

    const graphEdges =
        securityGraph.edge_count ??
        securityGraph.edges?.length ??
        data.analysis?.unique_graph_edges ??
        "N/A";


    const riskClass =
        String(riskLevel).toLowerCase() === "critical"
            ? "campaign-risk-critical"
            : String(riskLevel).toLowerCase() === "high"
                ? "campaign-risk-high"
                : "campaign-risk-medium";


    body.innerHTML = `

        <!-- CAMPAIGN OVERVIEW -->
        <section class="campaign-intel-hero">

            <div class="campaign-intel-hero-main">

                <div class="campaign-eyebrow">
                    CORRELATED THREAT ASSESSMENT
                </div>

                <h3>
                    ${esc(classification)}
                </h3>

                <div class="campaign-narrative">

                    ${
                        Array.isArray(story.narrative)
                            ? story.narrative.map(
                                item => `
                                    <div class="campaign-narrative-item">
                                        <span class="campaign-narrative-dot"></span>
                                        <span>${esc(item)}</span>
                                    </div>
                                `
                            ).join("")
                            : `
                                <div class="campaign-narrative-item">
                                    <span class="campaign-narrative-dot"></span>
                                    <span>${esc(narrative)}</span>
                                </div>
                              `
                    }

                </div>

                <div class="campaign-intel-source">
                    SOURCE
                    <strong>${esc(sourceIp)}</strong>
                </div>

            </div>

            <div class="campaign-intel-risk ${riskClass}">

                <span>${esc(riskLevel)}</span>

                <strong>
                    ${esc(String(riskScore))}
                </strong>

                <small>
                    RISK SCORE
                </small>

            </div>

        </section>


        <!-- ASSESSMENT METRICS -->
        <section class="campaign-investigation-section">

            <h4>
                Campaign Assessment
            </h4>

            <div class="campaign-intel-metrics">

                <div class="campaign-intel-metric">
                    <span>INCIDENTS</span>
                    <strong>${incidents.length}</strong>
                </div>

                <div class="campaign-intel-metric">
                    <span>DETECTIONS</span>
                    <strong>
                        ${detections.length || campaign.detection_count || 0}
                    </strong>
                </div>

                <div class="campaign-intel-metric">
                    <span>CONFIDENCE</span>
                    <strong>${esc(String(confidence))}</strong>
                </div>

                <div class="campaign-intel-metric">
                    <span>STATUS</span>
                    <strong>${esc(status)}</strong>
                </div>

            </div>

        </section>


        <!-- ATTACK STORY -->
        <section class="campaign-investigation-section">

            <div class="campaign-section-title-row">

                <div>
                    <h4>Attack Story</h4>

                    <p class="campaign-section-subtitle">
                        Correlated progression identified by AEGIS X.
                    </p>
                </div>

                <span class="campaign-intel-badge">
                    ${progression.length}
                    STAGE${progression.length === 1 ? "" : "S"}
                </span>

            </div>


            ${
                progression.length
                    ? `
                        <div class="campaign-story">

                            ${progression.map(
                                (stage, index) => `
                                    ${
                                        index > 0
                                            ? `
                                                <span class="campaign-story-arrow">
                                                    &rarr;
                                                </span>
                                              `
                                            : ""
                                    }

                                    <span class="campaign-story-stage">
                                        ${esc(stage)}
                                    </span>
                                `
                            ).join("")}

                        </div>
                      `
                    : `
                        <div class="campaign-analysis">
                            No multi-stage progression was returned.
                        </div>
                      `
            }

        </section>


        <!-- DETECTION SIGNALS -->
        <section class="campaign-investigation-section">

            <h4>
                Detection Signals
            </h4>

            ${
                detectionTypes.length
                    ? `
                        <div class="campaign-chip-row">

                            ${detectionTypes.map(
                                type => `
                                    <span class="campaign-chip">
                                        ${esc(type)}
                                    </span>
                                `
                            ).join("")}

                        </div>
                      `
                    : `
                        <div class="campaign-analysis">
                            No detection types returned.
                        </div>
                      `
            }

        </section>


        <!-- CORRELATED INCIDENTS -->
        <section class="campaign-investigation-section">

            <h4>
                Correlated Incidents
            </h4>

            <div class="campaign-incident-list">

                ${
                    incidents.length
                        ? incidents.map(
                            incident => {

                                const incidentRisk =
                                    incident.risk_level ||
                                    incident.severity ||
                                    "UNKNOWN";

                                return `
                                    <div class="campaign-incident-row">

                                        <span class="campaign-incident-id">
                                            #${esc(
                                                String(
                                                    incident.id ?? "?"
                                                )
                                            )}
                                        </span>

                                        <div>

                                            <div class="campaign-incident-type">
                                                ${esc(
                                                    incident.incident_type ||
                                                    "UNKNOWN"
                                                )}
                                            </div>

                                            ${
                                                incident.description
                                                    ? `
                                                        <div class="campaign-incident-description">
                                                            ${esc(
                                                                incident.description
                                                            )}
                                                        </div>
                                                      `
                                                    : ""
                                            }

                                        </div>

                                        <span
                                            class="campaign-incident-risk"
                                        >
                                            ${esc(incidentRisk)}
                                            ·
                                            ${esc(
                                                String(
                                                    incident.risk_score ??
                                                    "N/A"
                                                )
                                            )}
                                        </span>

                                    </div>
                                `;
                            }
                        ).join("")
                        : `
                            <div class="campaign-analysis">
                                No correlated incident details returned.
                            </div>
                          `
                }

            </div>

        </section>


        <!-- ENGINE INTELLIGENCE -->
        <section class="campaign-investigation-section">

            <h4>
                Intelligence Analysis
            </h4>

            <div class="campaign-intelligence-grid">

                <div class="campaign-intelligence-card">

                    <span>ATTACK CHAINS</span>

                    <strong>
                        ${attackChains.length}
                    </strong>

                    <small>
                        correlated investigation paths
                    </small>

                </div>


                <div class="campaign-intelligence-card">

                    <span>GRAPH NODES</span>

                    <strong>
                        ${esc(String(graphNodes))}
                    </strong>

                    <small>
                        security entities
                    </small>

                </div>


                <div class="campaign-intelligence-card">

                    <span>GRAPH EDGES</span>

                    <strong>
                        ${esc(String(graphEdges))}
                    </strong>

                    <small>
                        relationships
                    </small>

                </div>


                <div class="campaign-intelligence-card">

                    <span>CORRELATION</span>

                    <strong>
                        24H
                    </strong>

                    <small>
                        source-IP time window
                    </small>

                </div>

            </div>


            <div class="campaign-analysis-summary">

                <div class="campaign-analysis-icon">
                    AI
                </div>

                <div>

                    <strong>
                        AEGIS X Intelligence Engine
                    </strong>

                    <p>
                        ${
                            typeof analysis === "string"
                                ? esc(analysis)
                                : esc(
                                    analysis.summary ||
                                    analysis.conclusion ||
                                    "The correlation engine linked related incidents into a single campaign based on source identity and temporal proximity."
                                )
                        }
                    </p>

                </div>

            </div>

        </section>

    `;
}



/* =========================================================
   CAMPAIGN INVESTIGATION — RENDER HOOK
   ========================================================= */

const originalOpenCampaignInvestigation =
    window.openCampaignInvestigation;

window.openCampaignInvestigation =
    async function(sourceIp) {

        const overlay =
            document.getElementById(
                "campaign-investigation-overlay"
            );

        const title =
            document.getElementById(
                "campaignInvestigationTitle"
            );

        const source =
            document.getElementById(
                "campaignInvestigationSource"
            );

        const body =
            document.getElementById(
                "campaignInvestigationBody"
            );

        if (!overlay || !body) {
            return;
        }

        overlay.classList.add("active");
        overlay.setAttribute(
            "aria-hidden",
            "false"
        );

        title.textContent =
            "Campaign Investigation";

        source.textContent =
            `SOURCE · ${sourceIp}`;

        body.innerHTML = `
            <div class="campaign-investigation-loading">
                Analyzing correlated campaign evidence...
            </div>
        `;

        try {

            const response = await fetch(
                `/api/v1/campaigns/${encodeURIComponent(sourceIp)}`,
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Campaign API returned ${response.status}`
                );
            }

            const data =
                await response.json();

            const campaign =
                data.campaign || {};

            title.textContent =
                campaign.classification ||
                "Campaign Investigation";

            source.textContent =
                `SOURCE · ${sourceIp}`;

            renderCampaignIntelligence(
                data,
                sourceIp
            );

            renderCampaignSecurityGraph(data);

requestAnimationFrame(() => {
    fitCampaignSecurityGraphViewportV2();
});

setTimeout(() => {
    fitCampaignSecurityGraphViewportV2();
}, 150);
    requestAnimationFrame(() => initCampaignEdgeInspector());
    requestAnimationFrame(() => fitCampaignSecurityGraphViewport());

        }
        catch (error) {

            console.error(
                "Campaign Investigation:",
                error
            );

            body.innerHTML = `
                <div class="campaign-empty">

                    <strong>
                        Campaign investigation unavailable
                    </strong>

                    <span>
                        ${esc(error.message)}
                    </span>

                </div>
            `;
        }
    };






/* =========================================================
   CAMPAIGN SECURITY GRAPH
   ========================================================= */

function resolveCampaignGraphRelationship(edge, source, target) {
    const explicit =
        edge?.relationship ||
        edge?.label ||
        edge?.type;

    if (explicit) {
        return String(explicit).toUpperCase();
    }

    const sourceType =
        String(source?.type || "").toUpperCase();

    const targetType =
        String(target?.type || "").toUpperCase();

    const mapping = {
        "SOURCE->EVENT": "GENERATES",
        "EVENT->DETECTION": "TRIGGERS",
        "DETECTION->ALERT": "GENERATES_ALERT",
        "ALERT->RISK": "INFLUENCES_RISK",
        "RISK->INCIDENT": "ESCALATES_TO",
        "INCIDENT->INCIDENT": "CAMPAIGN_SEQUENCE",
        "INCIDENT->RESPONSE": "RESPONDED_BY",
        "INCIDENT->STATUS": "HAS_STATUS",
        "RESPONSE->STATUS": "RESULTS_IN"
    };

    return (
        mapping[`${sourceType}->${targetType}`] ||
        "RELATED_TO"
    );
}

function fitCampaignSecurityGraphViewportV2() {
    const svg =
        document.getElementById(
            "campaignSecurityGraph"
        );

    if (!svg) {
        return;
    }

    const nodes = Array.from(
        svg.querySelectorAll(
            ".campaign-graph-node"
        )
    );

    if (!nodes.length) {
        return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
        try {
            const box = node.getBBox();

            if (
                !Number.isFinite(box.x) ||
                !Number.isFinite(box.y) ||
                !Number.isFinite(box.width) ||
                !Number.isFinite(box.height)
            ) {
                return;
            }

            minX =
                Math.min(
                    minX,
                    box.x
                );

            minY =
                Math.min(
                    minY,
                    box.y
                );

            maxX =
                Math.max(
                    maxX,
                    box.x + box.width
                );

            maxY =
                Math.max(
                    maxY,
                    box.y + box.height
                );
        }
        catch (error) {
            // Ignore unavailable SVG bounds.
        }
    });

    if (
        !Number.isFinite(minX) ||
        !Number.isFinite(minY) ||
        !Number.isFinite(maxX) ||
        !Number.isFinite(maxY)
    ) {
        return;
    }

    const paddingX = 120;
    const paddingY = 95;

    const x =
        minX - paddingX;

    const y =
        minY - paddingY;

    const width =
        Math.max(
            500,
            maxX - minX + paddingX * 2
        );

    const height =
        Math.max(
            350,
            maxY - minY + paddingY * 2
        );

    svg.setAttribute(
        "viewBox",
        `${x} ${y} ${width} ${height}`
    );

    svg.setAttribute(
        "preserveAspectRatio",
        "xMidYMid meet"
    );
}
function renderCampaignSecurityGraph(data) {
    const body = document.getElementById("campaignInvestigationBody");

    if (!body) {
        return;
    }

    const existing = document.getElementById("campaignSecurityGraphSection");

    if (existing) {
        existing.remove();
    }

    const securityGraph =
        data?.security_graph ||
        data?.securityGraph ||
        {};

    const nodes = Array.isArray(securityGraph.nodes)
        ? securityGraph.nodes
        : [];

    const edges = Array.isArray(securityGraph.edges)
        ? securityGraph.edges
        : [];

    if (!nodes.length) {
        return;
    }

    const section = document.createElement("section");

    section.id = "campaignSecurityGraphSection";
    section.className = "campaign-graph-section campaign-graph-v16";

    section.innerHTML = `
        <div class="campaign-graph-header">
            <div>
                <div class="campaign-graph-kicker">
                    SECURITY RELATIONSHIP MODEL
                </div>

                <h3>
                    Campaign Security Graph
                </h3>

                <p>
                    Interactive attack-path visualization showing how
                    security evidence connects across the campaign.
                </p>
            </div>

            <div class="campaign-graph-controls">
                <button
                    type="button"
                    class="campaign-graph-control"
                    data-graph-action="zoom-out"
                    title="Zoom out"
                >−</button>

                <button
                    type="button"
                    class="campaign-graph-control campaign-graph-zoom-value"
                    data-graph-action="fit"
                    title="Fit graph to screen"
                >100%</button>

                <button
                    type="button"
                    class="campaign-graph-control"
                    data-graph-action="zoom-in"
                    title="Zoom in"
                >+</button>

                <button
                    type="button"
                    class="campaign-graph-control campaign-graph-fit"
                    data-graph-action="fit"
                    title="Reset graph view"
                >
                    Fit
                </button>
            </div>
        </div>

        <div class="campaign-graph-counts">
            <div class="campaign-graph-stat">
                <span class="campaign-graph-stat-value">${nodes.length}</span>
                <span class="campaign-graph-stat-label">Nodes</span>
            </div>

            <div class="campaign-graph-stat">
                <span class="campaign-graph-stat-value">${edges.length}</span>
                <span class="campaign-graph-stat-label">Relationships</span>
            </div>

            <div class="campaign-graph-stat">
                <span class="campaign-graph-stat-value">
                    ${new Set(nodes.map(n => String(n.type || "").toUpperCase())).size}
                </span>
                <span class="campaign-graph-stat-label">Entity Types</span>
            </div>

            <div class="campaign-graph-flow-status">
                <span class="campaign-flow-dot"></span>
                LIVE INVESTIGATION MODEL
            </div>
        </div>

        <div class="campaign-graph-wrapper" id="campaignGraphViewport">

            <svg
                id="campaignSecurityGraph"
                class="campaign-security-graph"
                viewBox="0 0 1800 850"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Campaign Security Graph"
            >
                <defs>

                    <marker
                        id="campaignGraphArrow"
                        markerWidth="10"
                        markerHeight="10"
                        refX="8"
                        refY="5"
                        orient="auto"
                        markerUnits="strokeWidth"
                    >
                        <path d="M 0 0 L 10 5 L 0 10 z"></path>
                    </marker>

                    <filter
                        id="campaignGraphGlow"
                        x="-100%"
                        y="-100%"
                        width="300%"
                        height="300%"
                    >
                        <feGaussianBlur
                            stdDeviation="5"
                            result="blur"
                        />
                        <feMerge>
                            <feMergeNode in="blur"></feMergeNode>
                            <feMergeNode in="SourceGraphic"></feMergeNode>
                        </feMerge>
                    </filter>
                </defs>

                <rect
                    class="campaign-graph-background"
                    x="0"
                    y="0"
                    width="1800"
                    height="850"
                    rx="20"
                ></rect>

                <g id="campaignGraphGrid"></g>

                <g
                    id="campaignGraphScene"
                    transform="translate(0 0) scale(1)"
                >
                    <g id="campaignGraphEdges"></g>
                    <g id="campaignGraphNodes"></g>
                </g>
            </svg>

            <div
                id="campaignGraphTooltip"
                class="campaign-graph-tooltip"
                aria-hidden="true"
            ></div>

            <div class="campaign-graph-hint">
                <span>Drag</span> to pan
                <span>•</span>
                <span>Scroll</span> to zoom
                <span>•</span>
                <span>Click</span> a node to isolate its path
            </div>
        </div>

        <div class="campaign-graph-legend">
            <div class="campaign-graph-legend-title">
                ENTITY TYPES
            </div>

            <div class="campaign-graph-legend-items">

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-source"></i>
                    Source
                </span>

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-event"></i>
                    Event
                </span>

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-detection"></i>
                    Detection
                </span>

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-alert"></i>
                    Alert
                </span>

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-risk"></i>
                    Risk
                </span>

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-incident"></i>
                    Incident
                </span>

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-response"></i>
                    Response
                </span>

                <span class="campaign-graph-legend-item">
                    <i class="campaign-node-dot node-status"></i>
                    Status
                </span>

            </div>
        </div>
    `;

    body.appendChild(section);


    // -----------------------------------------------------
    // GRAPH CONSTANTS
    // -----------------------------------------------------

    const svg = document.getElementById("campaignSecurityGraph");
    const scene = document.getElementById("campaignGraphScene");
    const edgesLayer = document.getElementById("campaignGraphEdges");
    const nodesLayer = document.getElementById("campaignGraphNodes");
    const tooltip = document.getElementById("campaignGraphTooltip");
    const viewport = document.getElementById("campaignGraphViewport");

    const SVG_NS = "http://www.w3.org/2000/svg";

    const WIDTH = 1800;
    const HEIGHT = 850;

    const TYPE_ORDER = [
        "SOURCE",
        "EVENT",
        "DETECTION",
        "ALERT",
        "RISK",
        "INCIDENT",
        "RESPONSE",
        "STATUS"
    ];

    const TYPE_META = {
        SOURCE: {
            label: "SOURCE",
            className: "node-source",
            color: "#4cc9f0"
        },

        EVENT: {
            label: "EVENT",
            className: "node-event",
            color: "#8b5cf6"
        },

        DETECTION: {
            label: "DETECTION",
            className: "node-detection",
            color: "#f59e0b"
        },

        ALERT: {
            label: "ALERT",
            className: "node-alert",
            color: "#fb7185"
        },

        RISK: {
            label: "RISK",
            className: "node-risk",
            color: "#ef4444"
        },

        INCIDENT: {
            label: "INCIDENT",
            className: "node-incident",
            color: "#f43f5e"
        },

        RESPONSE: {
            label: "RESPONSE",
            className: "node-response",
            color: "#22c55e"
        },

        STATUS: {
            label: "STATUS",
            className: "node-status",
            color: "#38bdf8"
        }
    };


    // -----------------------------------------------------
    // NORMALIZE GRAPH DATA
    // -----------------------------------------------------

    const normalizedNodes = nodes.map((node, index) => {

        const rawType = String(
            node.type ||
            node.node_type ||
            "EVENT"
        ).toUpperCase();

        const type = TYPE_META[rawType]
            ? rawType
            : "EVENT";

        const id = String(
            node.id ??
            node.node_id ??
            `${type}-${index + 1}`
        );

        const label = String(
            node.label ??
            node.name ??
            node.title ??
            node.value ??
            id
        );

        const description = String(
            node.description ??
            node.message ??
            node.detail ??
            node.reason ??
            ""
        );

        return {
            ...node,
            id,
            type,
            label,
            description
        };
    });


    const nodeMap = new Map(
        normalizedNodes.map(node => [String(node.id), node])
    );


    // -----------------------------------------------------
    // CREATE GRID
    // -----------------------------------------------------

    const grid = document.getElementById("campaignGraphGrid");

    for (let x = 0; x <= WIDTH; x += 100) {

        const line = document.createElementNS(
            SVG_NS,
            "line"
        );

        line.setAttribute("x1", x);
        line.setAttribute("y1", 0);
        line.setAttribute("x2", x);
        line.setAttribute("y2", HEIGHT);

        line.classList.add("campaign-graph-grid-line");

        grid.appendChild(line);
    }

    for (let y = 0; y <= HEIGHT; y += 100) {

        const line = document.createElementNS(
            SVG_NS,
            "line"
        );

        line.setAttribute("x1", 0);
        line.setAttribute("y1", y);
        line.setAttribute("x2", WIDTH);
        line.setAttribute("y2", y);

        line.classList.add("campaign-graph-grid-line");

        grid.appendChild(line);
    }


    // -----------------------------------------------------
    // LANE POSITIONS
    // -----------------------------------------------------

    const grouped = {};

    TYPE_ORDER.forEach(type => {
        grouped[type] = [];
    });

    normalizedNodes.forEach(node => {

        if (!grouped[node.type]) {
            grouped[node.type] = [];
        }

        grouped[node.type].push(node);
    });


    const activeTypes = TYPE_ORDER.filter(
        type => grouped[type] && grouped[type].length
    );

    const laneCount = Math.max(activeTypes.length, 1);

    const leftPadding = 100;
    const rightPadding = 100;

    const laneWidth =
        (WIDTH - leftPadding - rightPadding) /
        Math.max(laneCount - 1, 1);


    activeTypes.forEach((type, laneIndex) => {

        const items = grouped[type];

        const x =
            laneCount === 1
                ? WIDTH / 2
                : leftPadding + laneIndex * laneWidth;

        const verticalGap =
            Math.min(
                145,
                (HEIGHT - 180) /
                Math.max(items.length, 1)
            );

        const totalHeight =
            verticalGap *
            Math.max(items.length - 1, 0);

        const startY =
            (HEIGHT - totalHeight) / 2;

        items.forEach((node, itemIndex) => {

            node.x = x;

            node.y =
                startY +
                itemIndex * verticalGap;
        });
    });


    // -----------------------------------------------------
    // EDGE HELPERS
    // -----------------------------------------------------

    function getEdgeEndpoints(edge) {

        const sourceId = String(
            edge.source ??
            edge.from ??
            edge.source_id ??
            ""
        );

        const targetId = String(
            edge.target ??
            edge.to ??
            edge.target_id ??
            ""
        );

        return {
            source: nodeMap.get(sourceId),
            target: nodeMap.get(targetId)
        };
    }


    function createSvgElement(tag, attrs = {}) {

        const element =
            document.createElementNS(
                SVG_NS,
                tag
            );

        Object.entries(attrs).forEach(
            ([key, value]) => {
                element.setAttribute(
                    key,
                    String(value)
                );
            }
        );

        return element;
    }


    // -----------------------------------------------------
    // DRAW EDGES
    // -----------------------------------------------------

    const renderedEdges = [];

    edges.forEach((edge, index) => {

        const { source, target } =
            getEdgeEndpoints(edge);

        if (!source || !target) {
            return;
        }

        const group =
            createSvgElement("g", {
                class:
                    "campaign-graph-edge-group"
            });

        const dx =
            Math.max(
                80,
                Math.abs(target.x - source.x) * 0.45
            );

        const path =
            createSvgElement("path", {
                d:
                    `M ${source.x} ${source.y}
                     C ${source.x + dx} ${source.y},
                       ${target.x - dx} ${target.y},
                       ${target.x} ${target.y}`,
                class: "campaign-graph-edge",
                "data-source": source.id,
                "data-target": target.id,
                "data-edge-index": index,
                "data-relationship":
                    edge.relationship ||
                    edge.label ||
                    edge.type ||
                    "RELATED_TO",
                "marker-end":
                    "url(#campaignGraphArrow)"
            });

        group.appendChild(path);

        const edgeLabel =
            resolveCampaignGraphRelationship(
                edge,
                source,
                target
            );

        if (edgeLabel) {

            const midX =
                (source.x + target.x) / 2;

            const midY =
                (source.y + target.y) / 2;

            const text =
                createSvgElement("text", {
                    x: midX,
                    y: midY - 8,
                    class:
                        "campaign-graph-edge-label"
                });

            text.textContent =
                String(edgeLabel)
                    .replaceAll("_", " ");

            group.appendChild(text);
        }

        edgesLayer.appendChild(group);

        renderedEdges.push({
            group,
            path,
            source,
            target
        });
    });


    // -----------------------------------------------------
    // NODE HELPERS
    // -----------------------------------------------------

    function shortLabel(value, max = 22) {

        const text = String(value);

        if (text.length <= max) {
            return text;
        }

        return text.slice(0, max - 1) + "…";
    }


    function nodeDetail(node) {

        const values = [];

        if (node.type) {
            values.push(
                `<div><b>Type</b><span>${node.type}</span></div>`
            );
        }

        if (node.id) {
            values.push(
                `<div><b>ID</b><span>${node.id}</span></div>`
            );
        }

        if (node.description) {
            values.push(
                `<div><b>Details</b><span>${node.description}</span></div>`
            );
        }

        if (node.severity) {
            values.push(
                `<div><b>Severity</b><span>${node.severity}</span></div>`
            );
        }

        if (node.risk_score !== undefined) {
            values.push(
                `<div><b>Risk</b><span>${node.risk_score}</span></div>`
            );
        }

        return values.join("");
    }


    // -----------------------------------------------------
    // DRAW NODES
    // -----------------------------------------------------

    const nodeElements = new Map();

    normalizedNodes.forEach(node => {

        const meta =
            TYPE_META[node.type];

        const group =
            createSvgElement("g", {
                class:
                    `campaign-graph-node ${meta.className}`,
                "data-node-id": node.id
            });

        const glow =
            createSvgElement("circle", {
                cx: node.x,
                cy: node.y,
                r: 34,
                class:
                    "campaign-graph-node-glow"
            });

        const circle =
            createSvgElement("circle", {
                cx: node.x,
                cy: node.y,
                r: 27,
                class:
                    "campaign-graph-node-circle"
            });

        circle.style.setProperty(
            "--node-accent",
            meta.color
        );

        const text =
            createSvgElement("text", {
                x: node.x,
                y: node.y + 5,
                class:
                    "campaign-graph-node-type"
            });

        text.textContent =
            node.type.slice(0, 4);

        const label =
            createSvgElement("text", {
                x: node.x,
                y: node.y + 52,
                class:
                    "campaign-graph-node-label"
            });

        label.textContent =
            shortLabel(node.label);

        group.appendChild(glow);
        group.appendChild(circle);
        group.appendChild(text);
        group.appendChild(label);

        nodesLayer.appendChild(group);

        nodeElements.set(
            node.id,
            group
        );


        // Hover
        group.addEventListener(
            "mouseenter",
            event => {

                if (
                    window.__aegisCampaignGraphDragging
                ) {
                    return;
                }

                tooltip.innerHTML = `
                    <div class="campaign-graph-tooltip-type">
                        ${node.type}
                    </div>

                    <div class="campaign-graph-tooltip-title">
                        ${node.label}
                    </div>

                    <div class="campaign-graph-tooltip-data">
                        ${nodeDetail(node)}
                    </div>
                `;

                tooltip.classList.add("visible");

                positionTooltip(event);
            }
        );


        group.addEventListener(
            "mousemove",
            event => {
                positionTooltip(event);
            }
        );


        group.addEventListener(
            "mouseleave",
            () => {
                tooltip.classList.remove("visible");
            }
        );


        // Click = isolate path
        group.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                isolateNodePath(node.id);
            }
        );
    });


    function positionTooltip(event) {

        const rect =
            viewport.getBoundingClientRect();

        let left =
            event.clientX -
            rect.left +
            18;

        let top =
            event.clientY -
            rect.top +
            18;

        const tooltipWidth =
            tooltip.offsetWidth || 280;

        const tooltipHeight =
            tooltip.offsetHeight || 120;

        if (
            left + tooltipWidth >
            rect.width
        ) {
            left =
                event.clientX -
                rect.left -
                tooltipWidth -
                18;
        }

        if (
            top + tooltipHeight >
            rect.height
        ) {
            top =
                event.clientY -
                rect.top -
                tooltipHeight -
                18;
        }

        tooltip.style.left =
            `${Math.max(8, left)}px`;

        tooltip.style.top =
            `${Math.max(8, top)}px`;
    }


    // -----------------------------------------------------
    // NODE PATH ISOLATION
    // -----------------------------------------------------

    function isolateNodePath(nodeId) {

        const connected = new Set([
            nodeId
        ]);

        renderedEdges.forEach(item => {

            if (
                item.source.id === nodeId ||
                item.target.id === nodeId
            ) {
                connected.add(
                    item.source.id
                );

                connected.add(
                    item.target.id
                );
            }
        });


        nodeElements.forEach(
            (element, id) => {

                element.classList.toggle(
                    "is-muted",
                    !connected.has(id)
                );

                element.classList.toggle(
                    "is-selected",
                    id === nodeId
                );
            }
        );


        renderedEdges.forEach(item => {

            const active =
                item.source.id === nodeId ||
                item.target.id === nodeId;

            item.group.classList.toggle(
                "is-muted",
                !active
            );

            item.group.classList.toggle(
                "is-active",
                active
            );
        });
    }


    function clearIsolation() {

        nodeElements.forEach(
            element => {
                element.classList.remove(
                    "is-muted",
                    "is-selected"
                );
            }
        );

        renderedEdges.forEach(
            item => {
                item.group.classList.remove(
                    "is-muted",
                    "is-active"
                );
            }
        );
    }


    svg.addEventListener(
        "click",
        () => {
            clearIsolation();
        }
    );


    // -----------------------------------------------------
    // ZOOM + PAN
    // -----------------------------------------------------

    let scale = 1;
    let panX = 0;
    let panY = 0;

    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOriginX = 0;
    let dragOriginY = 0;

    window.__aegisCampaignGraphDragging = false;


    function applyTransform() {

        scene.setAttribute(
            "transform",
            `translate(${panX} ${panY}) scale(${scale})`
        );

        const zoomLabel =
            section.querySelector(
                ".campaign-graph-zoom-value"
            );

        if (zoomLabel) {

            zoomLabel.textContent =
                `${Math.round(scale * 100)}%`;
        }
    }


    function fitGraph() {

        scale = 1;
        panX = 0;
        panY = 0;

        applyTransform();
    }


    function changeZoom(delta) {

        scale =
            Math.max(
                0.55,
                Math.min(
                    2.4,
                    scale + delta
                )
            );

        applyTransform();
    }


    section
        .querySelectorAll(
            "[data-graph-action]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const action =
                        button.dataset.graphAction;

                    if (
                        action === "zoom-in"
                    ) {
                        changeZoom(0.15);
                    }

                    if (
                        action === "zoom-out"
                    ) {
                        changeZoom(-0.15);
                    }

                    if (
                        action === "fit"
                    ) {
                        fitGraph();
                    }
                }
            );
        });


    svg.addEventListener(
        "wheel",
        event => {

            event.preventDefault();

            changeZoom(
                event.deltaY < 0
                    ? 0.08
                    : -0.08
            );
        },
        { passive: false }
    );


    svg.addEventListener(
        "mousedown",
        event => {

            if (
                event.target.closest(
                    ".campaign-graph-node"
                )
            ) {
                return;
            }

            dragging = true;

            window.__aegisCampaignGraphDragging =
                true;

            dragStartX = event.clientX;
            dragStartY = event.clientY;

            dragOriginX = panX;
            dragOriginY = panY;

            svg.classList.add(
                "is-dragging"
            );
        }
    );


    window.addEventListener(
        "mousemove",
        event => {

            if (!dragging) {
                return;
            }

            const rect =
                svg.getBoundingClientRect();

            const scaleX =
                WIDTH / rect.width;

            const scaleY =
                HEIGHT / rect.height;

            panX =
                dragOriginX +
                (event.clientX - dragStartX) *
                scaleX;

            panY =
                dragOriginY +
                (event.clientY - dragStartY) *
                scaleY;

            applyTransform();
        }
    );


    window.addEventListener(
        "mouseup",
        () => {

            if (!dragging) {
                return;
            }

            dragging = false;

            window.__aegisCampaignGraphDragging =
                false;

            svg.classList.remove(
                "is-dragging"
            );
        }
    );


    // Initial render
    applyTransform();
}


function fitCampaignSecurityGraphViewport() {
    const svg = document.getElementById("campaignSecurityGraph");
    const wrapper = document.querySelector(".campaign-graph-wrapper");

    if (!svg || !wrapper) return;

    try {
        const graphNodes = Array.from(
            svg.querySelectorAll(".campaign-graph-node")
        );

        if (!graphNodes.length) return;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        graphNodes.forEach((node) => {
            try {
                const box = node.getBBox();

                minX = Math.min(minX, box.x);
                minY = Math.min(minY, box.y);
                maxX = Math.max(maxX, box.x + box.width);
                maxY = Math.max(maxY, box.y + box.height);
            } catch (_) {
                // Ignore nodes that do not expose a measurable SVG box.
            }
        });

        if (!Number.isFinite(minX)) return;

        const paddingX = 90;
        const paddingY = 70;

        minX -= paddingX;
        minY -= paddingY;
        maxX += paddingX;
        maxY += paddingY;

        const width = Math.max(maxX - minX, 900);
        const height = Math.max(maxY - minY, 560);

        svg.setAttribute(
            "viewBox",
            `${minX} ${minY} ${width} ${height}`
        );

        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.minWidth = "0";

        wrapper.classList.add("campaign-graph-auto-fitted");

        // Recalculate when the investigation panel changes size.
        if (!wrapper.dataset.resizeBound) {
            const resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    fitCampaignSecurityGraphViewport();
                });
            });

            resizeObserver.observe(wrapper);
            wrapper.dataset.resizeBound = "true";
        }
    } catch (error) {
        console.warn(
            "Campaign Security Graph auto-fit skipped:",
            error
        );
    }
}




/* =========================================================
   AEGIS X — TIGHT CAMPAIGN GRAPH AUTO-FIT
   Keeps the full campaign graph visible while minimizing
   unnecessary empty SVG space.
   ========================================================= */

function fitCampaignSecurityGraphViewport() {
    const svg = document.getElementById("campaignSecurityGraph");

    if (!svg) {
        return;
    }

    const elements = Array.from(
        svg.querySelectorAll(
            ".campaign-graph-node, .campaign-graph-edge, .campaign-graph-edge-label"
        )
    );

    if (!elements.length) {
        return;
    }

    let bounds = null;

    elements.forEach((element) => {
        try {
            const box = element.getBBox();

            if (
                !box ||
                !Number.isFinite(box.x) ||
                !Number.isFinite(box.y) ||
                !Number.isFinite(box.width) ||
                !Number.isFinite(box.height)
            ) {
                return;
            }

            if (!bounds) {
                bounds = {
                    x: box.x,
                    y: box.y,
                    right: box.x + box.width,
                    bottom: box.y + box.height
                };
                return;
            }

            bounds.x = Math.min(bounds.x, box.x);
            bounds.y = Math.min(bounds.y, box.y);
            bounds.right = Math.max(
                bounds.right,
                box.x + box.width
            );
            bounds.bottom = Math.max(
                bounds.bottom,
                box.y + box.height
            );
        } catch (error) {
            // Ignore elements whose SVG bounding box is unavailable.
        }
    });

    if (!bounds) {
        return;
    }

    const paddingX = 90;
    const paddingY = 70;

    const x = bounds.x - paddingX;
    const y = bounds.y - paddingY;

    const width =
        Math.max(
            300,
            bounds.right - bounds.x + paddingX * 2
        );

    const height =
        Math.max(
            250,
            bounds.bottom - bounds.y + paddingY * 2
        );

    svg.setAttribute(
        "viewBox",
        `${x} ${y} ${width} ${height}`
    );

    svg.setAttribute(
        "preserveAspectRatio",
        "xMidYMid meet"
    );
}

/* Re-fit after the browser has completed SVG layout. */
requestAnimationFrame(() => {
    fitCampaignSecurityGraphViewport();
});

/* Re-fit when the investigation panel changes size. */
(() => {
    const svg = document.getElementById(
        "campaignSecurityGraph"
    );

    const wrapper = document.querySelector(
        ".campaign-graph-wrapper"
    );

    if (!svg || !wrapper) {
        return;
    }

    if (
        typeof ResizeObserver !== "undefined" &&
        !wrapper.__campaignGraphFitObserver
    ) {
        wrapper.__campaignGraphFitObserver =
            new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    fitCampaignSecurityGraphViewport();
                });
            });

        wrapper.__campaignGraphFitObserver.observe(wrapper);
    }
})();









// ============================================================
// AEGIS X AUTO-FIX
// ============================================================

async function autoFixIncident(incidentId) {

    if (!incidentId) {
        return;
    }

    try {

        // ----------------------------------------------------
        // STEP 1 - GET REMEDIATION PLAN
        // ----------------------------------------------------

        const previewResponse =
            await fetch(
                `/api/v1/incidents/${incidentId}/auto-fix/preview`
            );

        const preview =
            await previewResponse.json();

        if (!previewResponse.ok) {

            throw new Error(
                preview.detail ||
                "Unable to create remediation plan."
            );
        }


        const incident =
            preview.incident || {};

        const response =
            preview.recommended_response || {};


        // ----------------------------------------------------
        // STEP 2 - CONFIRM
        // ----------------------------------------------------

        const confirmed =
            window.confirm(

                "AEGIS X AUTO-FIX\n\n" +

                `Incident #${incident.id}\n` +

                `Type: ${
                    incident.incident_type ||
                    "SECURITY INCIDENT"
                }\n` +

                `Source: ${
                    incident.source_ip ||
                    "N/A"
                }\n` +

                `Risk: ${
                    incident.risk_score ??
                    0
                } ${
                    incident.risk_level ||
                    ""
                }\n\n` +

                `Recommended action:\n` +

                `${
                    response.action ||
                    "REVIEW"
                }\n\n` +

                `Mode: ${
                    response.mode ||
                    "SIMULATION"
                }\n\n` +

                "Execute Auto-Fix?"
            );


        if (!confirmed) {
            return;
        }


        // ----------------------------------------------------
        // STEP 3 - EXECUTE
        // ----------------------------------------------------

        const executeResponse =
            await fetch(
                `/api/v1/incidents/${incidentId}/auto-fix`,
                {
                    method: "POST"
                }
            );


        const result =
            await executeResponse.json();


        if (!executeResponse.ok) {

            throw new Error(
                result.detail ||
                "Auto-Fix execution failed."
            );
        }


        // ----------------------------------------------------
        // STEP 4 - VERIFY
        // ----------------------------------------------------

        const verification =
            result.verification || {};


        const verified =
            verification.status ===
            "SIMULATION_VERIFIED";


        // ----------------------------------------------------
        // STEP 5 - SHOW RESULT
        // ----------------------------------------------------

        const toast =
            $("toast");


        if (toast) {

            toast.textContent =
                verified

                    ? (
                        `AUTO-FIX VERIFIED — Incident #${
                            incidentId
                        } — ${
                            result.response?.action ||
                            "response"
                        } simulated and audited.`
                    )

                    : (
                        `AUTO-FIX completed for Incident #${
                            incidentId
                        }.`
                    );


            toast.classList.add(
                "show"
            );


            setTimeout(
                () => {
                    toast.classList.remove(
                        "show"
                    );
                },
                4500
            );
        }


        // ----------------------------------------------------
        // STEP 6 - REFRESH DASHBOARD
        // ----------------------------------------------------

        if (
            typeof load ===
            "function"
        ) {

            await load();
        }


        // ----------------------------------------------------
        // STEP 7 - REFRESH INVESTIGATION
        // ----------------------------------------------------

        if (
            activeInvestigationIncidentId ===
            incidentId &&
            typeof investigate ===
            "function"
        ) {

            await investigate(
                incidentId
            );
        }


    } catch (error) {

        console.error(
            "AEGIS X Auto-Fix:",
            error
        );


        const toast =
            $("toast");


        if (toast) {

            toast.textContent =
                `Auto-Fix failed: ${
                    error.message
                }`;


            toast.classList.add(
                "show"
            );


            setTimeout(
                () => {
                    toast.classList.remove(
                        "show"
                    );
                },
                4500
            );
        }
    }
}






/* ============================================================
   AEGIS X — AUTO-FIX DIALOG UI
   Clean simulation-only response interface
   ============================================================ */

(function () {
    "use strict";

    function aegisAutoFixStyles() {
        if (document.getElementById("aegisAutoFixStyles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "aegisAutoFixStyles";

        style.textContent = `
        #aegisAutoFixOverlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(3, 7, 18, 0.78);
            backdrop-filter: blur(10px);
        }

        #aegisAutoFixDialog {
            width: min(560px, 94vw);
            max-height: 90vh;
            overflow-y: auto;
            background: #0b1220;
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 18px;
            box-shadow:
                0 30px 90px rgba(0, 0, 0, 0.55),
                0 0 0 1px rgba(255,255,255,0.03);
            color: #e5e7eb;
            font-family: inherit;
            animation: aegisAutoFixIn .18s ease-out;
        }

        @keyframes aegisAutoFixIn {
            from {
                opacity: 0;
                transform: translateY(12px) scale(.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .aegis-af-header {
            padding: 22px 24px 18px;
            border-bottom: 1px solid rgba(148,163,184,.14);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
        }

        .aegis-af-eyebrow {
            font-size: 10px;
            letter-spacing: .16em;
            font-weight: 700;
            color: #94a3b8;
            margin-bottom: 7px;
        }

        .aegis-af-title {
            margin: 0;
            font-size: 21px;
            line-height: 1.2;
            font-weight: 700;
            color: #f8fafc;
        }

        .aegis-af-close {
            width: 34px;
            height: 34px;
            border: 1px solid rgba(148,163,184,.18);
            border-radius: 9px;
            background: rgba(255,255,255,.035);
            color: #94a3b8;
            cursor: pointer;
            font-size: 20px;
            line-height: 1;
        }

        .aegis-af-close:hover {
            background: rgba(255,255,255,.08);
            color: #fff;
        }

        .aegis-af-body {
            padding: 22px 24px;
        }

        .aegis-af-status {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-radius: 10px;
            background: rgba(245,158,11,.08);
            border: 1px solid rgba(245,158,11,.22);
            margin-bottom: 18px;
        }

        .aegis-af-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #f59e0b;
            box-shadow: 0 0 10px rgba(245,158,11,.6);
            flex: 0 0 auto;
        }

        .aegis-af-status strong {
            color: #fbbf24;
            font-size: 12px;
            letter-spacing: .05em;
        }

        .aegis-af-status span {
            color: #cbd5e1;
            font-size: 12px;
        }

        .aegis-af-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 18px;
        }

        .aegis-af-card {
            padding: 14px;
            border-radius: 11px;
            background: rgba(255,255,255,.025);
            border: 1px solid rgba(148,163,184,.13);
        }

        .aegis-af-label {
            display: block;
            font-size: 9px;
            letter-spacing: .12em;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 7px;
        }

        .aegis-af-value {
            display: block;
            font-size: 14px;
            font-weight: 650;
            color: #f1f5f9;
            word-break: break-word;
        }

        .aegis-af-action {
            padding: 16px;
            border-radius: 12px;
            background: rgba(59,130,246,.07);
            border: 1px solid rgba(59,130,246,.2);
            margin-bottom: 16px;
        }

        .aegis-af-action-title {
            font-size: 10px;
            letter-spacing: .12em;
            font-weight: 700;
            color: #60a5fa;
            margin-bottom: 7px;
        }

        .aegis-af-action-name {
            font-size: 18px;
            font-weight: 750;
            color: #dbeafe;
        }

        .aegis-af-warning {
            font-size: 12px;
            line-height: 1.55;
            color: #94a3b8;
            padding: 12px 14px;
            border-left: 3px solid rgba(148,163,184,.3);
            background: rgba(255,255,255,.018);
            margin-bottom: 20px;
        }

        .aegis-af-footer {
            padding: 16px 24px 20px;
            border-top: 1px solid rgba(148,163,184,.12);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .aegis-af-btn {
            min-height: 40px;
            padding: 0 16px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: .03em;
            cursor: pointer;
            border: 1px solid transparent;
        }

        .aegis-af-cancel {
            background: rgba(255,255,255,.035);
            border-color: rgba(148,163,184,.2);
            color: #cbd5e1;
        }

        .aegis-af-cancel:hover {
            background: rgba(255,255,255,.07);
        }

        .aegis-af-execute {
            background: #2563eb;
            border-color: #3b82f6;
            color: white;
            box-shadow: 0 6px 20px rgba(37,99,235,.22);
        }

        .aegis-af-execute:hover {
            background: #1d4ed8;
        }

        .aegis-af-execute:disabled {
            opacity: .55;
            cursor: wait;
        }

        .aegis-af-result {
            padding: 20px 24px 24px;
        }

        .aegis-af-result-box {
            border-radius: 12px;
            padding: 16px;
            background: rgba(34,197,94,.06);
            border: 1px solid rgba(34,197,94,.2);
        }

        .aegis-af-result-title {
            color: #86efac;
            font-weight: 750;
            margin-bottom: 8px;
        }

        .aegis-af-result-text {
            color: #cbd5e1;
            font-size: 12px;
            line-height: 1.6;
        }

        @media (max-width: 600px) {
            #aegisAutoFixOverlay {
                padding: 12px;
            }

            .aegis-af-grid {
                grid-template-columns: 1fr;
            }

            .aegis-af-footer {
                flex-direction: column-reverse;
            }

            .aegis-af-btn {
                width: 100%;
            }
        }
        `;

        document.head.appendChild(style);
    }

    function removeAegisAutoFixDialog() {
        const old = document.getElementById("aegisAutoFixOverlay");

        if (old) {
            old.remove();
        }
    }

    function valueOrDash(value) {
        return value === undefined || value === null || value === ""
            ? "—"
            : String(value);
    }

    async function showAegisAutoFixDialog(incidentId) {
        aegisAutoFixStyles();
        removeAegisAutoFixDialog();

        const overlay = document.createElement("div");
        overlay.id = "aegisAutoFixOverlay";

        overlay.innerHTML = `
            <div id="aegisAutoFixDialog" role="dialog" aria-modal="true">

                <div class="aegis-af-header">
                    <div>
                        <div class="aegis-af-eyebrow">
                            AEGIS X · RESPONSE ENGINE
                        </div>

                        <h2 class="aegis-af-title">
                            Auto-Fix Issue
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="aegis-af-close"
                        id="aegisAutoFixClose"
                        aria-label="Close"
                    >×</button>
                </div>

                <div class="aegis-af-body">

                    <div class="aegis-af-status">
                        <span class="aegis-af-dot"></span>
                        <div>
                            <strong>SIMULATION MODE</strong>
                            <span> — no real system changes will be made.</span>
                        </div>
                    </div>

                    <div class="aegis-af-grid">

                        <div class="aegis-af-card">
                            <span class="aegis-af-label">INCIDENT</span>
                            <span class="aegis-af-value">
                                #${valueOrDash(incidentId)}
                            </span>
                        </div>

                        <div class="aegis-af-card">
                            <span class="aegis-af-label">STATUS</span>
                            <span
                                class="aegis-af-value"
                                id="aegisAfIncidentStatus"
                            >Analyzing...</span>
                        </div>

                        <div class="aegis-af-card">
                            <span class="aegis-af-label">RISK SCORE</span>
                            <span
                                class="aegis-af-value"
                                id="aegisAfRisk"
                            >Analyzing...</span>
                        </div>

                        <div class="aegis-af-card">
                            <span class="aegis-af-label">SOURCE</span>
                            <span
                                class="aegis-af-value"
                                id="aegisAfSource"
                            >Analyzing...</span>
                        </div>

                    </div>

                    <div class="aegis-af-action">

                        <div class="aegis-af-action-title">
                            RECOMMENDED DEFENSIVE ACTION
                        </div>

                        <div
                            class="aegis-af-action-name"
                            id="aegisAfAction"
                        >
                            Analyzing incident...
                        </div>

                    </div>

                    <div class="aegis-af-warning">
                        AEGIS X will record the selected response in the
                        security audit trail. This prototype does not perform
                        real blocking, isolation, firewall, or network changes.
                    </div>

                </div>

                <div class="aegis-af-footer">

                    <button
                        type="button"
                        class="aegis-af-btn aegis-af-cancel"
                        id="aegisAfCancel"
                    >
                        CANCEL
                    </button>

                    <button
                        type="button"
                        class="aegis-af-btn aegis-af-execute"
                        id="aegisAfExecute"
                        disabled
                    >
                        EXECUTE SIMULATION
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => {
            removeAegisAutoFixDialog();
        };

        document
            .getElementById("aegisAutoFixClose")
            ?.addEventListener("click", close);

        document
            .getElementById("aegisAfCancel")
            ?.addEventListener("click", close);

        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) {
                close();
            }
        });

        document.addEventListener(
            "keydown",
            function aegisAutoFixEscape(event) {
                if (
                    event.key === "Escape" &&
                    document.getElementById("aegisAutoFixOverlay")
                ) {
                    close();
                    document.removeEventListener(
                        "keydown",
                        aegisAutoFixEscape
                    );
                }
            }
        );

        try {
            const response = await fetch(
                `/api/v1/incidents/${incidentId}/auto-fix/preview`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    data.message ||
                    `Preview failed (${response.status})`
                );
            }

            /*
             * Normalize Auto-Fix preview data.
             * Different AEGIS X backend layers may expose the
             * incident/decision fields at slightly different levels.
             */
            let incident = data.incident || {};

            let decision =
                data.response ||
                data.recommendation ||
                data.decision ||
                {};

            /*
             * Fallback to top-level fields when the compatibility
             * endpoint returns a flattened response.
             */
            const riskScore =
                incident.risk_score ??
                decision.risk_score ??
                data.risk_score ??
                data.score ??
                "—";

            const sourceIp =
                incident.source_ip ??
                decision.source_ip ??
                data.source_ip ??
                "—";

            const incidentStatus =
                incident.status ??
                incident.lifecycle_status ??
                data.status ??
                "OPEN";

            let action =
                decision.action ??
                decision.recommended_action ??
                data.action ??
                data.recommended_action ??
                null;

            /*
             * AEGIS X response policy:
             * >=75  -> ISOLATE_SOURCE
             * >=50  -> BLOCK_SOURCE
             * >=25  -> ALERT
             * <25   -> MONITOR
             */
            if (!action && typeof riskScore === "number") {
                if (riskScore >= 75) {
                    action = "ISOLATE_SOURCE";
                } else if (riskScore >= 50) {
                    action = "BLOCK_SOURCE";
                } else if (riskScore >= 25) {
                    action = "ALERT";
                } else {
                    action = "MONITOR";
                }
            }

            document.getElementById("aegisAfIncidentStatus").textContent =
                valueOrDash(incidentStatus);

            document.getElementById("aegisAfRisk").textContent =
                valueOrDash(riskScore);

            document.getElementById("aegisAfSource").textContent =
                valueOrDash(sourceIp);

            document.getElementById("aegisAfAction").textContent =
                valueOrDash(
                    action ||
                    "NO ACTION RECOMMENDED"
                );

            const executeButton =
                document.getElementById("aegisAfExecute");

            executeButton.disabled = false;

            executeButton.addEventListener(
                "click",
                async function () {

                    executeButton.disabled = true;
                    executeButton.textContent =
                        "EXECUTING...";

                    try {

                        const resultResponse =
                            await fetch(
                                `/api/v1/incidents/${incidentId}/auto-fix`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    }
                                }
                            );

                        const result =
                            await resultResponse.json();

                        if (!resultResponse.ok) {
                            throw new Error(
                                result.detail ||
                                result.message ||
                                `Execution failed (${resultResponse.status})`
                            );
                        }

                        const execution =
                            result.execution || {};

                        const action =
                            execution.action ||
                            decision.action ||
                            "RESPONSE";

                        const status =
                            execution.status ||
                            "SIMULATED";

                        const body =
                            document.querySelector(
                                "#aegisAutoFixDialog .aegis-af-body"
                            );

                        const footer =
                            document.querySelector(
                                "#aegisAutoFixDialog .aegis-af-footer"
                            );

                        if (body) {
                            body.innerHTML = `
                                <div class="aegis-af-result">

                                    <div class="aegis-af-result-box">

                                        <div class="aegis-af-result-title">
                                            ✓ Response Recorded
                                        </div>

                                        <div class="aegis-af-result-text">
                                            AEGIS X recorded
                                            <strong>${action}</strong>
                                            for Incident #${incidentId}.
                                            <br><br>
                                            Execution mode:
                                            <strong>SIMULATION</strong>
                                            <br>
                                            Status:
                                            <strong>${status}</strong>
                                            <br><br>
                                            No real system or network changes
                                            were performed.
                                        </div>

                                    </div>

                                </div>
                            `;
                        }

                        if (footer) {
                            footer.innerHTML = `
                                <button
                                    type="button"
                                    class="aegis-af-btn aegis-af-execute"
                                    id="aegisAfDone"
                                >
                                    DONE
                                </button>
                            `;

                            document
                                .getElementById("aegisAfDone")
                                ?.addEventListener(
                                    "click",
                                    close
                                );
                        }

                    } catch (error) {

                        executeButton.disabled = false;
                        executeButton.textContent =
                            "EXECUTE SIMULATION";

                        const action =
                            document.getElementById(
                                "aegisAfAction"
                            );

                        if (action) {
                            action.textContent =
                                "Execution failed";
                            action.style.color =
                                "#fca5a5";
                        }

                        console.error(
                            "AEGIS X Auto-Fix error:",
                            error
                        );
                    }
                }
            );

        } catch (error) {

            console.error(
                "AEGIS X Auto-Fix preview error:",
                error
            );

            const action =
                document.getElementById("aegisAfAction");

            if (action) {
                action.textContent =
                    "Preview unavailable";
                action.style.color =
                    "#fca5a5";
            }

            const execute =
                document.getElementById("aegisAfExecute");

            if (execute) {
                execute.disabled = true;
            }

            const warning =
                document.querySelector(
                    "#aegisAutoFixDialog .aegis-af-warning"
                );

            if (warning) {
                warning.textContent =
                    "Unable to load the Auto-Fix preview. " +
                    error.message;
                warning.style.borderLeftColor =
                    "rgba(239,68,68,.55)";
            }
        }
    }

    /*
     * Replace the previous Auto-Fix UI entry point.
     * The backend remains unchanged.
     */
    window.autoFixIncident = function (incidentId) {
        showAegisAutoFixDialog(incidentId);
    };

})();


