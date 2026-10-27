# P5.23 — Published E5 artifact hash lock (offline, opt-in)

2026-10-27 KST. Base develop `ebef7b59aaae16dc0ff063c076c2236feb7517d2`.

## What changed

The P5.22 CLI used only the upstream `intfloat/multilingual-e5-small` local directory, even though the independently identified Transformers.js-compatible 118 MB quantized ONNX artifact is published under `Xenova/multilingual-e5-small`. This mismatch blocked the intended candidate path. P5.23 preserves the original `intfloat` dev path, and adds a separate **explicitly selected** `Xenova` profile, selected by the exact local parent directory. No existing BM25 route or dashboard behavior is changed.

The new `verifyPublishedXenovaManifest` checks that the operator-supplied manifest claims the published Xenova model ID, model source, 384 dims/q8 and has weight and tokenizer entries exactly matching independent published SHA-256 and byte sizes. The filesystem verifier then independently streams real local file SHA-256, with the same size budget and symlink/unknown-file restrictions from P5.22. No model weights are bundled/downloaded, no optional runtime is installed. The pure-manifest tests **do not** count as a real weight verification, nor as an actual model inference.

| Source artifact | Published bytes | Published SHA-256 |
| --- | ---: | --- |
| `onnx/model_quantized.onnx` | 118308185 | `f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193` |
| `tokenizer.json` | 17082730 | `0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39` |
| `sentencepiece.bpe.model` (if present) | 5069051 | `cfc8146abe2a0488e9e2a0c56de7952f7c11ab059eca145a0a727afce0db2865` |

Sources: https://huggingface.co/Xenova/multilingual-e5-small/blob/main/onnx/model_quantized.onnx ; https://huggingface.co/Xenova/multilingual-e5-small/blob/main/tokenizer.json ; https://huggingface.co/Xenova/multilingual-e5-small/blame/main/sentencepiece.bpe.model ; model version is NOT pinned yet to a full verified upstream commit ID. **Other auxiliary files have only operator-declared checksums**, so do not call this a complete authenticated bundle or sign-off. The `MIT` manifest string is operator-claimed metadata, **not independent licensing/redistribution clearance**.

## Acceptance / limits

1. `npm test` must pass all pre-existing tests plus five new synthetic provenance-gate tests.
2. No-model CLI continues to report `FALLBACK_BM25`; the trained embedding model is **not tested**, even when the manifest-shaped positive test passes.
3. Optional real `Xenova/multilingual-e5-small` files can be supplied in the same folder layout with the exact manifest/file values, but inference is **not certified** until an actual byte-level verification and offline E5/Transformers.js/ONNX CPU run with genuine weights succeeds, followed by independent bilingual gold evaluation and Windows 3-PC QA.
4. No installation, sale, `main` promotion, model download, network dependency, remote data transfer, or Private SMAX edits in this change.

Run `node --test tests/p523-model-lock.test.mjs` for the narrow suite, or `npm test` for full regression. The existing script `node scripts/p522-offline-dense-cli.mjs <ABS_PACKAGE_ROOT> <QUESTION> [ABS_MODEL_ROOT]` opts in via the published Xenova folder. Model files still need separate explicit provisioning and redistribution permission review.
