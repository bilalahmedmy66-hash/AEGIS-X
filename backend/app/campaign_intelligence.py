from typing import Any

from backend.app.correlation import build_source_correlation
from backend.app.attack_chain import build_attack_chain
from backend.app.graph import build_security_graph


def _build_campaign_story(campaign: dict[str, Any]) -> list[str]:
    source_ip = campaign.get("source_ip")
    classification = campaign.get("classification")
    risk_score = campaign.get("risk_score")
    risk_level = campaign.get("risk_level")

    detection_types = campaign.get(
        "detection_types",
        [],
    )

    progression = campaign.get(
        "attack_progression",
        [],
    )

    incidents = campaign.get(
        "incidents",
        [],
    )

    story = []

    story.append(
        f"AEGIS X correlated {len(incidents)} incident(s) "
        f"associated with source IP {source_ip}."
    )

    if detection_types:
        story.append(
            "The campaign contains the following detection "
            f"signals: {', '.join(detection_types)}."
        )

    if progression:
        story.append(
            "Observed attack progression: "
            f"{' -> '.join(progression)}."
        )

    story.append(
        f"Campaign classification: {classification}."
    )

    story.append(
        f"Campaign risk is {risk_score} ({risk_level})."
    )

    if campaign.get("status"):
        story.append(
            f"Campaign status is {campaign['status']}."
        )

    return story


def build_campaign_intelligence(
    source_ip: str,
):
    correlation = build_source_correlation(source_ip)

    campaigns = correlation.get("campaigns", [])

    if not campaigns:
        return None

    campaign = campaigns[0]

    incidents = campaign.get("incidents", [])

    attack_chains = []
    security_graphs = []

    for incident in incidents:
        incident_id = incident.get("id")

        if incident_id is None:
            continue

        attack_chain = build_attack_chain(
            int(incident_id)
        )

        if attack_chain:
            attack_chains.append(
                attack_chain
            )

        security_graph = build_security_graph(
            int(incident_id)
        )

        if security_graph:
            security_graphs.append(
                security_graph
            )

    graph_node_count = sum(
        int(graph.get("graph", {}).get("node_count", 0))
        for graph in security_graphs
    )

    graph_edge_count = sum(
        int(graph.get("graph", {}).get("edge_count", 0))
        for graph in security_graphs
    )

    unique_graph_nodes = {}
    unique_graph_edges = set()

    for graph in security_graphs:
        graph_data = graph.get("graph", {})

        for node in graph_data.get("nodes", []):
            node_id = node.get("id")

            if node_id:
                unique_graph_nodes[node_id] = node

        for edge in graph_data.get("edges", []):
            source = edge.get("source")
            target = edge.get("target")

            if source and target:
                unique_graph_edges.add(
                    (source, target)
                )

    # =========================================================
    # CAMPAIGN-LEVEL INCIDENT SEQUENCE
    # =========================================================

    ordered_incidents = sorted(
        incidents,
        key=lambda item: (
            item.get("first_seen") or "",
            int(item.get("id", 0)),
        ),
    )

    for previous_incident, next_incident in zip(
        ordered_incidents,
        ordered_incidents[1:],
    ):
        previous_id = previous_incident.get("id")
        next_id = next_incident.get("id")

        if previous_id is None or next_id is None:
            continue

        previous_node = f"incident:{previous_id}"
        next_node = f"incident:{next_id}"

        if (
            previous_node in unique_graph_nodes
            and next_node in unique_graph_nodes
        ):
            unique_graph_edges.add(
                (
                    previous_node,
                    next_node,
                )
            )

    unified_progression = []

    for stage in campaign.get(
        "attack_progression",
        [],
    ):
        if stage not in unified_progression:
            unified_progression.append(stage)

    return {
        "campaign_intelligence": {
            "engine": (
                "AEGIS X Campaign Intelligence Engine"
            ),
            "version": "1.0",
            "mode": "local_explainable",
            "source_ip": source_ip,
            "campaign_id": campaign.get(
                "campaign_id"
            ),
        },

        "campaign": campaign,

        "threat_assessment": {
            "classification": campaign.get(
                "classification"
            ),
            "risk_score": campaign.get(
                "risk_score"
            ),
            "risk_level": campaign.get(
                "risk_level"
            ),
            "status": campaign.get(
                "status"
            ),
            "confidence": min(
                95,
                60
                + (
                    len(campaign.get(
                        "detection_types",
                        [],
                    ))
                    * 10
                )
                + (
                    len(incidents)
                    * 5
                ),
            ),
        },

        "attack_story": {
            "classification": campaign.get(
                "classification"
            ),
            "progression": unified_progression,
            "narrative": _build_campaign_story(
                campaign
            ),
        },

        "detections": {
            "count": campaign.get(
                "detection_count",
                0,
            ),
            "types": campaign.get(
                "detection_types",
                [],
            ),
        },

        "incidents": {
            "count": len(incidents),
            "items": incidents,
        },

        "attack_chains": {
            "count": len(attack_chains),
            "items": attack_chains,
        },

        "security_graph": {
            "incident_graphs": len(
                security_graphs
            ),
            "node_count": len(
                unique_graph_nodes
            ),
            "edge_count": len(
                unique_graph_edges
            ),
            "raw_node_count": graph_node_count,
            "raw_edge_count": graph_edge_count,
            "nodes": list(
                unique_graph_nodes.values()
            ),
            "edges": [
                {
                    "source": source,
                    "target": target,
                }
                for source, target
                in unique_graph_edges
            ],
        },

        "analysis": {
            "incident_count": len(
                incidents
            ),
            "attack_chain_count": len(
                attack_chains
            ),
            "security_graph_count": len(
                security_graphs
            ),
            "unique_graph_nodes": len(
                unique_graph_nodes
            ),
            "unique_graph_edges": len(
                unique_graph_edges
            ),
        },
    }

