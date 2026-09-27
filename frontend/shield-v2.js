(function () {
    "use strict";

    const SHIELD_V2_ID = "aegis-shield-v2";

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderAssessment(data) {
        const existing = document.getElementById(SHIELD_V2_ID);
        if (existing) existing.remove();

        const panel = document.getElementById("aegis-shield-center");
        if (!panel) return;

        const section = document.createElement("section");
        section.id = SHIELD_V2_ID;
        section.className = "shield-v2-panel";

        section.innerHTML = `
            <div class="shield-v2-header">
                <div>
                    <div class="shield-v2-kicker">SHIELD 2.0</div>
                    <h3>Response Safety Assessment</h3>
                    <p>Explainable defensive recommendation with enforced simulation boundaries.</p>
                </div>
                <div class="shield-v2-mode">SIMULATION ONLY</div>
            </div>

            <div class="shield-v2-grid">
                <div>
                    <span>RISK</span>
                    <strong>${escapeHtml(data.risk_band)} - ${escapeHtml(data.risk_score)}</strong>
                </div>
                <div>
                    <span>PROPOSED ACTION</span>
                    <strong>${escapeHtml(data.proposed_action)}</strong>
                </div>
                <div>
                    <span>PROTECTION</span>
                    <strong>${escapeHtml(data.protection_state)}</strong>
                </div>
                <div>
                    <span>HUMAN APPROVAL</span>
                    <strong>${data.requires_human_approval ? "REQUIRED" : "NOT REQUIRED"}</strong>
                </div>
            </div>

            <div class="shield-v2-rationale">
                <span>DECISION BASIS</span>
                <p>${escapeHtml(data.rationale)}</p>
            </div>

            <div class="shield-v2-safety">
                <span>SAFETY CONTROLS</span>
                <strong>
                    ${data.simulation_only ? "Simulation only" : "Unknown"}
                    | REAL EXECUTION: ${data.real_execution ? "ENABLED" : "DISABLED"}
                </strong>
            </div>
        `;

        panel.appendChild(section);
    }

    async function assess() {
        try {
            const response = await fetch("/api/v1/shield/assess", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "ISOLATE_SOURCE",
                    risk_score: 100,
                    incident_type: "BRUTE_FORCE"
                })
            });

            if (!response.ok) {
                throw new Error("Shield assessment unavailable");
            }

            renderAssessment(await response.json());
        } catch (error) {
            console.error("Shield 2.0 assessment failed:", error);
        }
    }

    function init() {
        if (document.getElementById("aegis-shield-center")) {
            assess();
            return;
        }

        const observer = new MutationObserver(() => {
            if (document.getElementById("aegis-shield-center")) {
                observer.disconnect();
                assess();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    window.AEGISShieldV2 = {
        assess
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();


