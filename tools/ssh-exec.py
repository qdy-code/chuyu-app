#!/usr/bin/env python
"""One-shot SSH exec helper using paramiko (password auth)."""
import argparse
import sys

import paramiko


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", required=True)
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--cmd", required=True)
    parser.add_argument("--timeout", type=int, default=60)
    args = parser.parse_args()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=args.host,
        port=args.port,
        username=args.user,
        password=args.password,
        timeout=args.timeout,
        allow_agent=False,
        look_for_keys=False,
    )

    stdin, stdout, stderr = client.exec_command(args.cmd, timeout=args.timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    out_b = out.encode("utf-8", errors="replace")
    err_b = err.encode("utf-8", errors="replace")
    sys.stdout.buffer.write(out_b)
    if err_b:
        sys.stderr.buffer.write(err_b)
    client.close()
    return rc


if __name__ == "__main__":
    sys.exit(main())
