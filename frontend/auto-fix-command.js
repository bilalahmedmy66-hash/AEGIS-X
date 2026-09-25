(() => {
    "use strict";

    const STYLE_ID = "aegis-autofix-final-style";
    const OVERLAY_ID = "aegis-autofix-final-overlay";

    /* =========================================================
       HARD EXECUTION GATE
       Any Auto-Fix POST is blocked unless this exact UI flow
       explicitly authorizes it.
       ========================================================= */

    let executionGate = null;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function(input, init = {}) {
        const url = typeof input === "string"
            ? input
            : (input && input.url) || "";

        const method = String(
            init.method ||
            (typeof input !== "string" && input && input.method) ||
            "GET"
        ).toUpperCase();

        const match = url.match(/\/api\/v1\/incidents\/(\d+)\/auto-fix$/);

        if (match && method === "POST") {
            const incidentId = Number(match[1]);

            if (executionGate !== incidentId) {
                console.warn("AEGIS Auto-Fix: premature execution blocked.");

                return new Response(
                    JSON.stringify({
                        success: false,
                        blocked: true,
                        reason: "Explicit EXECUTE SIMULATION action required."
                    }),
                    {
                        status: 409,
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );
            }
        }

        return originalFetch(input, init);
    };

    /* =========================================================
       STYLE
       ========================================================= */

    function installStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `
            #${OVERLAY_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483000;
                background:
                    radial-gradient(circle at 50% 0%, rgba(34,211,238,.10), transparent 42%),
                    rgba(2,8,15,.96);
                display:flex;
                align-items:center;
                justify-content:center;
                padding:24px;
                box-sizing:border-box;
                font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                color:#dbeafe;
            }

            #${OVERLAY_ID} .afx-shell {
                width:min(900px,96vw);
                max-height:92vh;
                overflow:auto;
                border:1px solid rgba(71,85,105,.65);
                border-radius:18px;
                background:#07111b;
                box-shadow:
                    0 30px 100px rgba(0,0,0,.65),
                    0 0 60px rgba(34,211,238,.07);
            }

            #${OVERLAY_ID} .afx-head {
                padding:28px 30px 22px;
                border-bottom:1px solid rgba(71,85,105,.35);
            }

            #${OVERLAY_ID} .afx-kicker {
                color:#67e8f9;
                font-size:11px;
                font-weight:800;
                letter-spacing:1.7px;
                text-transform:uppercase;
                margin-bottom:8px;
            }

            #${OVERLAY_ID} .afx-title {
                font-size:27px;
                font-weight:850;
                letter-spacing:-.6px;
                color:#f8fafc;
            }

            #${OVERLAY_ID} .afx-sub {
                margin-top:6px;
                color:#7f94a8;
                font-size:13px;
            }

            #${OVERLAY_ID} .afx-scan {
                padding:20px 30px;
            }

            #${OVERLAY_ID} .afx-stage {
                display:flex;
                align-items:center;
                gap:14px;
                padding:16px 0;
                border-bottom:1px solid rgba(51,65,85,.38);
                font-size:14px;
            }

            #${OVERLAY_ID} .afx-dot {
                width:9px;
                height:9px;
                border-radius:50%;
                background:#334155;
                box-shadow:0 0 0 4px rgba(51,65,85,.15);
                flex:none;
            }

            #${OVERLAY_ID} .afx-stage.active .afx-dot {
                background:#22d3ee;
                box-shadow:0 0 14px rgba(34,211,238,.7);
            }

            #${OVERLAY_ID} .afx-stage.done .afx-dot {
                background:#34d399;
                box-shadow:0 0 12px rgba(52,211,153,.55);
            }

            #${OVERLAY_ID} .afx-stage.active span {
                color:#67e8f9;
            }

            #${OVERLAY_ID} .afx-stage.done span {
                color:#6ee7b7;
            }

            #${OVERLAY_ID} .afx-evidence {
                display:grid;
                grid-template-columns:repeat(4,1fr);
                gap:12px;
                margin-top:20px;
            }

            #${OVERLAY_ID} .afx-card {
                padding:18px;
                border:1px solid rgba(51,65,85,.65);
                border-radius:12px;
                background:#0a1622;
            }

            #${OVERLAY_ID} .afx-num {
                font-size:25px;
                font-weight:850;
                color:#f8fafc;
            }

            #${OVERLAY_ID} .afx-label {
                margin-top:5px;
                color:#71869a;
                font-size:11px;
                text-transform:uppercase;
                letter-spacing:.8px;
            }

            #${OVERLAY_ID} .afx-decision {
                margin:20px 0 0;
                padding:22px;
                border:1px solid rgba(34,211,238,.28);
                border-left:4px solid #22d3ee;
                border-radius:12px;
                background:linear-gradient(135deg,#0b1d2a,#0a1722);
            }

            #${OVERLAY_ID} .afx-decision-label {
                color:#67e8f9;
                font-size:10px;
                font-weight:850;
                letter-spacing:1.5px;
                text-transform:uppercase;
            }

            #${OVERLAY_ID} .afx-action {
                margin-top:8px;
                font-size:25px;
                font-weight:900;
                color:#f8fafc;
            }

            #${OVERLAY_ID} .afx-meta {
                margin-top:7px;
                color:#8ca0b2;
                font-size:12px;
            }

            #${OVERLAY_ID} .afx-brain {
                margin-top:12px;
                padding:16px 18px;
                border:1px solid rgba(99,102,241,.25);
                border-radius:11px;
                background:#0c1020;
            }

            #${OVERLAY_ID} .afx-brain strong {
                display:block;
                color:#a5b4fc;
                font-size:10px;
                letter-spacing:1.2px;
                text-transform:uppercase;
                margin-bottom:7px;
            }

            #${OVERLAY_ID} .afx-brain-text {
                color:#aebdca;
                font-size:12px;
                line-height:1.55;
            }

            #${OVERLAY_ID} .afx-boundary {
                margin-top:12px;
                padding:14px 16px;
                border:1px solid rgba(52,211,153,.22);
                border-radius:11px;
                background:#071a18;
                color:#94a3b8;
                font-size:11px;
                line-height:1.5;
            }

            #${OVERLAY_ID} .afx-boundary strong {
                color:#6ee7b7;
            }

            #${OVERLAY_ID} .afx-foot {
                display:flex;
                justify-content:flex-end;
                gap:10px;
                padding:18px 30px;
                border-top:1px solid rgba(71,85,105,.35);
            }

            #${OVERLAY_ID} button {
                border:0;
                border-radius:9px;
                padding:12px 20px;
                font-weight:800;
                font-size:11px;
                letter-spacing:.5px;
                cursor:pointer;
            }

            #${OVERLAY_ID} .afx-cancel {
                background:#0c1824;
                color:#94a3b8;
                border:1px solid #26384a;
            }

            #${OVERLAY_ID} .afx-execute {
                background:#22a6c7;
                color:#021017;
                min-width:190px;
            }

            #${OVERLAY_ID} .afx-execute:hover {
                background:#2fc2e6;
            }

            #${OVERLAY_ID} .afx-execute:disabled {
                opacity:.55;
                cursor:not-allowed;
            }

            @media(max-width:700px) {
                #${OVERLAY_ID} .afx-evidence {
                    grid-template-columns:repeat(2,1fr);
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =========================================================
       HELPERS
       ========================================================= */

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function getIncidentId(button) {
        const row = button.closest("tr");

        if (row) {
            const text = row.innerText || "";
            const match = text.match(/(?:incident\s*#?\s*)?(\d+)/i);
            if (match) return Number(match[1]);
        }

        const candidates = [
            button.dataset.incidentId,
            button.getAttribute("data-incident-id")
        ];

        for (const value of candidates) {
            if (value && /^\d+$/.test(value)) return Number(value);
        }

        return null;
    }

    async function getJson(url) {
        const response = await originalFetch(url, {
            method:"GET",
            cache:"no-store"
        });

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    function firstNumber(...values) {
        for (const value of values) {
            const n = Number(value);
            if (Number.isFinite(n)) return n;
        }
        return 0;
    }

    function getRecommendation(preview, incident) {
        const brain = preview?.security_brain || {};
        const response = brain.response || {};
        const assessment = preview?.ai_assessment || {};

        const action =
            response.recommended_action ||
            preview?.recommended_action ||
            preview?.action ||
            assessment.recommended_action ||
            assessment.action ||
            "";

        if (action) return String(action).toUpperCase();

        const risk = firstNumber(
            incident?.risk_score,
            brain?.incident?.risk_score
        );

        if (risk >= 75) return "ISOLATE_SOURCE";
        if (risk >= 50) return "BLOCK_SOURCE";
        if (risk >= 25) return "ALERT";

        return "MONITOR";
    }

    function getRisk(incident, preview) {
        return firstNumber(
            incident?.risk_score,
            preview?.security_brain?.incident?.risk_score
        );
    }

    function getRiskLevel(incident, preview) {
        return (
            incident?.risk_level ||
            preview?.security_brain?.incident?.risk_level ||
            (getRisk(incident,preview) >= 75
                ? "CRITICAL"
                : getRisk(incident,preview) >= 50
                    ? "HIGH"
                    : getRisk(incident,preview) >= 25
                        ? "MEDIUM"
                        : "LOW")
        ).toUpperCase();
    }

    function getBrainText(preview) {
        const brain = preview?.security_brain || {};
        const assessment = preview?.ai_assessment || {};

        return (
            assessment.assessment ||
            assessment.conclusion ||
            assessment.summary ||
            brain?.conclusion ||
            brain?.analysis ||
            "Evidence-driven security analysis completed. The response remains subject to AEGIS Shield safety controls."
        );
    }

    function stageMarkup(doneIndex) {
        const stages = [
            "Reading incident context",
            "Processing security telemetry",
            "Correlating detection evidence",
            "AI security reasoning",
            "AEGIS Shield safety validation"
        ];

        return stages.map((name,index) => `
            <div class="afx-stage ${index < doneIndex ? "done" : index === doneIndex ? "active" : ""}">
                <i class="afx-dot"></i>
                <span>${esc(name)}</span>
            </div>
        `).join("");
    }

    function openOverlay(incidentId) {
        closeOverlay();

        const overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;

        overlay.innerHTML = `
            <div class="afx-shell">
                <div class="afx-head">
                    <div class="afx-kicker">AEGIS X · RESPONSE ANALYSIS</div>
                    <div class="afx-title">Security Analysis</div>
                    <div class="afx-sub">Incident #${esc(incidentId)} · No response execution has been authorized</div>
                </div>

                <div class="afx-scan" id="afx-content">
                    ${stageMarkup(0)}
                </div>

                <div class="afx-foot">
                    <button class="afx-cancel" id="afx-cancel">CANCEL</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector("#afx-cancel").onclick = closeOverlay;

        return overlay;
    }

    function closeOverlay() {
        const existing = document.getElementById(OVERLAY_ID);
        if (existing) existing.remove();
        executionGate = null;
    }

    async function run(incidentId) {
        installStyle();

        const overlay = openOverlay(incidentId);
        const content = overlay.querySelector("#afx-content");

        try {
            const [incidentData, eventsData, alertsData, responsesData] =
                await Promise.all([
                    getJson("/api/v1/incidents"),
                    getJson("/api/v1/events"),
                    getJson("/api/v1/alerts"),
                    getJson("/api/v1/responses")
                ]);

            const incidents = Array.isArray(incidentData)
                ? incidentData
                : (incidentData?.incidents || incidentData?.items || []);

            const events = Array.isArray(eventsData)
                ? eventsData
                : (eventsData?.events || eventsData?.items || []);

            const alerts = Array.isArray(alertsData)
                ? alertsData
                : (alertsData?.alerts || alertsData?.items || []);

            const responses = Array.isArray(responsesData)
                ? responsesData
                : (responsesData?.responses || responsesData?.items || []);

            const incident =
                incidents.find(x => Number(x.id) === Number(incidentId)) ||
                incidents.find(x => Number(x.incident_id) === Number(incidentId)) ||
                {};

            const incidentSource =
                incident.source_ip ||
                incident.source ||
                null;

            const incidentEvents = events.filter(x =>
                Number(x.incident_id) === Number(incidentId) ||
                (
                    incidentSource &&
                    (
                        x.source_ip === incidentSource ||
                        x.source === incidentSource
                    )
                )
            );

            const incidentAlerts = alerts.filter(x =>
                Number(x.incident_id) === Number(incidentId) ||
                (
                    incidentSource &&
                    (
                        x.source_ip === incidentSource ||
                        x.source === incidentSource
                    )
                )
            );

            const incidentResponses = responses.filter(x =>
                Number(x.incident_id) === Number(incidentId)
            );

            for (let i=1; i<5; i++) {
                await new Promise(resolve => setTimeout(resolve,220));

                content.innerHTML = stageMarkup(i);
            }

            const preview = await getJson(
                `/api/v1/incidents/${encodeURIComponent(incidentId)}/auto-fix/preview`
            );

            content.innerHTML = stageMarkup(5);

            await new Promise(resolve => setTimeout(resolve,350));

            const action = getRecommendation(preview, incident);
            const risk = getRisk(incident, preview);
            const riskLevel = getRiskLevel(incident, preview);
            const brainText = getBrainText(preview);

            content.innerHTML = `
                ${stageMarkup(5)}

                <div class="afx-decision">
                    <div class="afx-decision-label">SECURITY DECISION</div>
                    <div class="afx-action">${esc(action)}</div>
                    <div class="afx-meta">
                        Risk ${esc(risk)} · ${esc(riskLevel)} ·
                        SIMULATION MODE · No response executed
                    </div>
                </div>

                <div class="afx-brain">
                    <strong>AEGIS SECURITY BRAIN</strong>
                    <div class="afx-brain-text">${esc(brainText)}</div>
                </div>

                <div class="afx-evidence">
                    <div class="afx-card">
                        <div class="afx-num">${incidentEvents.length}</div>
                        <div class="afx-label">Security events</div>
                    </div>

                    <div class="afx-card">
                        <div class="afx-num">${incidentAlerts.length}</div>
                        <div class="afx-label">Detection alerts</div>
                    </div>

                    <div class="afx-card">
                        <div class="afx-num">${incidentResponses.length}</div>
                        <div class="afx-label">Response history</div>
                    </div>

                    <div class="afx-card">
                        <div class="afx-num">${esc(incidentSource || "—")}</div>
                        <div class="afx-label">Source IP</div>
                    </div>
                </div>

                <div class="afx-boundary">
                    <strong>SHIELD SAFETY</strong><br>
                    Analysis uses incident telemetry, detection evidence, correlation data,
                    response history and security policy. Host filesystem contents are not
                    accessed. The recommended response is simulation-only until you explicitly
                    choose EXECUTE SIMULATION.
                </div>
            `;

            const footer = overlay.querySelector(".afx-foot");

            footer.innerHTML = `
                <button class="afx-cancel" id="afx-cancel">CANCEL</button>
                <button class="afx-execute" id="afx-execute">EXECUTE SIMULATION</button>
            `;

            overlay.querySelector("#afx-cancel").onclick = closeOverlay;

            overlay.querySelector("#afx-execute").onclick = async () => {
                const executeButton = overlay.querySelector("#afx-execute");

                executeButton.disabled = true;
                executeButton.textContent = "EXECUTING SIMULATION…";

                /*
                 * THIS is the only place where the execution gate is opened.
                 */
                executionGate = Number(incidentId);

                try {
                    const response = await originalFetch(
                        `/api/v1/incidents/${encodeURIComponent(incidentId)}/auto-fix`,
                        {
                            method:"POST",
                            headers:{
                                "Content-Type":"application/json"
                            },
                            body:JSON.stringify({})
                        }
                    );

                    const result = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        throw new Error(
                            result?.detail ||
                            result?.reason ||
                            `HTTP ${response.status}`
                        );
                    }

                    const responseId =
                        result?.execution?.response_id ??
                        result?.response_id ??
                        null;

                    content.innerHTML = `
                        ${stageMarkup(5)}

                        <div class="afx-decision">
                            <div class="afx-decision-label">SIMULATION RECORDED</div>
                            <div class="afx-action">${esc(action)}</div>
                            <div class="afx-meta">
                                Response #${esc(responseId ?? "—")} ·
                                SIMULATION · Audit record created
                            </div>
                        </div>

                        <div class="afx-brain">
                            <strong>AEGIS SHIELD</strong>
                            <div class="afx-brain-text">
                                The selected response was recorded in the audit trail.
                                No real blocking, isolation, firewall change, or network
                                enforcement was performed.
                            </div>
                        </div>
                    `;

                    footer.innerHTML = `
                        <button class="afx-cancel" id="afx-close">CLOSE</button>
                    `;

                    overlay.querySelector("#afx-close").onclick = closeOverlay;

                } catch (error) {
                    executeButton.disabled = false;
                    executeButton.textContent = "EXECUTE SIMULATION";

                    const errorBox = document.createElement("div");
                    errorBox.className = "afx-boundary";
                    errorBox.innerHTML =
                        `<strong>EXECUTION FAILED</strong><br>${esc(error.message)}`;

                    content.appendChild(errorBox);

                } finally {
                    executionGate = null;
                }
            };

        } catch (error) {
            content.innerHTML = `
                ${stageMarkup(5)}

                <div class="afx-decision">
                    <div class="afx-decision-label">ANALYSIS ERROR</div>
                    <div class="afx-action">NO EXECUTION PERFORMED</div>
                    <div class="afx-meta">${esc(error.message)}</div>
                </div>
            `;

            overlay.querySelector(".afx-foot").innerHTML = `
                <button class="afx-cancel" id="afx-close">CLOSE</button>
            `;

            overlay.querySelector("#afx-close").onclick = closeOverlay;
        }
    }

    /* =========================================================
       AUTO-FIX BUTTON
       ========================================================= */

    document.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;

        const label = (button.textContent || "")
            .replace(/\s+/g," ")
            .trim();

        if (!/^auto[\s-]*fix$/i.test(label)) return;

        const incidentId = getIncidentId(button);
        if (!incidentId) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        run(incidentId);
    }, true);

    console.log("AEGIS Auto-Fix final execution gate loaded.");
})();
