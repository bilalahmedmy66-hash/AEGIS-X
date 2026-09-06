const $=id=>document.getElementById(id);
const api=async(path,options={})=>{const r=await fetch(path,options);let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.detail||`HTTP ${r.status}`);return d};
const esc=v=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const time=v=>v?new Date(v).toLocaleString():"—";
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)};
async function setIncident(id,status){try{await api(`/api/v1/incidents/${id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(status)});toast(`Incident #${id} → ${status}`);load()}catch(e){toast(e.message)}}
async function respond(id){try{const d=await api(`/api/v1/incidents/${id}/response`,{method:"POST"});toast(`Response ${d.execution.action} simulated`);load()}catch(e){toast(e.message)}}
async function load(){
  try{
    const [health,events,alerts,incidents,responses,detections]=await Promise.all([
      api("/health"),api("/api/v1/events"),api("/api/v1/alerts"),api("/api/v1/incidents"),api("/api/v1/responses"),api("/api/v1/detections")
    ]);
    $("healthText").textContent=health.status==="healthy"?"Operational":"Degraded";
    $("eventsCount").textContent=events.total;
    const active=alerts.alerts.filter(a=>a.status!=="RESOLVED");$("activeAlerts").textContent=active.length;
    const open=incidents.incidents.filter(i=>i.status!=="RESOLVED");$("openIncidents").textContent=open.length;
    $("highestRisk").textContent=open.length?Math.max(...open.map(i=>i.risk_score)):"0";
    $("detectionTag").textContent=`${detections.alerts_generated} detected`;
    $("lastUpdated").textContent=`Updated ${new Date().toLocaleTimeString()}`;

    $("detections").innerHTML=detections.alerts.length?detections.alerts.map(a=>`<div class="detection"><div class="rowline"><span class="type">${esc(a.type)}</span><span class="risk ${esc(a.severity)}">${esc(a.risk?.level)} · ${esc(a.risk?.score)}</span></div><div class="meta">${esc(a.source_ip)} · ${esc(a.message)}</div><div class="meta">Response: ${esc(a.response?.action)} · ${esc(a.response?.mode)}</div></div>`).join(""):`<div class="empty">No detections.</div>`;

    $("responses").innerHTML=responses.responses.length?responses.responses.slice(0,8).map(r=>`<div class="activity"><div class="rowline"><strong>${esc(r.action)}</strong><span class="status">${esc(r.status)}</span></div><small>Incident #${esc(r.incident_id)} · ${esc(r.source_ip)} · ${time(r.executed_at)}</small></div>`).join(""):`<div class="empty">No response actions recorded.</div>`;

    $("incidentRows").innerHTML=incidents.incidents.length?incidents.incidents.map(i=>`<tr><td>#${i.id}</td><td>${esc(i.incident_type)}</td><td>${esc(i.source_ip)}</td><td><b class="risk ${esc(i.risk_level)}">${i.risk_score}</b> ${esc(i.risk_level)}</td><td><span class="status ${esc(i.status)}">${esc(i.status)}</span></td><td>${time(i.last_seen)}</td><td>${i.status!=="RESOLVED"?`<button class="action-btn" onclick="respond(${i.id})">Simulate response</button> ${i.status==="OPEN"?`<button class="action-btn" onclick="setIncident(${i.id},'ACKNOWLEDGED')">Acknowledge</button>`:`<button class="action-btn" onclick="setIncident(${i.id},'RESOLVED')">Resolve</button>`}`:"—"}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">No incidents.</td></tr>`;

    $("alertRows").innerHTML=alerts.alerts.map(a=>`<tr><td>#${a.id}</td><td>${esc(a.alert_type)}</td><td class="risk ${esc(a.severity)}">${esc(a.severity)}</td><td>${a.risk_score} · ${esc(a.risk_level)}</td><td>${esc(a.source_ip)}</td><td><span class="status">${esc(a.status)}</span></td><td>${time(a.created_at)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">No alerts.</td></tr>`;

    $("eventRows").innerHTML=events.events.slice(0,30).map(e=>`<tr><td>#${e.id}</td><td>${esc(e.event_type)}</td><td>${esc(e.source)}</td><td>${esc(e.source_ip)}</td><td>${e.severity}</td><td>${esc(e.description)}</td><td>${time(e.timestamp)}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">No events.</td></tr>`;
  }catch(e){$("healthText").textContent="Unavailable";toast(e.message)}
}
$("refreshBtn").addEventListener("click",load);load();setInterval(load,15000);