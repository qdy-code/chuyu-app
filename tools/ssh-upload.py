#!/usr/bin/env python
"""Upload a local file to remote path via paramiko SFTP, preserving inode if exists."""
import argparse
import sys

import paramiko


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", required=True)
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--local", required=True)
    parser.add_argument("--remote", required=True)
    args = parser.parse_args()

    transport = paramiko.Transport((args.host, args.port))
    transport.connect(username=args.user, password=args.password)
    sftp = paramiko.SFTPClient.from_transport(transport)

    with open(args.local, "rb") as src:
        data = src.read()

    # Try inode-preserving write first (works if file exists)
    try:
        with sftp.open(args.remote, "r+") as dst:
            dst.truncate(0)
            dst.write(data)
    except IOError:
        sftp.put(args.local, args.remote)

    sftp.close()
    transport.close()
    print(f"uploaded {len(data)} bytes to {args.remote}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
