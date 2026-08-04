# AGENTS.md

## Cursor Cloud specific instructions

This is the 2023 "Forge-era" AutoGPT monorepo. The primary runnable product for
this environment is the **Forge agent** in `autogpts/forge`, which serves both the
Agent Protocol REST API and the prebuilt Flutter web UI on port 8000.

### Environment facts (already provisioned in the VM snapshot)
- Python **3.11** is installed at `/usr/bin/python3.11` (the repo's 2023-era deps —
  `openai` 0.27, pydantic v1, `chromadb`, `tiktoken` 0.3, `spacy` — are not
  compatible with the VM's default Python 3.12, so always use 3.11).
- **Poetry** is installed at `~/.local/bin/poetry` (added to `PATH` in `~/.bashrc`).
- The Forge Poetry virtualenv is bound to Python 3.11. The update script runs
  `poetry install --no-root` in `autogpts/forge` on startup.

### Running the Forge agent (the "application")
- Start it with the repo's own script: from `autogpts/forge`, run `./run`.
  - `./run` kills anything on port 8000, copies `.env.example` → `.env` if missing
    (which sets a placeholder `OPENAI_API_KEY=abc`), then runs `poetry run python -m forge`.
- Server: `http://localhost:8000` — Agent Protocol under `/ap/v1/agent/...`, Flutter
  UI mounted at `/app` (served from the prebuilt `frontend/build/web`, so Flutter/Dart
  is NOT needed to run the UI).
- Stop it from the repo root with `./run agent stop` (kills ports 8000/8080).

### Non-obvious caveats
- **The default `ForgeAgent.execute_step` is a hardcoded stub** (`autogpts/forge/forge/agent.py`):
  it ignores the task input, writes `"Washington D.C"` to `output.txt`, and returns
  that as the step output. So the agent runs end-to-end with **no real LLM key** — a
  real `OPENAI_API_KEY` is only needed once you implement real LLM-driven steps.
- The step's `output` field is set in-memory on the returned object but is NOT
  persisted to the DB, so `GET .../steps` shows `"output": null`. The real result is
  the generated artifact file (`output.txt`) in
  `autogpts/forge/agbenchmark_config/workspace/<task_id>/`.
- The **Flutter UI (`/app`) is gated by a third-party Firebase Google/GitHub login**
  (`prod-auto-gpt`, hardcoded in `frontend/lib/main.dart`, no bypass flag). You cannot
  get past the login screen without external OAuth credentials. Test/demonstrate the
  product through the Agent Protocol API instead (the UI is just one client of it):
  ```
  curl -X POST localhost:8000/ap/v1/agent/tasks -H 'Content-Type: application/json' -d '{"input":"..."}'
  curl -X POST localhost:8000/ap/v1/agent/tasks/<task_id>/steps -H 'Content-Type: application/json' -d '{"input":""}'
  curl localhost:8000/ap/v1/agent/tasks/<task_id>/artifacts
  ```
- `GET /openapi.json` returns HTTP 500 (agent-protocol schema quirk), so the Swagger
  UI at `/docs` loads but cannot render endpoints. Use `curl` against `/ap/v1/...`.

### Lint / test / run commands (Forge)
Run these from `autogpts/forge`:
- Lint: `poetry run flake8 forge` (pre-existing `W293` whitespace warnings in
  `forge/__main__.py` are not yours to fix).
- Tests: `poetry run python -m pytest forge --import-mode=importlib`.
  - The `--import-mode=importlib` flag is REQUIRED. There is an empty
    `autogpts/forge/__init__.py` that makes pytest's default import mode misresolve
    the `forge` package and fail collection with `ModuleNotFoundError: No module named 'forge.sdk'`.
  - Several tests fail/​error on `master` (e.g. `PosixPath.startswith`, `StepInput`
    NameError, abstract memstore) — these are pre-existing bugs on this
    "under heavy development" branch, not environment problems.

### Other components (not set up here)
- `autogpts/autogpt` — the heavier flagship agent. It lacks the `run`/`setup`/
  `run_benchmark` scripts that `./run agent start` expects in this checkout, so it is
  not runnable via the standard flow. Its `pyproject.toml` also pulls heavier deps
  (spacy model download, selenium, playsound). Not part of this environment setup.
- `benchmark` (agbenchmark) — installed as a path dependency of Forge; run challenges
  against a running agent with `./run benchmark start <agent>`.
- `benchmark/frontend` — a separate Next.js results viewer (`npm install && npm run dev`),
  not part of this setup.
