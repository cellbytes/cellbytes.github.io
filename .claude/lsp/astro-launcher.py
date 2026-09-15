#!/usr/bin/env python3
"""Start the Astro language server for whichever repo in the workspace holds it.

Unlike ty and tsgo, astro-ls talks to a push-only client unaided: it pushes real
diagnostics and asks the client nothing during startup. Two things still stand
between it and a plugin that works from any repo in the workspace.

It lives in one repo's node_modules, and in the unified container the active
plugin belongs to a different repo, so the server has to be found rather than
named by a fixed path. And it reports nothing at all - no error, just an empty
result for every file - unless it is told where the TypeScript library is, which
has to be an absolute path because `initializationOptions` is the one field the
client does not expand variables in.

So this launcher finds the server, points it at the TypeScript beside it, aims
the session at that repo, and then gets out of the way as a plain relay.
"""

import json
import os
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any

SERVER_NAME = "astro-ls"
RELAY_CHUNK_BYTES = 65536


def log(message: str) -> None:
    """Write a launcher diagnostic to stderr, where the LSP client collects it."""
    print(f"[astro-launcher] {message}", file=sys.stderr, flush=True)


def read_frame(stream: Any) -> dict[str, Any] | None:
    """Read one `Content-Length` framed JSON-RPC message, or None at EOF."""
    length = 0
    while True:
        line = stream.readline()
        if not line:
            return None
        if line in (b"\r\n", b"\n"):
            break
        name, _, value = line.decode("ascii", "replace").partition(":")
        if name.strip().lower() == "content-length":
            length = int(value.strip())
    if length == 0:
        return None
    body = b""
    while len(body) < length:
        chunk = stream.read(length - len(body))
        if not chunk:
            return None
        body += chunk
    return json.loads(body)


def write_frame(stream: Any, message: dict[str, Any]) -> None:
    body = json.dumps(message).encode()
    stream.write(b"Content-Length: %d\r\n\r\n%s" % (len(body), body))
    stream.flush()


def find_server(workspace: Path) -> Path:
    """Locate the astro-ls binary in the workspace or one of its sibling repos.

    The unified container mounts every repo as a sibling, and the plugin that
    starts this launcher belongs to the primary repo rather than to the Astro
    one, so the search has to reach outside the workspace folder.
    """
    override = os.environ.get("ASTRO_LS_BIN")
    if override:
        return Path(override)
    roots = [
        workspace,
        *sorted(workspace.glob("*")),
        *sorted(workspace.parent.glob("*")),
    ]
    seen = set()
    for root in roots:
        if root in seen or not root.is_dir():
            continue
        seen.add(root)
        candidate = root / "node_modules" / ".bin" / SERVER_NAME
        if candidate.is_file():
            return candidate
    found = shutil.which(SERVER_NAME)
    if found:
        return Path(found)
    message = f"no {SERVER_NAME} found in or beside {workspace}"
    raise RuntimeError(message)


def project_of(server: Path) -> Path:
    """Return the repo root that owns a node_modules/.bin/<server> path."""
    return server.parent.parent.parent


def initialize_params(params: dict[str, Any], project: Path) -> dict[str, Any]:
    """Aim the session at the Astro project and pin its TypeScript library.

    An existing tsdk is left alone so a caller can override the choice; without
    one the server silently reports nothing.
    """
    options = dict(params.get("initializationOptions") or {})
    typescript = dict(options.get("typescript") or {})
    typescript.setdefault("tsdk", str(project / "node_modules" / "typescript" / "lib"))
    options["typescript"] = typescript
    uri = project.as_uri()
    return {
        **params,
        "initializationOptions": options,
        "rootPath": str(project),
        "rootUri": uri,
        "workspaceFolders": [{"uri": uri, "name": project.name}],
    }


def relay(source: Any, sink: Any) -> None:
    """Copy bytes until the source ends, leaving the protocol untouched."""
    while True:
        chunk = (
            source.read1(RELAY_CHUNK_BYTES)
            if hasattr(source, "read1")
            else source.read(RELAY_CHUNK_BYTES)
        )
        if not chunk:
            return
        sink.write(chunk)
        sink.flush()


def main() -> None:
    stdin = sys.stdin.buffer
    initialize = read_frame(stdin)
    if initialize is None or initialize.get("method") != "initialize":
        message = "expected an initialize request first"
        raise RuntimeError(message)

    params = initialize.get("params") or {}
    workspace = Path(params.get("rootPath") or Path.cwd())
    server = find_server(workspace)
    project = project_of(server)
    log(f"workspace {workspace}, server {server}, project {project}")

    process = subprocess.Popen(
        [str(server), "--stdio"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=None,
        cwd=str(project),
    )
    write_frame(
        process.stdin, {**initialize, "params": initialize_params(params, project)}
    )

    threading.Thread(
        target=relay, args=(process.stdout, sys.stdout.buffer), daemon=True
    ).start()
    relay(stdin, process.stdin)
    process.terminate()


if __name__ == "__main__":
    main()
