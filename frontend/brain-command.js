(() => {
  const ROOT_ID = "aegis-security-command-center";

  if (document.getElementById(ROOT_ID)) return;

  const esc = (v) => String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  async function getBrain() {
    const candidates = [
      document.querySelector("#aegis-ai-incident"),
      document.querySelector("input[type='number']"),
      document.querySelector("input")
    ];

    let incidentId = 15;

    for (const el of candidates) {
      if (el && Number(el.value) > 0) {
        incidentId = Number(el.value);
        break;
      }
    }

    try {
      const response = await fetch(
        `/api/v1/incidents/${incidentId}/brain`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Brain API ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("AEGIS SECURITY BRAIN:", error);
      return null;
    }
  }

  function chainHTML(brain) {
    const signals = brain?.evidence?.observed || [];

    const unique = [...new Set(signals)];

    const nodes = [];

    nodes.push(`
      <div class="aegis-brain-node">
        <strong>SOURCE</strong>
        <small>${esc(brain?.incident?.source_ip || "UNKNOWN")}</small>
      </div>
    `);

    unique.slice(0, 4).forEach((signal) => {
      nodes.push(`
        <div class="aegis-brain-arrow">→</div>
        <div class="aegis-brain-node">
          <strong>${esc(signal)}</strong>
          <small>OBSERVED</small>
        </div>
      `);
    });

    nodes.push(`
      <div class="aegis-brain-arrow">→</div>
      <div class="aegis-brain-node">
        <strong>RISK</strong>
        <small>${esc(brain?.incident?.risk_level || "UNKNOWN")}</small>
      </div>
    `);

    nodes.push(`
      <div class="aegis-brain-arrow">→</div>
      <div class="aegis-brain-node">
        <strong>RESPONSE</strong>
        <small>${esc(brain?.response?.recommended_action || "MONITOR")}</small>
      </div>
    `);

    return nodes.join("");
  }

  function evidenceHTML(brain) {
    const events = Number(brain?.evidence?.event_count || 0);
    const alerts = Number(brain?.evidence?.alert_count || 0);
    const signals = brain?.evidence?.observed || [];

    return `
      <div class="aegis-brain-evidence">

        <div class="aegis-brain-evidence-row">
          <b>Observed Events</b>
          <span>${events}</span>
        </div>

        <div class="aegis-brain-evidence-row">
          <b>Security Alerts</b>
          <span>${alerts}</span>
        </div>

        <div class="aegis-brain-evidence-row">
          <b>Observed Signals</b>
          <span>${signals.length}</span>
        </div>

        <div class="aegis-brain-evidence-row">
          <b>Attacker Intent</b>
          <span>${esc(brain?.reasoning?.intent || "UNKNOWN")}</span>
        </div>

        <div class="aegis-brain-evidence-row">
          <b>Successful Compromise</b>
          <span>${esc(brain?.reasoning?.successful_compromise || "UNKNOWN")}</span>
        </div>

      </div>
    `;
  }

  function unknownHTML(brain) {
    const items = brain?.unknowns || [];

    if (!items.length) {
      return `<div style="opacity:.5;font-size:12px">No unresolved intelligence gaps.</div>`;
    }

    return `
      <div class="aegis-brain-unknown">
        ${items.map(item => `<div>○ ${esc(item)}</div>`).join("")}
      </div>
    `;
  }

  function render(brain) {
    if (!brain || brain.status !== "ACTIVE") {
      return `
        <div class="aegis-brain-card">
          <div class="aegis-brain-label">SECURITY BRAIN</div>
          <div style="opacity:.55;font-size:13px">
            Security Brain is waiting for incident telemetry.
          </div>
        </div>
      `;
    }

    const incident = brain.incident || {};
    const situation = brain.situation || {};
    const response = brain.response || {};
    const shield = brain.shield || {};

    const score = Number(incident.risk_score || 0);
    const degrees = Math.min(score, 100) * 3.6;

    return `
      <section class="aegis-brain-command">

        <div class="aegis-brain-hero">

          <div>
            <div
              class="aegis-brain-ring"
              style="
                background:
                conic-gradient(
                  #ff9f0a 0deg,
                  #ff9f0a ${degrees}deg,
                  rgba(255,255,255,.08) ${degrees}deg,
                  rgba(255,255,255,.08) 360deg
                )
              "
            >
              <div class="aegis-brain-score">
                <strong>${esc(score)}</strong>
                <span>${esc(incident.risk_level)}</span>
              </div>
            </div>
          </div>

          <div>
            <div class="aegis-brain-kicker">
              AEGIS SECURITY BRAIN
            </div>

            <div class="aegis-brain-title">
              ${esc(String(incident.type || "SECURITY INCIDENT").replaceAll("_", " "))}
            </div>

            <div class="aegis-brain-subtitle">
              Autonomous evidence correlation and security-state reasoning.
            </div>

            <div class="aegis-brain-live">
              <i></i>
              INTELLIGENCE ENGINE ACTIVE
            </div>
          </div>

        </div>

        <div class="aegis-brain-grid">

          <div class="aegis-brain-stat">
            <span>THREAT</span>
            <strong>${esc(incident.risk_level)}</strong>
          </div>

          <div class="aegis-brain-stat">
            <span>ATTACK STAGE</span>
            <strong>${esc(situation.attack_stage)}</strong>
          </div>

          <div class="aegis-brain-stat">
            <span>EVENTS</span>
            <strong>${esc(situation.event_count)}</strong>
          </div>

          <div class="aegis-brain-stat">
            <span>ALERTS</span>
            <strong>${esc(situation.alert_count)}</strong>
          </div>

        </div>

        <div class="aegis-brain-card">

          <div class="aegis-brain-label">
            SECURITY ATTACK RECONSTRUCTION
          </div>

          <div class="aegis-brain-chain">
            ${chainHTML(brain)}
          </div>

        </div>

        <div class="aegis-brain-card">

          <div class="aegis-brain-label">
            EVIDENCE STATE
          </div>

          ${evidenceHTML(brain)}

        </div>

        <div class="aegis-brain-card">

          <div class="aegis-brain-label">
            SECURITY DECISION
          </div>

          <div class="aegis-brain-decision">

            <div>
              <strong>
                ${esc(response.recommended_action || "MONITOR")}
              </strong>

              <small>
                Risk policy decision for Incident #${esc(incident.id)}
              </small>
            </div>

            <div>
              <div class="aegis-brain-shield">
                ● ${esc(shield.state || "UNKNOWN")}
              </div>

              <small>
                ${esc(response.mode || "SIMULATION")}
              </small>
            </div>

          </div>

        </div>

        <div class="aegis-brain-card">

          <div class="aegis-brain-label">
            ANALYST ACTIONS
          </div>

          <div class="aegis-brain-evidence">
            ${(brain.analyst_actions || []).map(
              action => `
                <div class="aegis-brain-evidence-row">
                  <b>→ ${esc(action)}</b>
                </div>
              `
            ).join("")}
          </div>

        </div>

        <div class="aegis-brain-card">

          <div class="aegis-brain-label">
            INTELLIGENCE GAPS
          </div>

          ${unknownHTML(brain)}

        </div>

      </section>
    `;
  }

  async function mount() {
    const existing = document.getElementById(ROOT_ID);

    if (existing) return;

    const brain = await getBrain();

    const root = document.createElement("div");
    root.id = ROOT_ID;

    const target =
      document.querySelector("main") ||
      document.querySelector(".container") ||
      document.body;

    target.appendChild(root);

    root.innerHTML = render(brain);

    console.log("AEGIS SECURITY BRAIN COMMAND CENTER ACTIVE");
  }

  function loadCSS() {
    if (document.getElementById("aegis-brain-command-css")) return;

    const link = document.createElement("link");
    link.id = "aegis-brain-command-css";
    link.rel = "stylesheet";
    link.href = "/static/brain-command.css?v=1";

    document.head.appendChild(link);
  }

  loadCSS();

  setTimeout(mount, 800);

})();
