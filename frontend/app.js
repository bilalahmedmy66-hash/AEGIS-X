const $ = id => document.getElementById(id);


// ========================================
// API
// ========================================

const api = async (path, options = {}) => {

    const response = await fetch(path, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch (_) {}

    if (!response.ok) {
        throw new Error(
            data.detail ||
            `HTTP ${response.status}`
        );
    }

    return data;
};


// ========================================
// HELPERS
// ========================================

const esc = value =>
    String(value ?? "—").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character])
    );


const time = value => {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return esc(value);
    }

    return date.toLocaleString();
};


const toast = message => {

    const element = $("toast");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.classList.add("show");

    setTimeout(
        () => {
            element.classList.remove("show");
        },
        2500
    );
};


// ========================================
// INCIDENT STATUS
// ========================================

async function setIncident(id, status) {

    try {

        await api(
            `/api/v1/incidents/${id}/status`,
            {
                method: "PATCH",

                body: JSON.stringify({
                    status: status
                })
            }
        );

        toast(
            `Incident #${id} → ${status}`
        );

        await load();

    } catch (error) {

        console.error(
            "Incident status error:",
            error
        );

        toast(error.message);
    }
}


// ========================================
// SIMULATED RESPONSE
// ========================================

async function respond(id) {

    const confirmed =
        window.confirm(
            `Run simulated response for incident #${id}?\n\n` +
            `AEGIS X will remain in SIMULATION mode.`
        );

    if (!confirmed) {
        return;
    }

    try {

        const data =
            await api(
                `/api/v1/incidents/${id}/respond`,
                {
                    method: "POST"
                }
            );

        toast(
            `Response ${
                data.execution?.action ||
                "action"
            } simulated`
        );

        await load();

    } catch (error) {

        console.error(
            "Response error:",
            error
        );

        toast(error.message);
    }
}


// ========================================
// INVESTIGATION PANEL
// ========================================

function createInvestigationPanel() {

    if ($("investigationOverlay")) {
        return;
    }

    const overlay =
        document.createElement("div");

    overlay.id =
        "investigationOverlay";

    overlay.innerHTML = `

        <div
            class="investigation-backdrop"
            onclick="closeInvestigation()"
        ></div>


        <aside class="investigation-panel">

            <div class="investigation-header">

                <div>

                    <div class="investigation-eyebrow">
                        AEGIS X · SECURITY INVESTIGATION
                    </div>

                    <h2 id="investigationTitle">
                        Incident Investigation
                    </h2>

                    <p id="investigationSubtitle">
                        Attack story and correlated security activity
                    </p>

                </div>


                <button
                    class="investigation-close"
                    onclick="closeInvestigation()"
                    aria-label="Close investigation"
                >
                    ×
                </button>

            </div>


            <div
                id="investigationContent"
                class="investigation-content"
            >

                <div class="investigation-loading">
                    Loading investigation...
                </div>

            </div>

        </aside>
    `;

    document.body.appendChild(overlay);
}


// ========================================
// OPEN INVESTIGATION
// ========================================

async function investigate(id) {

    createInvestigationPanel();

    const overlay =
        $("investigationOverlay");

    const content =
        $("investigationContent");

    const title =
        $("investigationTitle");

    const subtitle =
        $("investigationSubtitle");


    overlay.classList.add("open");


    title.textContent =
        `Incident #${id}`;


    subtitle.textContent =
        "Loading attack story...";


    content.innerHTML = `

        <div class="investigation-loading">

            <div class="investigation-spinner"></div>

            <span>
                Correlating events, alerts,
                incident and response activity...
            </span>

        </div>
    `;


    try {

        const data =
            await api(
                `/api/v1/incidents/${id}/timeline`
            );

        renderInvestigation(data);

    } catch (error) {

        console.error(
            "Investigation error:",
            error
        );

        content.innerHTML = `

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


// ========================================
// CLOSE INVESTIGATION
// ========================================

function closeInvestigation() {

    const overlay =
        $("investigationOverlay");

    if (!overlay) {
        return;
    }

    overlay.classList.remove("open");
}


// ========================================
// RENDER INVESTIGATION
// ========================================

function renderInvestigation(data) {

    const incident =
        data.incident || {};

    const timeline =
        Array.isArray(data.timeline)
            ? data.timeline
            : [];


    const title =
        $("investigationTitle");

    const subtitle =
        $("investigationSubtitle");

    const content =
        $("investigationContent");


    if (!content) {
        return;
    }


    if (title) {

        title.textContent =
            `Incident #${incident.id ?? "—"}`;
    }


    if (subtitle) {

        subtitle.textContent =
            `${incident.incident_type || "UNKNOWN"} · Attack Story`;
    }


    content.innerHTML = `

        <!-- INCIDENT SUMMARY -->

        <section class="investigation-summary">

            <div class="investigation-summary-head">

                <div>

                    <span class="investigation-label">
                        INCIDENT TYPE
                    </span>

                    <h3>
                        ${esc(
                            incident.incident_type ||
                            "UNKNOWN"
                        )}
                    </h3>

                </div>


                <span class="
                    status
                    ${esc(
                        incident.status ||
                        "OPEN"
                    )}
                ">
                    ${esc(
                        incident.status ||
                        "OPEN"
                    )}
                </span>

            </div>


            <div class="investigation-risk">

                <div>

                    <span>
                        RISK SCORE
                    </span>

                    <strong>
                        ${incident.risk_score ?? 0}
                    </strong>

                </div>


                <div>

                    <span>
                        RISK LEVEL
                    </span>

                    <strong>
                        ${esc(
                            incident.risk_level ||
                            "LOW"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        SEVERITY
                    </span>

                    <strong>
                        ${esc(
                            incident.severity ||
                            "UNKNOWN"
                        )}
                    </strong>

                </div>

            </div>


            <div class="investigation-details">

                <div>

                    <span>
                        SOURCE IP
                    </span>

                    <strong>
                        ${esc(
                            incident.source_ip ||
                            "N/A"
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        FIRST SEEN
                    </span>

                    <strong>
                        ${time(
                            incident.first_seen
                        )}
                    </strong>

                </div>


                <div>

                    <span>
                        LAST SEEN
                    </span>

                    <strong>
                        ${time(
                            incident.last_seen
                        )}
                    </strong>

                </div>

            </div>


            <div class="investigation-description">

                ${esc(
                    incident.description ||
                    "No incident description available."
                )}

            </div>

        </section>


        <!-- ATTACK STORY -->

        <section class="attack-story">

            <div class="attack-story-head">

                <div>

                    <div class="investigation-label">
                        ATTACK STORY
                    </div>

                    <h3>
                        Correlated Security Timeline
                    </h3>

                </div>


                <span class="timeline-count">
                    ${timeline.length} ACTIVITIES
                </span>

            </div>


            <div class="timeline">

                ${
                    timeline.length > 0

                        ? timeline
                            .map(
                                (item, index) =>
                                    renderTimelineItem(
                                        item,
                                        index,
                                        timeline.length
                                    )
                            )
                            .join("")

                        : `
                            <div class="empty">
                                No timeline activity available.
                            </div>
                        `
                }

            </div>

        </section>
    `;
}


// ========================================
// TIMELINE ITEM
// ========================================

function renderTimelineItem(
    item,
    index,
    total
) {

    const type =
        String(
            item.type ||
            "EVENT"
        ).toUpperCase();


    const title =
        item.title ||
        type;


    const description =
        item.description ||
        "No description available.";


    let metadata = "";


    if (item.source_ip) {

        metadata += `
            <span>
                IP: ${esc(
                    item.source_ip
                )}
            </span>
        `;
    }


    if (
        item.risk_score !== undefined &&
        item.risk_score !== null
    ) {

        metadata += `
            <span>
                Risk: ${esc(
                    item.risk_score
                )}
            </span>
        `;
    }


    if (item.risk_level) {

        metadata += `
            <span>
                Level: ${esc(
                    item.risk_level
                )}
            </span>
        `;
    }


    if (item.severity) {

        metadata += `
            <span>
                Severity: ${esc(
                    item.severity
                )}
            </span>
        `;
    }


    if (item.status) {

        metadata += `
            <span>
                Status: ${esc(
                    item.status
                )}
            </span>
        `;
    }


    if (item.mode) {

        metadata += `
            <span>
                Mode: ${esc(
                    item.mode
                )}
            </span>
        `;
    }


    return `

        <div class="
            timeline-item
            ${timelineClass(type)}
        ">

            <div class="timeline-marker">

                <div class="timeline-node">
                    ${timelineIcon(type)}
                </div>


                ${
                    index < total - 1

                        ? `
                            <div
                                class="timeline-connector"
                            ></div>
                        `

                        : ""
                }

            </div>


            <div class="timeline-card">

                <div class="timeline-card-head">

                    <div>

                        <span class="timeline-type">
                            ${esc(type)}
                        </span>

                        <h4>
                            ${esc(title)}
                        </h4>

                    </div>


                    <time>
                        ${time(
                            item.timestamp
                        )}
                    </time>

                </div>


                <p>
                    ${esc(description)}
                </p>


                ${
                    metadata

                        ? `
                            <div class="timeline-meta">
                                ${metadata}
                            </div>
                        `

                        : ""
                }

            </div>

        </div>
    `;
}


// ========================================
// TIMELINE STYLE CLASS
// ========================================

function timelineClass(type) {

    return {

        EVENT:
            "timeline-event",

        DETECTION:
            "timeline-detection",

        ALERT:
            "timeline-alert",

        RISK:
            "timeline-risk",

        INCIDENT:
            "timeline-incident",

        RESPONSE:
            "timeline-response",

        STATUS:
            "timeline-status"

    }[type] || "timeline-event";
}


// ========================================
// TIMELINE ICON
// ========================================

function timelineIcon(type) {

    return {

        EVENT: "E",

        DETECTION: "D",

        ALERT: "A",

        RISK: "R",

        INCIDENT: "I",

        RESPONSE: "↗",

        STATUS: "✓"

    }[type] || "•";
}


// ========================================
// DASHBOARD LOAD
// ========================================

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

            api(
                "/api/v1/events"
            ),

            api(
                "/api/v1/alerts"
            ),

            api(
                "/api/v1/incidents"
            ),

            api(
                "/api/v1/responses"
            ),

            api(
                "/api/v1/detections"
            )

        ]);


        // ========================================
        // HEALTH
        // ========================================

        $("healthText").textContent =
            health.status === "healthy"
                ? "Operational"
                : "Degraded";


        // ========================================
        // METRICS
        // ========================================

        $("eventsCount").textContent =
            events.total;


        const active =
            (alerts.alerts || [])
                .filter(
                    alert =>
                        String(
                            alert.status ||
                            "NEW"
                        ).toUpperCase() !==
                        "RESOLVED"
                );


        $("activeAlerts").textContent =
            active.length;


        const open =
            (incidents.incidents || [])
                .filter(
                    incident =>
                        String(
                            incident.status ||
                            "OPEN"
                        ).toUpperCase() !==
                        "RESOLVED"
                );


        $("openIncidents").textContent =
            open.length;


        const riskScores =
            open.map(
                incident =>
                    Number(
                        incident.risk_score ||
                        0
                    )
            );


        $("highestRisk").textContent =
            riskScores.length
                ? Math.max(...riskScores)
                : "0";


        $("detectionTag").textContent =
            `${detections.alerts_generated ?? 0} detected`;


        $("lastUpdated").textContent =
            `Updated ${
                new Date()
                    .toLocaleTimeString()
            }`;


        // ========================================
        // DETECTIONS
        // ========================================

        $("detections").innerHTML =
            detections.alerts?.length

                ? detections.alerts
                    .map(
                        alert => `

                            <div class="detection">

                                <div class="rowline">

                                    <span class="type">
                                        ${esc(
                                            alert.type ||
                                            alert.alert_type ||
                                            "UNKNOWN"
                                        )}
                                    </span>


                                    <span class="
                                        risk
                                        ${esc(
                                            alert.severity ||
                                            alert.risk?.level ||
                                            "LOW"
                                        )}
                                    ">

                                        ${esc(
                                            alert.risk?.level ||
                                            alert.risk_level ||
                                            "LOW"
                                        )}

                                        ·

                                        ${esc(
                                            alert.risk?.score ??
                                            alert.risk_score ??
                                            0
                                        )}

                                    </span>

                                </div>


                                <div class="meta">

                                    ${esc(
                                        alert.source_ip
                                    )}

                                    ·

                                    ${esc(
                                        alert.message ||
                                        "Security detection generated."
                                    )}

                                </div>


                                <div class="meta">

                                    Response:

                                    ${esc(
                                        alert.response?.action ||
                                        "N/A"
                                    )}

                                    ·

                                    ${esc(
                                        alert.response?.mode ||
                                        "SIMULATION"
                                    )}

                                </div>

                            </div>
                        `
                    )
                    .join("")

                : `
                    <div class="empty">
                        No detections.
                    </div>
                `;


        // ========================================
        // RESPONSE ACTIVITY
        // ========================================

        $("responses").innerHTML =
            responses.responses?.length

                ? responses.responses
                    .slice(0, 8)
                    .map(
                        response => `

                            <div class="activity">

                                <div class="rowline">

                                    <strong>
                                        ${esc(
                                            response.action
                                        )}
                                    </strong>


                                    <span class="status">

                                        ${esc(
                                            response.status
                                        )}

                                    </span>

                                </div>


                                <small>

                                    Incident #
                                    ${esc(
                                        response.incident_id
                                    )}

                                    ·

                                    ${esc(
                                        response.source_ip
                                    )}

                                    ·

                                    ${time(
                                        response.executed_at
                                    )}

                                </small>

                            </div>
                        `
                    )
                    .join("")

                : `
                    <div class="empty">
                        No response actions recorded.
                    </div>
                `;


        // ========================================
        // INCIDENTS
        // ========================================

        $("incidentRows").innerHTML =
            incidents.incidents?.length

                ? incidents.incidents
                    .map(
                        incident => {

                            const status =
                                String(
                                    incident.status ||
                                    "OPEN"
                                ).toUpperCase();


                            return `

                                <tr>

                                    <td>
                                        #${incident.id}
                                    </td>


                                    <td>
                                        ${esc(
                                            incident.incident_type ||
                                            "UNKNOWN"
                                        )}
                                    </td>


                                    <td>
                                        ${esc(
                                            incident.source_ip ||
                                            "N/A"
                                        )}
                                    </td>


                                    <td>

                                        <b class="
                                            risk
                                            ${esc(
                                                incident.risk_level ||
                                                "LOW"
                                            )}
                                        ">
                                            ${incident.risk_score ?? 0}
                                        </b>

                                        ${esc(
                                            incident.risk_level ||
                                            "LOW"
                                        )}

                                    </td>


                                    <td>

                                        <span class="
                                            status
                                            ${esc(status)}
                                        ">

                                            ${esc(status)}

                                        </span>

                                    </td>


                                    <td>
                                        ${time(
                                            incident.last_seen
                                        )}
                                    </td>


                                    <td>

                                        <div
                                            class="table-actions"
                                        >

                                            <!-- INVESTIGATE -->

                                            <button
                                                class="
                                                    action-btn
                                                    investigate-btn
                                                "
                                                onclick="
                                                    investigate(
                                                        ${incident.id}
                                                    )
                                                "
                                            >
                                                INVESTIGATE
                                            </button>


                                            <!-- RESPOND -->

                                            ${
                                                status !==
                                                "RESOLVED"

                                                    ? `

                                                        <button
                                                            class="action-btn"
                                                            onclick="
                                                                respond(
                                                                    ${incident.id}
                                                                )
                                                            "
                                                        >
                                                            RESPOND
                                                        </button>

                                                    `

                                                    : ""
                                            }


                                            <!-- ACKNOWLEDGE -->

                                            ${
                                                status ===
                                                "OPEN"

                                                    ? `

                                                        <button
                                                            class="action-btn"
                                                            onclick="
                                                                setIncident(
                                                                    ${incident.id},
                                                                    'ACKNOWLEDGED'
                                                                )
                                                            "
                                                        >
                                                            ACK
                                                        </button>

                                                    `

                                                    : ""
                                            }


                                            <!-- RESOLVE -->

                                            ${
                                                status ===
                                                "ACKNOWLEDGED"

                                                    ? `

                                                        <button
                                                            class="action-btn"
                                                            onclick="
                                                                setIncident(
                                                                    ${incident.id},
                                                                    'RESOLVED'
                                                                )
                                                            "
                                                        >
                                                            RESOLVE
                                                        </button>

                                                    `

                                                    : ""
                                            }


                                            ${
                                                status ===
                                                "RESOLVED"

                                                    ? `
                                                        <span>
                                                            ✓ Resolved
                                                        </span>
                                                    `

                                                    : ""
                                            }

                                        </div>

                                    </td>

                                </tr>
                            `;
                        }
                    )
                    .join("")

                : `

                    <tr>

                        <td
                            colspan="7"
                            class="empty"
                        >
                            No incidents.
                        </td>

                    </tr>

                `;


        // ========================================
        // ALERTS
        // ========================================

        $("alertRows").innerHTML =
            alerts.alerts?.length

                ? alerts.alerts
                    .map(
                        alert => `

                            <tr>

                                <td>
                                    #${alert.id}
                                </td>


                                <td>
                                    ${esc(
                                        alert.alert_type ||
                                        "UNKNOWN"
                                    )}
                                </td>


                                <td class="
                                    risk
                                    ${esc(
                                        alert.severity ||
                                        "LOW"
                                    )}
                                ">

                                    ${esc(
                                        alert.severity ||
                                        "UNKNOWN"
                                    )}

                                </td>


                                <td>

                                    ${alert.risk_score ?? 0}

                                    ·

                                    ${esc(
                                        alert.risk_level ||
                                        "LOW"
                                    )}

                                </td>


                                <td>
                                    ${esc(
                                        alert.source_ip ||
                                        "N/A"
                                    )}
                                </td>


                                <td>

                                    <span class="status">

                                        ${esc(
                                            alert.status ||
                                            "NEW"
                                        )}

                                    </span>

                                </td>


                                <td>
                                    ${time(
                                        alert.created_at
                                    )}
                                </td>

                            </tr>

                        `
                    )
                    .join("")

                : `

                    <tr>

                        <td
                            colspan="7"
                            class="empty"
                        >
                            No alerts.
                        </td>

                    </tr>

                `;


        // ========================================
        // EVENTS
        // ========================================

        $("eventRows").innerHTML =
            events.events?.length

                ? events.events
                    .slice(0, 30)
                    .map(
                        event => `

                            <tr>

                                <td>
                                    #${event.id}
                                </td>


                                <td>
                                    ${esc(
                                        event.event_type ||
                                        "UNKNOWN"
                                    )}
                                </td>


                                <td>
                                    ${esc(
                                        event.source ||
                                        "N/A"
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
                                        event.severity
                                    )}
                                </td>


                                <td>
                                    ${esc(
                                        event.description ||
                                        "N/A"
                                    )}
                                </td>


                                <td>
                                    ${time(
                                        event.timestamp
                                    )}
                                </td>

                            </tr>

                        `
                    )
                    .join("")

                : `

                    <tr>

                        <td
                            colspan="7"
                            class="empty"
                        >
                            No events.
                        </td>

                    </tr>

                `;

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

        toast(error.message);
    }
}


// ========================================
// KEYBOARD CONTROL
// ========================================

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            closeInvestigation();
        }

    }
);


// ========================================
// INITIALIZATION
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        createInvestigationPanel();

        const refresh =
            $("refreshBtn");

        if (refresh) {

            refresh.addEventListener(
                "click",
                load
            );
        }

        load();

        setInterval(
            load,
            15000
        );

    }
);