Zeker. Hieronder krijg je README-ready voorbeelden: invoer → scope → gate-reactie (PASS / PASS_WITH_TRANSPARENCY / ESCALATE / BLOCK) + FAIL (technische fout / ongeldige input).

Je kunt dit 1-op-1 in README.md plakken.

⸻

TaoGate EU AI Act — quick demo

Begrippen
	•	PASS: toegestaan, geen extra verplichting.
	•	PASS_WITH_TRANSPARENCY: toegestaan, maar vereist disclosure/label.
	•	ESCALATE_HUMAN / ESCALATE_REGULATORY: menselijk mandaat vereist vóór door.
	•	BLOCK: verboden/stop (alleen legal override of expliciete human resolve volgens jullie protocol).
	•	FAIL: systeemfout of ongeldige input (niet-policy). Altijd “stop”, maar met reden INVALID_INPUT / INTERNAL_ERROR.

⸻

Input schema (minimal)

JSON payload (wat je UI/agent instuurt):

{
  "system_type": "ai_system",
  "deployment_domain": "healthcare",
  "affects_fundamental_rights": true,
  "uses_biometric_identification": "none",
  "processes_special_category_data": true,
  "autonomous_decision_making": "automated",
  "critical_infrastructure_dependency": false,
  "vulnerable_group_targeting": false
}


⸻

Output schema (minimal)

Gate response:

{
  "scope": "EU_AI_HIGH_RISK",
  "decision": "ESCALATE_HUMAN",
  "regulatory_level": "HIGH_RISK",
  "required_checks": [
    "risk_management_system",
    "conformity_assessment",
    "technical_documentation",
    "registration"
  ],
  "mechanica": {
    "druk": "high",
    "resonantie": "conditional"
  },
  "reason": "Annex-III domain or FR-impact trigger matched."
}


⸻

CLI voorbeelden (als je een taogate_cli.py hebt)

1) Minimal risk → PASS

Input

{
  "system_type": "ai_system",
  "deployment_domain": "consumer",
  "affects_fundamental_rights": false,
  "uses_biometric_identification": "none",
  "processes_special_category_data": false,
  "autonomous_decision_making": "none",
  "critical_infrastructure_dependency": false,
  "vulnerable_group_targeting": false
}

Output

{
  "scope": "EU_AI_MINIMAL",
  "decision": "PASS",
  "mechanica": { "druk": "minimal", "resonantie": "neutral" },
  "reason": "No high-risk or transparency triggers matched."
}


⸻

2) Limited risk → PASS_WITH_TRANSPARENCY

Input

{
  "system_type": "ai_system",
  "deployment_domain": "consumer",
  "affects_fundamental_rights": false,
  "uses_biometric_identification": "none",
  "processes_special_category_data": false,
  "autonomous_decision_making": "assisted",
  "critical_infrastructure_dependency": false,
  "vulnerable_group_targeting": false
}

Output

{
  "scope": "EU_AI_LIMITED_RISK",
  "decision": "PASS_WITH_TRANSPARENCY",
  "required_checks": ["transparency_notice"],
  "mechanica": { "druk": "low", "resonantie": "informational" },
  "reason": "Assisted decision-making trigger matched."
}


⸻

3) High risk → ESCALATE_HUMAN

Input

{
  "system_type": "ai_system",
  "deployment_domain": "employment",
  "affects_fundamental_rights": true,
  "uses_biometric_identification": "none",
  "processes_special_category_data": false,
  "autonomous_decision_making": "automated",
  "critical_infrastructure_dependency": false,
  "vulnerable_group_targeting": false
}

Output

{
  "scope": "EU_AI_HIGH_RISK",
  "decision": "ESCALATE_HUMAN",
  "required_checks": [
    "risk_management_system",
    "conformity_assessment",
    "technical_documentation",
    "registration"
  ],
  "mechanica": { "druk": "high", "resonantie": "conditional" },
  "reason": "Annex-III domain trigger matched."
}


⸻

4) GPAI → ESCALATE_REGULATORY

Input

{
  "system_type": "gpai",
  "deployment_domain": "other",
  "affects_fundamental_rights": false,
  "uses_biometric_identification": "none",
  "processes_special_category_data": false,
  "autonomous_decision_making": "assisted",
  "critical_infrastructure_dependency": false,
  "vulnerable_group_targeting": false
}

Output

{
  "scope": "EU_AI_GPAI",
  "decision": "ESCALATE_REGULATORY",
  "required_checks": ["model_documentation", "systemic_risk_assessment"],
  "mechanica": { "druk": "variable", "resonantie": "systemic" },
  "reason": "GPAI trigger matched."
}


⸻

5) Prohibited → BLOCK

Input

{
  "system_type": "ai_system",
  "deployment_domain": "public_admin",
  "affects_fundamental_rights": true,
  "uses_biometric_identification": "real_time",
  "processes_special_category_data": true,
  "autonomous_decision_making": "automated",
  "critical_infrastructure_dependency": false,
  "vulnerable_group_targeting": false
}

Output

{
  "scope": "EU_AI_PROHIBITED",
  "decision": "BLOCK",
  "regulatory_level": "UNACCEPTABLE_RISK",
  "escalation": "LEGAL_ONLY",
  "mechanica": { "druk": "infinite", "resonantie": "forbidden" },
  "reason": "Real-time biometric identification trigger matched."
}


⸻

FAIL cases (hard stop, maar géén policy)

A) Missing required field → FAIL / INVALID_INPUT

Input

{
  "system_type": "ai_system",
  "deployment_domain": "healthcare"
}

Output

{
  "decision": "FAIL",
  "error_type": "INVALID_INPUT",
  "missing_fields": [
    "affects_fundamental_rights",
    "uses_biometric_identification",
    "processes_special_category_data",
    "autonomous_decision_making",
    "critical_infrastructure_dependency",
    "vulnerable_group_targeting"
  ]
}

B) Unknown enum value → FAIL / INVALID_ENUM

Input

{
  "system_type": "ai_system",
  "deployment_domain": "healthcare",
  "affects_fundamental_rights": true,
  "uses_biometric_identification": "live_now",
  "processes_special_category_data": true,
  "autonomous_decision_making": "automated",
  "critical_infrastructure_dependency": false,
  "vulnerable_group_targeting": false
}

Output

{
  "decision": "FAIL",
  "error_type": "INVALID_ENUM",
  "field": "uses_biometric_identification",
  "allowed": ["none", "post", "real_time"]
}


⸻

Mini “contract” voor jouw UI
	•	UI toont BLOCK (rood) alleen als decision == "BLOCK".
	•	UI toont ESCALATE (oranje) bij decision.startswith("ESCALATE").
	•	UI toont FAIL (grijs/zwart) bij decision == "FAIL" en geeft error detail terug.
	•	Audit log altijd: input_hash, scope, decision, reason/error_type.

⸻

Als je wil, maak ik dit ook als README_EU_AI_ACT_SCOPE.md bestand (kant-en-klaar) + een examples/ mapstructuur (json input files + expected outputs) zodat Replit Agent meteen tests kan draaien.