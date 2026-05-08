"""SSH helper for remote deployment.

Usage:
  python ssh_helper.py exec "command"
  python ssh_helper.py upload <local> <remote>
"""
import sys
import os
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "114.215.179.81")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")


def get_client() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    return client


def run_exec(command: str) -> int:
    client = get_client()
    try:
        stdin, stdout, stderr = client.exec_command(command, get_pty=True, timeout=600)
        for line in iter(stdout.readline, ""):
            sys.stdout.write(line)
            sys.stdout.flush()
        exit_code = stdout.channel.recv_exit_status()
        err = stderr.read().decode(errors="replace")
        if err:
            sys.stderr.write(err)
        return exit_code
    finally:
        client.close()


def upload(local: str, remote: str) -> None:
    client = get_client()
    try:
        sftp = client.open_sftp()
        local_path = Path(local)
        if local_path.is_file():
            sftp.put(str(local_path), remote)
            print(f"uploaded: {local} -> {remote}")
        elif local_path.is_dir():
            upload_dir(sftp, local_path, remote)
        else:
            print(f"no such path: {local}")
            sys.exit(1)
        sftp.close()
    finally:
        client.close()


def upload_dir(sftp: paramiko.SFTPClient, local_dir: Path, remote_dir: str) -> None:
    try:
        sftp.mkdir(remote_dir)
    except IOError:
        pass

    for entry in local_dir.iterdir():
        local_path = entry
        remote_path = f"{remote_dir}/{entry.name}"
        if entry.is_dir():
            upload_dir(sftp, local_path, remote_path)
        else:
            sftp.put(str(local_path), remote_path)
            print(f"  {remote_path}")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    if not PASSWORD:
        print("DEPLOY_PASSWORD env var is required")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "exec":
        if len(sys.argv) < 3:
            print("usage: exec <command>")
            sys.exit(1)
        exit_code = run_exec(sys.argv[2])
        sys.exit(exit_code)
    elif cmd == "upload":
        if len(sys.argv) < 4:
            print("usage: upload <local> <remote>")
            sys.exit(1)
        upload(sys.argv[2], sys.argv[3])
    else:
        print(f"unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
