// ============================================================
// AEGIS X — SECURITY INTELLIGENCE DASHBOARD
// ============================================================

const $ = id => document.getElementById(id);


// ============================================================
// API
// ============================================================

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
    } catch (_) {
        // Response may not contain JSON.
    }

    if (!response.ok) {
        throw new Error(
            data.detail ||
            `HTTP ${response.status}`
        );
    }

    return data;
};


// ============================================================
// HELPERS
// ============================================================

const esc = value => String(
    value ?? "—"
).replace(
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

    setTimeout(() => {
        element.classList.remove("show");
    }, 2500);
};


const normalizeStatus = value =>
    String(value || "OPEN").toUpperCase();


// ============================================================
// INCIDENT STATUS
// ============================================================

async function setIncident(id, status) {

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


// ============================================================
// SIMULATED RESPONSE
// ============================================================

async function respond(id) {

    const confirmed = window.confirm(
        `Run simulated response for incident #${id}?\n\n` +
        `AEGIS X will remain in SIMULATION mode.`
    );

    if (!confirmed) {
        return;
    }

    try {

        const data = await api(
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


// ============================================================
// INVESTIGATION OVERLAY
// ============================================================

function getInvestigationElements() {

    return {
        overlay: $("investigationOverlay"),
        title: $("investigationTitle"),
        subtitle: $("investigationSubtitle"),
        content: $("investigationContent"),
        attackStory: $("attackStory"),
        graph: $("securityGraph"),
        graphStats: $("graphStats"),
        graphLegend: $("graphLegend"),
        timeline: $("investigationTimeline")
    };
}


// ============================================================
// OPEN INVESTIGATION
// ============================================================

async function investigate(id) {

    const elements =
        getInvestigationElements();

    if (!elements.overlay) {
        console.error(
            "Investigation overlay not found."
        );

        return;
    }

    elements.overlay.classList.add("open");

    elements.overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    if (elements.title) {
        elements.title.textContent =
            `Incident #${id}`;
    }

    if (elements.subtitle) {
        elements.subtitle.textContent =
            "Loading security investigation...";
    }

    if (elements.attackStory) {
        elements.attackStory.innerHTML = `
            <div class="investigation-loading">
                <div class="investigation-spinner"></div>
                <span>
                    Building attack story...
                </span>
            </div>
        `;
    }

    if (elements.graph) {
        elements.graph.innerHTML = `
            <div class="graph-loading">
                Loading security graph...
            </div>
        `;
    }

    if (elements.timeline) {
        elements.timeline.innerHTML = `
            <div class="investigation-loading">
                <div class="investigation-spinner"></div>
                <span>
                    Loading investigation timeline...
                </span>
            </div>
        `;
    }

    try {

        /*
         * Timeline and Security Graph are independent
         * read-only investigation APIs.
         */
        const [
            timelineData,
            graphData
        ] = await Promise.all([
            api(
                `/api/v1/incidents/${id}/timeline`
            ),
            api(
                `/api/v1/incidents/${id}/graph`
            )
        ]);

        renderInvestigation(
            timelineData,
            graphData
        );

    } catch (error) {

        console.error(
            "Investigation error:",
            error
        );

        if (elements.content) {

            elements.content.innerHTML = `
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
}


// ============================================================
// CLOSE INVESTIGATION
// ============================================================

function closeInvestigation() {

    const overlay =
        $("investigationOverlay");

    if (!overlay) {
        return;
    }

    overlay.classList.remove("open");

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

    /*
     * Remove node tooltip if one exists.
     */
    const tooltip =
        $("graphTooltip");

    if (tooltip) {
        tooltip.remove();
    }
}


// ============================================================
// RENDER COMPLETE INVESTIGATION
// ============================================================

function renderInvestigation(
    timelineData,
    graphData
) {

    const incident =
        graphData?.incident ||
        timelineData?.incident ||
        {};

    const timeline =
        Array.isArray(
            timelineData?.timeline
        )
            ? timelineData.timeline
            : [];

    const elements =
        getInvestigationElements();

    /*
     * Header
     */

    if (elements.title) {

        elements.title.textContent =
            `Incident #${incident.id ?? "—"}`;
    }

    if (elements.subtitle) {

        elements.subtitle.textContent =
            `${incident.incident_type || "UNKNOWN"} · Security Investigation`;
    }


    /*
     * Render each investigation component
     * independently.
     */

    renderAttackStory(
        graphData,
        incident
    );

    renderSecurityGraph(
        graphData
    );

    renderTimeline(
        timeline
    );
}


// ============================================================
// ATTACK STORY
// ============================================================

function renderAttackStory(
    graphData,
    incident
) {

    const container =
        $("attackStory");

    if (!container) {
        return;
    }

    const story =
        graphData?.attack_story || {};

    const responses =
        Array.isArray(
            story.responses
        )
            ? story.responses
            : [];

    const responseText =
        responses.length
            ? responses
                .map(
                    response =>
                        `${response.action || "RESPONSE"} ` +
                        `(${response.mode || "SIMULATION"})`
                )
                .join(" → ")
            : "No response action recorded.";

    container.innerHTML = `

        <div class="investigation-summary">

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
                        normalizeStatus(
                            incident.status
                        )
                    )}
                ">
                    ${esc(
                        normalizeStatus(
                            incident.status
                        )
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
                        DETECTION
                    </span>

                    <strong>
                        ${esc(
                            story.detection ||
                            incident.incident_type ||
                            "UNKNOWN"
                        )}
                    </strong>
                </div>


                <div>
                    <span>
                        RESPONSES
                    </span>

                    <strong>
                        ${responses.length}
                    </strong>
                </div>

            </div>


            <div class="investigation-description">

                ${esc(
                    incident.description ||
                    "No incident description available."
                )}

            </div>

        </div>


        <div class="attack-story">

            <div class="attack-story-head">

                <div>

                    <div class="investigation-label">
                        ATTACK STORY
                    </div>

                    <h3>
                        Correlated Attack Path
                    </h3>

                </div>

                <span class="timeline-count">
                    ${graphData?.graph?.node_count ?? 0}
                    NODES
                </span>

            </div>


            <div class="attack-story-flow">

                <div class="story-step">
                    <span class="story-number">01</span>

                    <div>
                        <strong>
                            Source Activity
                        </strong>

                        <small>
                            ${esc(
                                story.source ||
                                incident.source_ip ||
                                "Unknown source"
                            )}
                        </small>
                    </div>
                </div>


                <div class="story-arrow">
                    ↓
                </div>


                <div class="story-step">
                    <span class="story-number">02</span>

                    <div>
                        <strong>
                            Detection
                        </strong>

                        <small>
                            ${esc(
                                story.detection ||
                                incident.incident_type ||
                                "UNKNOWN"
                            )}
                        </small>
                    </div>
                </div>


                <div class="story-arrow">
                    ↓
                </div>


                <div class="story-step">
                    <span class="story-number">03</span>

                    <div>
                        <strong>
                            Risk Assessment
                        </strong>

                        <small>
                            ${esc(
                                story.risk_score ??
                                incident.risk_score ??
                                0
                            )}
                            /
                            ${esc(
                                story.risk_level ||
                                incident.risk_level ||
                                "LOW"
                            )}
                        </small>
                    </div>
                </div>


                <div class="story-arrow">
                    ↓
                </div>


                <div class="story-step">
                    <span class="story-number">04</span>

                    <div>
                        <strong>
                            Incident
                        </strong>

                        <small>
                            Incident #${esc(
                                story.incident_id ??
                                incident.id ??
                                "?"
                            )}
                        </small>
                    </div>
                </div>


                <div class="story-arrow">
                    ↓
                </div>


                <div class="story-step">
                    <span class="story-number">05</span>

                    <div>
                        <strong>
                            Response
                        </strong>

                        <small>
                            ${esc(responseText)}
                        </small>
                    </div>
                </div>

            </div>

        </div>
    `;
}


// ============================================================
// SECURITY GRAPH
// ============================================================

function renderSecurityGraph(
    payload
) {

    const container =
        $("securityGraph");

    const stats =
        $("graphStats");

    const legend =
        $("graphLegend");

    if (!container) {
        return;
    }

    const graph =
        payload?.graph;

    if (!graph) {

        container.innerHTML = `
            <div class="graph-error">
                Security graph data unavailable.
            </div>
        `;

        return;
    }

    const nodes =
        Array.isArray(graph.nodes)
            ? graph.nodes
            : [];

    const edges =
        Array.isArray(graph.edges)
            ? graph.edges
            : [];

    /*
     * Graph statistics.
     */

    if (stats) {

        stats.innerHTML = `

            <span class="graph-stat">
                ${graph.node_count ?? nodes.length}
                NODES
            </span>

            <span class="graph-stat">
                ${graph.edge_count ?? edges.length}
                RELATIONSHIPS
            </span>

        `;
    }


    if (!nodes.length) {

        container.innerHTML = `
            <div class="graph-empty">
                No graph relationships found.
            </div>
        `;

        return;
    }


    /*
     * Group nodes by type.
     */

    const grouped = {};

    nodes.forEach(node => {

        const type =
            String(
                node.type ||
                "UNKNOWN"
            ).toUpperCase();

        if (!grouped[type]) {
            grouped[type] = [];
        }

        grouped[type].push(node);
    });


    /*
     * Fixed investigation flow.
     */

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


    /*
     * Calculate graph dimensions.
     */

    const columnWidth = 190;

    const columnGap = 25;

    const leftPadding = 30;

    const topPadding = 25;

    const nodeWidth = 150;

    const nodeHeight = 76;

    const rowGap = 22;


    const columns = [];

    order.forEach(type => {

        const items =
            grouped[type] || [];

        if (items.length) {
            columns.push({
                type,
                items
            });
        }
    });


    const maxRows =
        Math.max(
            ...columns.map(
                column =>
                    column.items.length
            ),
            1
        );


    const canvasWidth =
        Math.max(
            900,
            leftPadding * 2 +
            columns.length *
                columnWidth +
            (columns.length - 1) *
                columnGap
        );


    const canvasHeight =
        Math.max(
            300,
            topPadding * 2 +
            maxRows *
                nodeHeight +
            (maxRows - 1) *
                rowGap
        );


    /*
     * Position nodes.
     */

    const positioned = [];

    const nodeMap = {};

    columns.forEach(
        (column, columnIndex) => {

            const items =
                column.items;

            const totalHeight =
                items.length *
                    nodeHeight +
                Math.max(
                    0,
                    items.length - 1
                ) *
                    rowGap;

            const startY =
                Math.max(
                    topPadding,
                    (
                        canvasHeight -
                        totalHeight
                    ) / 2
                );

            items.forEach(
                (node, rowIndex) => {

                    const x =
                        leftPadding +
                        columnIndex *
                            (
                                columnWidth +
                                columnGap
                            );

                    const y =
                        startY +
                        rowIndex *
                            (
                                nodeHeight +
                                rowGap
                            );

                    const positionedNode = {
                        ...node,
                        x,
                        y,
                        width: nodeWidth,
                        height: nodeHeight
                    };

                    positioned.push(
                        positionedNode
                    );

                    nodeMap[node.id] =
                        positionedNode;
                }
            );
        }
    );


    /*
     * Create SVG relationship layer.
     */

    const svgEdges =
        edges.map(edge => {

            const source =
                nodeMap[edge.source];

            const target =
                nodeMap[edge.target];

            if (!source || !target) {
                return "";
            }


            const x1 =
                source.x +
                source.width;

            const y1 =
                source.y +
                source.height / 2;

            const x2 =
                target.x;

            const y2 =
                target.y +
                target.height / 2;


            const distance =
                Math.max(
                    30,
                    (x2 - x1) * 0.4
                );


            const path = `
                M ${x1} ${y1}
                C ${x1 + distance} ${y1},
                  ${x2 - distance} ${y2},
                  ${x2} ${y2}
            `;


            return `
                <path
                    class="graph-edge"
                    d="${path}"
                />
            `;
        }).join("");


    /*
     * Create graph nodes.
     */

    const nodeHtml =
        positioned.map(node => {

            const metadata =
                node.metadata || {};

            const type =
                String(
                    node.type ||
                    "UNKNOWN"
                ).toUpperCase();


            let metaText = "";


            switch (type) {

                case "SOURCE":

                    metaText =
                        metadata.source_ip ||
                        "";

                    break;


                case "EVENT":

                    metaText =
                        metadata.event_id
                            ? `Event #${metadata.event_id}`
                            : "";

                    break;


                case "DETECTION":

                    metaText =
                        metadata.detection_type ||
                        "";

                    break;


                case "ALERT":

                    metaText =
                        `${metadata.status || "NEW"} · ` +
                        `Risk ${metadata.risk_score ?? 0}`;

                    break;


                case "RISK":

                    metaText =
                        `Score ${metadata.score ?? 0}`;

                    break;


                case "INCIDENT":

                    metaText =
                        `#${metadata.incident_id ?? ""} · ` +
                        `${metadata.status || "OPEN"}`;

                    break;


                case "RESPONSE":

                    metaText =
                        `${metadata.mode || "SIMULATION"} · ` +
                        `${metadata.status || "SIMULATED"}`;

                    break;


                case "STATUS":

                    metaText =
                        metadata.status ||
                        "";

                    break;

            }


            return `

                <div
                    class="graph-node"
                    data-node-id="${esc(node.id)}"
                    data-type="${esc(type)}"
                    style="
                        left:${node.x}px;
                        top:${node.y}px;
                    "
                >

                    <div class="graph-node-type">
                        ${esc(type)}
                    </div>

                    <div class="graph-node-label">
                        ${esc(node.label)}
                    </div>

                    ${
                        metaText
                            ? `
                                <div class="graph-node-meta">
                                    ${esc(metaText)}
                                </div>
                            `
                            : ""
                    }

                </div>

            `;
        }).join("");


    /*
     * Render graph.
     */

    container.innerHTML = `

        <div
            class="graph-canvas"
            style="
                width:${canvasWidth}px;
                min-height:${canvasHeight}px;
            "
        >

            <svg
                class="graph-edge-layer"
                viewBox="
                    0
                    0
                    ${canvasWidth}
                    ${canvasHeight}
                "
                preserveAspectRatio="none"
            >
                ${svgEdges}
            </svg>

            ${nodeHtml}

        </div>
    `;


    /*
     * Node interaction.
     */

    container
        .querySelectorAll(".graph-node")
        .forEach(element => {

            element.addEventListener(
                "click",
                () => {

                    const nodeId =
                        element.dataset.nodeId;

                    const node =
                        positioned.find(
                            item =>
                                item.id === nodeId
                        );

                    if (!node) {
                        return;
                    }


                    container
                        .querySelectorAll(
                            ".graph-node"
                        )
                        .forEach(item => {

                            item.classList.remove(
                                "selected"
                            );

                        });


                    element.classList.add(
                        "selected"
                    );


                    showGraphTooltip(
                        node,
                        element
                    );
                }
            );
        });


    /*
     * Legend.
     */

    renderGraphLegend();
}


// ============================================================
// GRAPH LEGEND
// ============================================================

function renderGraphLegend() {

    const legend =
        $("graphLegend");

    if (!legend) {
        return;
    }


    const types = [
        "SOURCE",
        "EVENT",
        "DETECTION",
        "ALERT",
        "RISK",
        "INCIDENT",
        "RESPONSE",
        "STATUS"
    ];


    legend.innerHTML =
        types.map(type => `

            <span
                class="graph-legend-item"
                data-type="${type}"
            >

                <span
                    class="graph-legend-dot"
                ></span>

                ${type}

            </span>

        `).join("");
}


// ============================================================
// GRAPH TOOLTIP
// ============================================================

function showGraphTooltip(
    node,
    element
) {

    let tooltip =
        $("graphTooltip");


    if (!tooltip) {

        tooltip =
            document.createElement("div");

        tooltip.id =
            "graphTooltip";

        tooltip.className =
            "graph-tooltip";

        document.body.appendChild(
            tooltip
        );
    }


    const metadata =
        node.metadata || {};


    const rows =
        Object.entries(metadata)
            .filter(
                ([, value]) =>
                    value !== null &&
                    value !== undefined
            )
            .map(
                ([key, value]) => `

                    <div class="graph-tooltip-row">

                        <strong>
                            ${esc(key)}:
                        </strong>

                        ${esc(value)}

                    </div>

                `
            )
            .join("");


    tooltip.innerHTML = `

        <div class="graph-tooltip-title">

            ${esc(node.type)}
            ·
            ${esc(node.label)}

        </div>

        ${rows}

    `;


    tooltip.style.display =
        "block";


    /*
     * Position beside clicked node.
     */

    const rect =
        element.getBoundingClientRect();


    let left =
        rect.right + 12;

    let top =
        rect.top;


    if (
        left + 290 >
        window.innerWidth
    ) {
        left =
            rect.left - 302;
    }


    if (
        top + 220 >
        window.innerHeight
    ) {
        top =
            window.innerHeight - 235;
    }


    tooltip.style.left =
        `${Math.max(10, left)}px`;

    tooltip.style.top =
        `${Math.max(10, top)}px`;


    /*
     * Close automatically.
     */

    clearTimeout(
        tooltip._hideTimer
    );


    tooltip._hideTimer =
        setTimeout(() => {

            tooltip.style.display =
                "none";

        }, 7000);
}


// ============================================================
// INVESTIGATION TIMELINE
// ============================================================

function renderTimeline(
    timeline
) {

    const container =
        $("investigationTimeline");

    if (!container) {
        return;
    }


    if (!timeline.length) {

        container.innerHTML = `
            <div class="empty">
                No timeline activity available.
            </div>
        `;

        return;
    }


    container.innerHTML =
        timeline
            .map(
                (item, index) =>
                    renderTimelineItem(
                        item,
                        index,
                        timeline.length
                    )
            )
            .join("");
}


// ============================================================
// TIMELINE ITEM
// ============================================================

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


// ============================================================
// TIMELINE STYLE CLASS
// ============================================================

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


// ============================================================
// TIMELINE ICON
// ============================================================

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


// ============================================================
// DASHBOARD LOAD
// ============================================================

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


        // ====================================================
        // HEALTH
        // ====================================================

        const healthText =
            $("healthText");

        if (healthText) {

            healthText.textContent =
                health.status === "healthy"
                    ? "Operational"
                    : "Degraded";
        }


        // ====================================================
        // METRICS
        // ====================================================

        const eventsCount =
            $("eventsCount");

        if (eventsCount) {
            eventsCount.textContent =
                events.total ?? 0;
        }


        const active =
            (alerts.alerts || [])
                .filter(
                    alert =>
                        normalizeStatus(
                            alert.status ||
                            "NEW"
                        ) !== "RESOLVED"
                );


        const activeAlerts =
            $("activeAlerts");

        if (activeAlerts) {
            activeAlerts.textContent =
                active.length;
        }


        const open =
            (incidents.incidents || [])
                .filter(
                    incident =>
                        normalizeStatus(
                            incident.status ||
                            "OPEN"
                        ) !== "RESOLVED"
                );


        const openIncidents =
            $("openIncidents");

        if (openIncidents) {
            openIncidents.textContent =
                open.length;
        }


        const riskScores =
            open.map(
                incident =>
                    Number(
                        incident.risk_score ||
                        0
                    )
            );


        const highestRisk =
            $("highestRisk");

        if (highestRisk) {

            highestRisk.textContent =
                riskScores.length
                    ? Math.max(
                        ...riskScores
                    )
                    : "0";
        }


        const detectionTag =
            $("detectionTag");

        if (detectionTag) {

            detectionTag.textContent =
                `${detections.alerts_generated ?? 0} detected`;
        }


        const lastUpdated =
            $("lastUpdated");

        if (lastUpdated) {

            lastUpdated.textContent =
                `Updated ${
                    new Date()
                        .toLocaleTimeString()
                }`;
        }


        // ====================================================
        // DETECTIONS
        // ====================================================

        const detectionContainer =
            $("detections");


        if (detectionContainer) {

            detectionContainer.innerHTML =
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
                                            alert.source_ip ||
                                            "N/A"
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
        }


        // ====================================================
        // RESPONSE ACTIVITY
        // ====================================================

        const responseContainer =
            $("responses");


        if (responseContainer) {

            responseContainer.innerHTML =
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
        }


        // ====================================================
        // INCIDENTS
        // ====================================================

        const incidentRows =
            $("incidentRows");


        if (incidentRows) {

            incidentRows.innerHTML =
                incidents.incidents?.length

                    ? incidents.incidents
                        .map(
                            incident => {

                                const status =
                                    normalizeStatus(
                                        incident.status
                                    );


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

                                            <div class="table-actions">

                                                <button
                                                    class="
                                                        action-btn
                                                        investigate-btn
                                                    "
                                                    type="button"
                                                    onclick="
                                                        investigate(
                                                            ${incident.id}
                                                        )
                                                    "
                                                >
                                                    INVESTIGATE
                                                </button>


                                                ${
                                                    status !== "RESOLVED"
                                                        ? `

                                                            <button
                                                                class="action-btn"
                                                                type="button"
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


                                                ${
                                                    status === "OPEN"
                                                        ? `

                                                            <button
                                                                class="action-btn"
                                                                type="button"
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


                                                ${
                                                    status === "ACKNOWLEDGED"
                                                        ? `

                                                            <button
                                                                class="action-btn"
                                                                type="button"
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
                                                    status === "RESOLVED"
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
        }


        // ====================================================
        // ALERTS
        // ====================================================

        const alertRows =
            $("alertRows");


        if (alertRows) {

            alertRows.innerHTML =
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
        }


        // ====================================================
        // EVENTS
        // ====================================================

        const eventRows =
            $("eventRows");


        if (eventRows) {

            eventRows.innerHTML =
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
        }


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


// ============================================================
// KEYBOARD CONTROL
// ============================================================

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            closeInvestigation();
        }

    }
);


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
         * The investigation overlay is now part of index.html.
         * We deliberately DO NOT create another one here.
         */

        const refresh =
            $("refreshBtn");


        if (refresh) {

            refresh.addEventListener(
                "click",
                load
            );
        }


        load();


        /*
         * Refresh dashboard every 15 seconds.
         * This endpoint is read-only.
         */

        setInterval(
            load,
            15000
        );

    }
);