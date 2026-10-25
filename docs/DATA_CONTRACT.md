# AX_DATA_PACKAGE_V0 — Public contract (P0 phase)
The synthetic sample in fixtures/ax_sample_v0 is not customer data.
This v0 shape defines relative file paths, SHA-256, byte sizes, import/review states, dataset columns, original row provenance, document source references and processing counts.
Producer (SMAX private) handshake is not yet verified.
Do not treat schema validation alone as security: the Node consumer must additionally check .. segments, absolute/Windows paths, symlinks, duplicate IDs/paths, digest/size, cross references, review status, arithmetic and source lines.
P0 local reference implementation (including 16 passing tests on Node 22) was built in an isolated environment; its source is not yet part of this remote commit. Keep code-related status NOT REMOTE VERIFIED until the source and tests are separately committed and executed.
Next: transfer tested reader, aggregator, CLI and regression tests from controlled artifact; then verify exact remote sources before develop merge.
