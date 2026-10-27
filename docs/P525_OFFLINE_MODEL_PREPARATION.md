# P5.25 — Offline provisioning bridge: public pinned hashes → reproducible local model manifest

2026-10-27 KST. Baseline develop `9a95f88a522fcfa1f6b690a6e34ace06de901377`.

**Problem:** P5.22-P5.24 offer strict local-only verification and a 132-question bilingual benchmark but require a hand-built `rag_model_manifest.json` before genuine weights can be run. Manually entering >100 MB file size/hash values is error-prone, and the wrong model profile can look valid without true byte checks.

**Design choice (no owner input needed):**
- **A. Auto downloader/installer:** faster first launch but adds 100+ MB network, terms/license, supply chain, consent and repeat billing/security surface. **Deferred pending authorization.**
- **B. Local readonly inspector + separately requested exclusive manifest creation (chosen):** no network/payment/dependency/change to original weights; predictable SHA-256 streaming and pinned-core integrity; slower once because an operator must separately prepare genuine files, acceptable for developer validation.

**Supported exact version:** `Xenova/multilingual-e5-small` revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`. Required local `config.json`, `tokenizer.json`, `onnx/model_quantized.onnx`; optionally `tokenizer_config.json`, `special_tokens_map.json`, `quant_config.json`, `sentencepiece.bpe.model`, `sentence_bert_config.json`. A maximal 800MiB and 8-file declaration. Independently hardcoded q8 ONNX/tokenizer and optional SentencePiece SHA/byte lengths; all other files are locally hashed by the operator, not independently pinned to the remote commit. Claiming a pinned revision is **not equivalent** to authenticating each auxiliary file or reviewing downstream model/commercial terms.

Safe developer commands after externally provisioning authentic files into an exact local folder:
```bash
node scripts/p525-prepare-local-model.mjs /absolute/local-models/Xenova/multilingual-e5-small
# dry run; no files created
node scripts/p525-prepare-local-model.mjs /absolute/local-models/Xenova/multilingual-e5-small --write
# explicit creation only: refuses overwriting, checks the created manifest again
node scripts/p524-offline-e5-eval.mjs /absolute/local-models/Xenova/multilingual-e5-small
```

The helper never downloads anything, never overwrites an existing manifest, never modifies a weight, refuses unexpected files/symlinks, uses 1 MiB chunk hashing and exclusive write `wx`, and verifies every listed source checksum a second time after writing the manifest. On failure, its CLI emits a fixed sanitized error (no file paths). It will not pass with fake/synthetic ONNX bytes. **No real model weights/runtime have been downloaded or executed**. The test suite covers dry-run negatives and pure published-core manifest assembly, not a real full positive model folder, which is blocked until genuine assets are available.

Commercial packaging/legal model license review, independent full-tree upstream signature provenance, Windows native runtime, multi-PC installer testing, and model-backed 132-question Recall/false-positive/CPU/RSS remain **open release gates**. No `main` promotion, private repo changes or production service deploy in this unit.

Sources: <https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78> and existing `docs/P523_PUBLISHED_E5_ARTIFACT_LOCK.md`, `docs/P524_IMMUTABLE_E5_OFFLINE_EVAL.md`.
