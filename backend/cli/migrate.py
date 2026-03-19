from __future__ import annotations

import argparse
import json

from backend.services.legacy_migration import get_legacy_migration_service


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy TG-Pilot data into DB")
    parser.add_argument("--dry-run", action="store_true", help="Only report what would be migrated")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing DB sign task rows during migration",
    )
    args = parser.parse_args()

    result = get_legacy_migration_service().migrate_all(
        dry_run=args.dry_run,
        overwrite=args.overwrite,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
