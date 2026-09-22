# AEGIS SHIELD

AEGIS SHIELD is the continuous security protection and integrity layer
introduced into the AEGIS X academic prototype.

## Capabilities

- Software-layer integrity verification
- SHA-256 verification of selected AEGIS components
- Protection-state evaluation
- Response policy guarding
- Shield Center dashboard
- Academic safe mode
- Simulation-only response controls

## Protection states

- PROTECTED
- ELEVATED
- LOCKDOWN_SIMULATION

## Important scope

AEGIS SHIELD is a software-layer academic prototype.

It does NOT claim to provide:

- hardware-backed security
- Secure Enclave functionality
- Samsung Knox-level platform security
- secure boot
- kernel-level anti-tamper protection
- real network blocking
- real endpoint isolation

Those capabilities require operating-system, hardware and platform-level integration.

## API

GET /api/v1/shield/status

GET /api/v1/shield/integrity

POST /api/v1/shield/guard

Example:

{
  "action": "BLOCK_SOURCE",
  "risk_score": 60
}

The response guard remains simulation-only.
