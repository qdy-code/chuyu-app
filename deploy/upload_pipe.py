"""Upload a local file to remote via SSH exec pipe (workaround for SFTP issues).

Usage: python upload_pipe.py <local> <remote>
"""
import sys
import os
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "114.215.179.81")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")


def main() -> None:
    if len(sys.argv) < 3:
        print("usage: upload_pipe.py <local> <remote>")
        sys.exit(1)

    local = sys.argv[1]
    remote = sys.argv[2]

    if not PASSWORD:
        print("DEPLOY_PASSWORD env var is required")
        sys.exit(1)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    try:
        with open(local, "rb") as f:
            data = f.read()
        size = len(data)
        print(f"uploading {size} bytes to {remote}...")

        cmd = f"cat > {remote}"
        stdin, stdout, stderr = client.exec_command(cmd)
        stdin.channel.sendall(data)
        stdin.channel.shutdown_write()
        exit_code = stdout.channel.recv_exit_status()
        err = stderr.read().decode(errors="replace")
        if err:
            sys.stderr.write(err)
        if exit_code != 0:
            print(f"failed with exit {exit_code}")
            sys.exit(exit_code)
        print("done")
    finally:
        client.close()


if __name__ == "__main__":
    main()
