const API_BASE = "";

let dashboardData = {
    events: [],
    alerts: [],
    incidents: [],
    responses: [],
    detections: []
};

let refreshInProgress = false;


// ========================================
// API
// ========================================

async function apiRequest(url, options = {}) {

    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (!response.ok) {

        let message = `HTTP ${response.status}`;

        try {
            const error = await response.json();

            if (error.detail) {
                message = error.detail;
            }

        } catch (_) {}

        throw new Error(message);
    }

    return await response.json();
}


// ========================================
// NORMALIZE API RESPONSES
// ========================================

function extractArray(response, key) {

    if (Array.isArray(response)) {
        return response;
    }

    if (
        response &&
        Array.isArray(response[key])
    ) {
        return response[key];
    }

    return [];
}


// ========================================
// LOAD DASHBOARD
// ========================================

async function loadDashboard() {

    if (refreshInProgress) {
        return;
    }

    refreshInProgress = true;

    try {

        const [
            healthResponse,
            eventsResponse,
            alertsResponse,
            incidentsResponse,
            responsesResponse,
            detectionsResponse
        ] = await Promise.all([

            apiRequest("/health"),

            apiRequest("/api/v1/events"),

            apiRequest("/api/v1/alerts"),

            apiRequest("/api/v1/incidents"),

            apiRequest("/api/v1/responses"),

            apiRequest("/api/v1/detections")

        ]);


        // ========================================
        // EXTRACT ACTUAL API ARRAYS
        // ========================================

        dashboardData.events =
            extractArray(
                eventsResponse,
                "events"
            );

        dashboardData.alerts =
            extractArray(
                alertsResponse,
                "alerts"
            );

        dashboardData.incidents =
            extractArray(
                incidentsResponse,
                "incidents"
            );

        dashboardData.responses =
            extractArray(
                responsesResponse,
                "responses"
            );


        // Detection endpoint returns alerts
        dashboardData.detections =
            extractArray(
                detectionsResponse,
                "alerts"
            );


        console.log(
            "AEGIS-X dashboard data:",
            dashboardData
        );


        // ========================================
        // RENDER
        // ========================================

        updateHealth(
            healthResponse
        );

        updateMetrics();

        renderDetections();

        renderResponses();

        renderIncidents();

        renderAlerts();

        renderEvents();

        updateDetectionTag(
            detectionsResponse
        );

        updateLastUpdated();

    } catch (error) {

        console.error(
            "AEGIS-X dashboard error:",
            error
        );

        updateHealthError();

        showToast(
            `Dashboard error: ${error.message}`,
            "error"
        );

    } finally {

        refreshInProgress = false;
    }
}


// ========================================
// HEALTH
// ========================================

function updateHealth(health) {

    const element =
        document.getElementById(
            "healthText"
        );

    if (!element) {
        return;
    }

    element.textContent =
        "Operational";

    element.style.color =
        "";
}


function updateHealthError() {

    const element =
        document.getElementById(
            "healthText"
        );

    if (!element) {
        return;
    }

    element.textContent =
        "Offline";

    element.style.color =
        "#ff4d4d";
}


// ========================================
// METRICS
// ========================================

function updateMetrics() {

    const events =
        dashboardData.events;

    const alerts =
        dashboardData.alerts;

    const incidents =
        dashboardData.incidents;


    const activeAlerts =
        alerts.filter(
            alert =>
                String(
                    alert.status || "NEW"
                ).toUpperCase() !==
                "RESOLVED"
        );


    const openIncidents =
        incidents.filter(
            incident =>
                String(
                    incident.status || "OPEN"
                ).toUpperCase() !==
                "RESOLVED"
        );


    const riskScores =
        incidents
            .map(
                incident =>
                    Number(
                        incident.risk_score || 0
                    )
            );


    const highestRisk =
        riskScores.length > 0
            ? Math.max(...riskScores)
            : 0;


    setText(
        "eventsCount",
        events.length
    );


    setText(
        "activeAlerts",
        activeAlerts.length
    );


    setText(
        "openIncidents",
        openIncidents.length
    );


    setText(
        "highestRisk",
        highestRisk
    );
}


// ========================================
// DETECTION TAG
// ========================================

function updateDetectionTag(
    detectionResponse
) {

    const element =
        document.getElementById(
            "detectionTag"
        );

    if (!element) {
        return;
    }


    const generated =
        detectionResponse &&
        detectionResponse.alerts_generated;


    if (generated !== undefined) {

        element.textContent =
            `${generated} DETECTION${
                generated === 1 ? "" : "S"
            }`;

    } else {

        element.textContent =
            `${dashboardData.detections.length} DETECTION${
                dashboardData.detections.length === 1
                    ? ""
                    : "S"
            }`;
    }
}


// ========================================
// DETECTIONS
// ========================================

function renderDetections() {

    const container =
        document.getElementById(
            "detections"
        );

    if (!container) {
        return;
    }


    if (
        dashboardData.detections.length === 0
    ) {

        container.innerHTML = `
            <div class="empty">
                No active detections.
            </div>
        `;

        return;
    }


    container.innerHTML =
        dashboardData.detections
            .map(
                detection => {

                    const risk =
                        detection.risk || {};


                    return `
                        <div class="detection-item">

                            <div class="detection-top">

                                <strong>
                                    ${escapeHtml(
                                        detection.type ||
                                        "UNKNOWN"
                                    )}
                                </strong>

                                <span class="severity-badge ${severityClass(
                                    detection.severity
                                )}">
                                    ${escapeHtml(
                                        detection.severity ||
                                        "UNKNOWN"
                                    )}
                                </span>

                            </div>


                            <div class="detection-info">

                                <span>
                                    Source:
                                    ${escapeHtml(
                                        detection.source_ip ||
                                        "N/A"
                                    )}
                                </span>

                                <span>
                                    Risk:
                                    ${escapeHtml(
                                        String(
                                            risk.score ?? 0
                                        )
                                    )}
                                </span>

                                <span>
                                    Level:
                                    ${escapeHtml(
                                        risk.level ||
                                        "LOW"
                                    )}
                                </span>

                            </div>


                            <div class="detection-message">

                                ${escapeHtml(
                                    detection.message ||
                                    "Security detection generated."
                                )}

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


// ========================================
// RESPONSE ACTIVITY
// ========================================

function renderResponses() {

    const container =
        document.getElementById(
            "responses"
        );

    if (!container) {
        return;
    }


    if (
        dashboardData.responses.length === 0
    ) {

        container.innerHTML = `
            <div class="empty">
                No response activity.
            </div>
        `;

        return;
    }


    container.innerHTML =
        dashboardData.responses
            .slice(0, 20)
            .map(
                response => {

                    return `
                        <div class="activity-item">

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        response.action ||
                                        "UNKNOWN"
                                    )}
                                </strong>

                                <small>
                                    Incident #${escapeHtml(
                                        response.incident_id
                                    )}
                                </small>

                            </div>


                            <div class="activity-right">

                                <span class="mode-badge">
                                    ${escapeHtml(
                                        response.mode ||
                                        "SIMULATION"
                                    )}
                                </span>

                                <span>
                                    ${escapeHtml(
                                        response.status ||
                                        "SIMULATED"
                                    )}
                                </span>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


// ========================================
// INCIDENTS
// ========================================

function renderIncidents() {

    const container =
        document.getElementById(
            "incidentRows"
        );

    if (!container) {
        return;
    }


    if (
        dashboardData.incidents.length === 0
    ) {

        container.innerHTML = `
            <tr>
                <td colspan="7">
                    No security incidents.
                </td>
            </tr>
        `;

        return;
    }


    container.innerHTML =
        dashboardData.incidents
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
                                <strong>
                                    ${escapeHtml(
                                        incident.incident_type ||
                                        "UNKNOWN"
                                    )}
                                </strong>
                            </td>


                            <td>
                                ${escapeHtml(
                                    incident.source_ip ||
                                    "N/A"
                                )}
                            </td>


                            <td>
                                <strong>
                                    ${incident.risk_score ?? 0}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        incident.risk_level ||
                                        "LOW"
                                    )}
                                </small>
                            </td>


                            <td>
                                <span class="status-badge ${statusClass(
                                    status
                                )}">
                                    ${escapeHtml(
                                        status
                                    )}
                                </span>
                            </td>


                            <td>
                                ${formatDate(
                                    incident.last_seen
                                )}
                            </td>


                            <td>

                                <div class="table-actions">

                                    ${
                                        status === "OPEN"
                                        ?

                                        `
                                        <button
                                            class="mini-btn"
                                            onclick="acknowledgeIncident(${incident.id})"
                                        >
                                            ACK
                                        </button>
                                        `

                                        :

                                        ""
                                    }


                                    ${
                                        status !== "RESOLVED"
                                        ?

                                        `
                                        <button
                                            class="mini-btn response-btn"
                                            onclick="respondToIncident(${incident.id})"
                                        >
                                            RESPOND
                                        </button>

                                        <button
                                            class="mini-btn resolve-btn"
                                            onclick="resolveIncident(${incident.id})"
                                        >
                                            RESOLVE
                                        </button>
                                        `

                                        :

                                        `
                                        <span class="resolved-text">
                                            ✓ Resolved
                                        </span>
                                        `
                                    }

                                </div>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


// ========================================
// ALERTS
// ========================================

function renderAlerts() {

    const container =
        document.getElementById(
            "alertRows"
        );

    if (!container) {
        return;
    }


    if (
        dashboardData.alerts.length === 0
    ) {

        container.innerHTML = `
            <tr>
                <td colspan="7">
                    No alerts available.
                </td>
            </tr>
        `;

        return;
    }


    container.innerHTML =
        dashboardData.alerts
            .map(
                alert => {

                    return `
                        <tr>

                            <td>
                                #${alert.id}
                            </td>


                            <td>
                                <strong>
                                    ${escapeHtml(
                                        alert.alert_type ||
                                        "UNKNOWN"
                                    )}
                                </strong>
                            </td>


                            <td>
                                <span class="severity-badge ${severityClass(
                                    alert.severity
                                )}">
                                    ${escapeHtml(
                                        alert.severity ||
                                        "UNKNOWN"
                                    )}
                                </span>
                            </td>


                            <td>
                                <strong>
                                    ${alert.risk_score ?? 0}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        alert.risk_level ||
                                        "LOW"
                                    )}
                                </small>
                            </td>


                            <td>
                                ${escapeHtml(
                                    alert.source_ip ||
                                    "N/A"
                                )}
                            </td>


                            <td>
                                <span class="status-badge ${statusClass(
                                    alert.status ||
                                    "NEW"
                                )}">
                                    ${escapeHtml(
                                        alert.status ||
                                        "NEW"
                                    )}
                                </span>
                            </td>


                            <td>
                                ${formatDate(
                                    alert.created_at
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


// ========================================
// EVENTS
// ========================================

function renderEvents() {

    const container =
        document.getElementById(
            "eventRows"
        );

    if (!container) {
        return;
    }


    if (
        dashboardData.events.length === 0
    ) {

        container.innerHTML = `
            <tr>
                <td colspan="7">
                    No security events available.
                </td>
            </tr>
        `;

        return;
    }


    container.innerHTML =
        dashboardData.events
            .slice(0, 50)
            .map(
                event => {

                    return `
                        <tr>

                            <td>
                                #${event.id}
                            </td>


                            <td>
                                <strong>
                                    ${escapeHtml(
                                        event.event_type ||
                                        "UNKNOWN"
                                    )}
                                </strong>
                            </td>


                            <td>
                                ${escapeHtml(
                                    event.source ||
                                    "N/A"
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    event.source_ip ||
                                    "N/A"
                                )}
                            </td>


                            <td>
                                <span class="severity-badge ${severityClass(
                                    event.severity
                                )}">
                                   ${escapeHtml(
                                      String(
                                          event.severity ??
                                          "N/A"
                                      )
                                    )}
                                </span>
                            </td>


                            <td>
                                ${escapeHtml(
                                    event.description ||
                                    "N/A"
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    event.timestamp
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


// ========================================
// INCIDENT ACTIONS
// ========================================

async function acknowledgeIncident(id) {

    try {

        await apiRequest(
            `/api/v1/incidents/${id}/status`,
            {
                method: "PATCH",

                body: JSON.stringify({
                    status: "ACKNOWLEDGED"
                })
            }
        );


        showToast(
            `Incident #${id} acknowledged.`,
            "success"
        );


        await loadDashboard();

    } catch (error) {

        console.error(
            "Acknowledge error:",
            error
        );
    }
}


async function resolveIncident(id) {

    const confirmed =
        window.confirm(
            `Resolve incident #${id}?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await apiRequest(
            `/api/v1/incidents/${id}/status`,
            {
                method: "PATCH",

                body: JSON.stringify({
                    status: "RESOLVED"
                })
            }
        );


        showToast(
            `Incident #${id} resolved.`,
            "success"
        );


        await loadDashboard();

    } catch (error) {

        console.error(
            "Resolve error:",
            error
        );
    }
}


async function respondToIncident(id) {

    const confirmed =
        window.confirm(
            `Run simulated response for incident #${id}?\n\n` +
            `AEGIS-X will remain in SIMULATION mode.`
        );


    if (!confirmed) {
        return;
    }


    try {

        await apiRequest(
            `/api/v1/incidents/${id}/respond`,
            {
                method: "POST"
            }
        );


        showToast(
            `Simulated response executed for incident #${id}.`,
            "success"
        );


        await loadDashboard();

    } catch (error) {

        console.error(
            "Response error:",
            error
        );
    }
}


// ========================================
// TOAST
// ========================================

function showToast(
    message,
    type = "info"
) {

    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.className =
        `toast ${type}`;


    toast.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        3000
    );
}


// ========================================
// REFRESH
// ========================================

function updateLastUpdated() {

    const element =
        document.getElementById(
            "lastUpdated"
        );

    if (!element) {
        return;
    }


    element.textContent =
        `Updated ${new Date().toLocaleTimeString()}`;
}


function setupRefreshButton() {

    const button =
        document.getElementById(
            "refreshBtn"
        );

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;

            button.textContent =
                "Refreshing...";


            try {

                await loadDashboard();

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Refresh";
            }
        }
    );
}


// ========================================
// HELPERS
// ========================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value;
    }
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


function formatDate(value) {

    if (!value) {
        return "N/A";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return escapeHtml(
            value
        );
    }


    return date.toLocaleString();
}


function severityClass(
    severity
) {

    const value =
        String(
            severity || ""
        ).toUpperCase();


    if (
        value === "CRITICAL" ||
        value === "HIGH" ||
        Number(value) >= 7
    ) {
        return "high";
    }


    if (
        value === "MEDIUM" ||
        Number(value) >= 4
    ) {
        return "medium";
    }


    return "low";
}


function statusClass(
    status
) {

    return String(
        status || "NEW"
    )
        .toLowerCase()
        .replaceAll(
            " ",
            "-"
        );
}


// ========================================
// START
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupRefreshButton();

        loadDashboard();


        // Auto refresh every 15 seconds
        setInterval(
            loadDashboard,
            15000
        );
    }
);