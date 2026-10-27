# P5.22 — Local Dense retrieval candidate: bounded opt-in prototype

2026-10-27 KST · `hibi89/RAG_STUDIO` public synthetic developer-preview only.

## Technical status and decision

A narrowly scoped local-only Dense calculation and optional inference seam have been implemented in `src/local-dense.mjs`, with an untrained **test-only injected embedding function** that exercises real cosine ranking, source citations and BM25/Dense reciprocal-rank fusion. **There is no bundled, downloaded, tested or redistributed multilingual model**, no actual E5 ONNX forward-pass result and no demonstrated cross-lingual Recall improvement. No production API/knowledge-base selector has been changed. The local experimental CLI `scripts/p522-offline-dense-cli.mjs` explicitly falls back to existing BM25 unless operator-provisioned audited local weights and optional runtime exist. A synthetic embedding test does **not** validate trained-model semantics.

Original blueprint sought local BM25+FAISS hybrid, multilingual semantic RAG. P5.22 makes the **safe boundary runnable without a model**, but **FAISS, actual E5 inference/Windows 3-PC, independent natural-language gold, and production-trained semantic retrieval remain unverified**. Never mark these as complete.

### Model and runtime candidate (current official reference, not automatically approved artifact)

- Proposed upstream candidate: [intfloat/multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small), MIT model card, approximately 118M parameters, 384 embedding dimensions, 512-token training/truncation limit. The E5 training recipe requires asymmetric `query: ` and `passage: ` prefixes. This is upstream metadata, **not verification of any third-party ONNX conversion or its redistributability**.
- Node CPU platform possibility: [Microsoft ONNX Runtime Node prebuilt support](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) lists Windows x64 CPU binaries. [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js/api/env) documents `env.allowRemoteModels=false` and `env.localModelPath`. Model/runtime compatibility on this actual application and Windows is **not yet executed**. Optional `@huggingface/transformers` and `onnxruntime-node` are deliberately not added as required package dependencies. Do not treat an optional local inference adapter as a tested installer or confirmed model distribution.
- All ONNX files/tokenizer/model metadata must be obtained by the **operator separately and voluntarily**, checking upstream identity, conversion precision, binary checksums, full license obligations and commercial redistribution rights; no UI self-downloader, background fetch, weight package, token or payment. Any model conversion is subject to further source review. This project does not endorse an unverified community fork.

## Hard local-only preflight

`src/local-model-preflight.mjs` requires an **absolute directory ending in** `intfloat/multilingual-e5-small` for the CLI runtime, with `rag_model_manifest.json` and only supported local files. The manifest is **operator-supplied**, not signed upstream proof, with required exact attributes:

```json
{
  "model_id": "intfloat/multilingual-e5-small",
  "license": "mit",
  "dimension": 384,
  "dtype": "q8",
  "artifact_source": "https://huggingface.co/intfloat/multilingual-e5-small",
  "files": [
    {"name":"config.json","sha256":"<actual sha256 hex>","size":123},
    {"name":"tokenizer.json","sha256":"<actual sha256 hex>","size":456},
    {"name":"onnx/model_quantized.onnx","sha256":"<actual sha256 hex>","size":789}
  ]
}
```

Above values are **illustrative placeholders**, not a working manifest or verified weight hash. Only the verified local files in the list are permitted, nested items/undeclared assets/symlinks are rejected. Size <=800MiB over all declared assets, machine RAM reported >=4GiB, SHA-256 streamed over each. Missing/corrupted weights, runtime or failed inference return an **explicit BM25 fallback**; errors don't spill absolute local paths in the CLI JSON. No model is opened during baseline operation. SHA against a self-declared manifest does **not** independently authenticate the origin or license.

For developer-only smoke without model or optional runtime:

```bash
npm test
node scripts/p522-offline-dense-cli.mjs "/absolute/path/to/verified/AX_DATA_PACKAGE_V0" "반품 신청 기간?"
```

Expected JSON status `FALLBACK_BM25`, `fallback.actual=bm25_line_ngrams`, reason `LOCAL_MODEL_UNAVAILABLE`.

**Only after separately obtaining independently vetted compatible q8 ONNX/tokenizer files**, providing the signed-off manifest and installing optional compatible inference modules in a consciously provisioned test environment, a third argument selects local-experimental inference:

```bash
node scripts/p522-offline-dense-cli.mjs "/absolute/AX_DATA_PACKAGE_V0" "반품 신청 기간?" "/absolute/local-models/intfloat/multilingual-e5-small"
```

Requires optional Transformers.js and native ONNX CPU packages already installed. With local inference, `env.allowRemoteModels=false`, `local_files_only=true`, no FS cache, and `query:`/`passage:` prefixes are set. No network call is intentionally made by this application. Any missing runtime/model falls back; **actual native runtime behavior, offline dependency asset resolution and model inference have not been integration-tested**. Do not use it on customer data before independent validation.

## Confidence and safety constraints

- `src/local-dense.mjs` verifies the full `AX_DATA_PACKAGE_V0` source package SHA before calling the embedding function, applies exact approved TXT/MD manifest document ID allowlist, maximum **768 nonempty source lines**, query length <=500 and output <=10 source-linked cited lines. Source line provenance is 1-based and includes file/document IDs; no arbitrary SQL or prompt execution. Dense and optional RRF candidate results are **`CANDIDATES_ONLY` with `answer:null`**, not factual policy assertions.
- A dynamically loaded source/model can still have runtime/model behavior or prompt-injection risks; this experiment does not create a production authorization/security warranty. `rag_model_manifest.json` is operator-declared integrity metadata, not a cryptographic upstream signature.
- `fallbackToBM25` returns both the actual base search mode and explicit requested model/missing reason; doesn't silently relabel BM25 output as Dense.
- Public `.gitignore` protects conventional `models/`, `local-models/`, `.cache/`, raw `.onnx`/`.safetensors` weights from accidental version control; it is **not** a secrets scanner or legal compliance guarantee.

## Validation evidence

[GitHub Actions #40501134514](https://github.com/hibi89/RAG_STUDIO/actions/runs/40501134514), source/workflow SHA `cec8c268bf0479c4e6f118ead139750430cdaaa7`, Ubuntu 24.04 Node22.16.0: `npm test` **389 pass / 0 fail / 0 skip**, `npm run doctor`, `test:gold`, `test:negative`, `test:heldout` PASS. Real no-model CLI launched and returned `FALLBACK_BM25`, with correct original source lines and `LOCAL_MODEL_UNAVAILABLE`. Ten Node tests cover synthetic vector geometry and retrieval provenance, RRF mode, explicit fallback, invalid NaN/zero/wrong-dimension embeddings, bounded document selection, source tampering before embedder, nonexistent/incorrect local model hash and all-model-file allowlisting including unlisted/symlink artifacts. **These do not include actual E5 runtime inference, model download, Windows hardware performance or cross-lingual benchmark with pretrained weights**.

## Next acceptance gates before product feature

1. Vet a specific quantized E5 model **artifact repository**, revision/commit, weight SHA-256 and redistribution license; verify tokenizer/quantization and CPU Node runtime on genuine Windows hardware, without a hidden CDN dependency.
2. Exercise actual pretrained vectors with the P5.21 bilingual 120-positive/12-negative set and P5.20 scale corpus. Measure honest Recall@1/3 and false positives vs BM25 and lexical RRF, CPU latency, peak RAM, disk, token truncation, model initialization.
3. Use independently adjudicated KR/EN examples, real authorized doc formats, fail-closed no-model deployment mode, three Windows devices, local installation/recovery/upgrade and security audit. Only then consider UI support and stronger index, such as FAISS. Do not promote `main` until product gates clear.

