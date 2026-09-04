"""SSH helper for remote deployment using the system OpenSSH client.

Usage:
  python ssh_helper.py exec "command"
  python ssh_helper.py upload <local> <remote>

Required environment:
  DEPLOY_HOST

Authentication uses DEPLOY_KEY_FILE or the local SSH agent. Set
DEPLOY_ACCEPT_NEW_HOST_KEY=true only after verifying the server fingerprint.
"""

import os
import shlex
import subprocess
import sys
from pathlib import Path


HOST = os.environ.get("DEPLOY_HOST", "").strip()
USER = os.environ.get("DEPLOY_USER", "root").strip() or "root"
PORT = os.environ.get("DEPLOY_PORT", "22").strip() or "22"
KEY_FILE = os.path.expanduser(os.environ.get("DEPLOY_KEY_FILE", "").strip())
ACCEPT_NEW_HOST_KEY = os.environ.get("DEPLOY_ACCEPT_NEW_HOST_KEY", "").lower() in {
    "1",
    "true",
    "yes",
}


def validate_config() -> None:
    if not HOST:
        raise SystemExit("DEPLOY_HOST env var is required")
    if os.environ.get("DEPLOY_PASSWORD"):
        raise SystemExit(
            "DEPLOY_PASSWORD is not supported; use DEPLOY_KEY_FILE or an SSH agent"
        )
    try:
        port = int(PORT)
    except ValueError as error:
        raise SystemExit("DEPLOY_PORT must be an integer") from error
    if not 1 <= port <= 65535:
        raise SystemExit("DEPLOY_PORT must be between 1 and 65535")
    if KEY_FILE and not Path(KEY_FILE).is_file():
        raise SystemExit(f"DEPLOY_KEY_FILE does not exist: {KEY_FILE}")


def common_options() -> list[str]:
    options = [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=30",
        "-o",
        (
            "StrictHostKeyChecking=accept-new"
            if ACCEPT_NEW_HOST_KEY
            else "StrictHostKeyChecking=yes"
        ),
    ]
    if KEY_FILE:
        options.extend(["-i", KEY_FILE])
    return options


def build_ssh_command(command: str) -> list[str]:
    validate_config()
    return [
        "ssh",
        *common_options(),
        "-p",
        PORT,
        "--",
        f"{USER}@{HOST}",
        command,
    ]


def run_exec(command: str) -> int:
    return subprocess.run(build_ssh_command(command), check=False).returncode


def upload(local: str, remote: str) -> None:
    validate_config()
    local_path = Path(local)
    if not local_path.exists():
        raise SystemExit(f"no such path: {local}")

    command = ["scp", *common_options(), "-P", PORT]
    if local_path.is_dir():
        command.append("-r")
    command.extend(
        [
            "--",
            str(local_path),
            f"{USER}@{HOST}:{shlex.quote(remote)}",
        ]
    )
    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    print(f"uploaded: {local} -> {remote}")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)

    command = sys.argv[1]
    if command == "exec":
        if len(sys.argv) < 3:
            raise SystemExit("usage: exec <command>")
        raise SystemExit(run_exec(sys.argv[2]))
    if command == "upload":
        if len(sys.argv) < 4:
            raise SystemExit("usage: upload <local> <remote>")
        upload(sys.argv[2], sys.argv[3])
        return
    raise SystemExit(f"unknown command: {command}")


if __name__ == "__main__":
    main()
