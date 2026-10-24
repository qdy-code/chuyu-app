"""Upload a local file through an SSH pipe when SCP/SFTP is unavailable.

Usage: python upload_pipe.py <local> <remote>

Connection settings are shared with ssh_helper.py.
"""

import os
import shlex
import subprocess
import sys
from pathlib import Path

from ssh_helper import build_ssh_command


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("usage: upload_pipe.py <local> <remote>")

    local_path = Path(sys.argv[1])
    remote = sys.argv[2]
    if not local_path.is_file():
        raise SystemExit(f"no such file: {local_path}")

    size = os.path.getsize(local_path)
    print(f"uploading {size} bytes to {remote}...")
    command = build_ssh_command(f"cat > {shlex.quote(remote)}")
    with local_path.open("rb") as source:
        result = subprocess.run(command, stdin=source, check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    print("done")


if __name__ == "__main__":
    main()
