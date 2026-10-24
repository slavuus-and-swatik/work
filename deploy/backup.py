#!/usr/bin/env python3
"""Run as the detailing user. A consistent online backup, including uploaded assets."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
os.umask(0o077)
root = Path(os.environ.get('DETAILING_DATA_DIR', '/var/lib/detailing'))
backups = root / 'backups'
backups.mkdir(mode=0o700, exist_ok=True)
name = datetime.now(timezone.utc).strftime('studio-%Y%m%dT%H%M%S.sqlite')
with sqlite3.connect(f'file:{root / "studio.sqlite"}?mode=ro', uri=True) as source:
    with sqlite3.connect(backups / name) as destination:
        source.backup(destination)
        assert destination.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
print(backups / name)
# Retention is intentionally manual until off-server copies are configured.
