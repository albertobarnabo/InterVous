#!/usr/bin/env bash
# Tests supabase/migrations/20261017120000_intervous_v2.sql against a throwaway local
# Supabase Postgres container. Never touches the live project.
#
# For each variant of the live schema it: starts a fresh container, applies
# supabase/tests/setup.sql, runs the migration TWICE (as role postgres, like the
# Supabase SQL editor), runs supabase/tests/test.sql and test2.sql, and removes the container.
#
# Usage: scripts/test-sql.sh [variant ...]     (default: all variants)
#        KEEP=1 scripts/test-sql.sh base        keep the container for poking around
#        VERBOSE=1 scripts/test-sql.sh          print every psql output
# Variants: base int8 date timestamptz strict noowner
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261017120000_intervous_v2.sql"
TESTS="$ROOT/supabase/tests"
IMAGE="${IMAGE:-public.ecr.aws/supabase/postgres:17.11.0.004}"
ALL_VARIANTS=(base int8 date timestamptz strict noowner)
VARIANTS=("$@")
[ ${#VARIANTS[@]} -eq 0 ] && VARIANTS=("${ALL_VARIANTS[@]}")

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }

# psql -v settings for each variant (see the header of supabase/tests/setup.sql)
variant_vars() {
  case "$1" in
    base)        echo "-v id_type=integer -v date_type=text -v strict=0 -v storage_owner=1" ;;
    int8)        echo "-v id_type=bigint -v date_type=text -v strict=0 -v storage_owner=1" ;;
    date)        echo "-v id_type=integer -v date_type=date -v strict=0 -v storage_owner=1" ;;
    timestamptz) echo "-v id_type=bigint -v date_type=timestamptz -v strict=0 -v storage_owner=1" ;;
    strict)      echo "-v id_type=integer -v date_type=text -v strict=1 -v storage_owner=1" ;;
    noowner)     echo "-v id_type=integer -v date_type=text -v strict=0 -v storage_owner=0" ;;
    *) echo "unknown variant: $1 (known: ${ALL_VARIANTS[*]})" >&2; return 1 ;;
  esac
}

CONTAINER=""
cleanup() {
  if [ -n "$CONTAINER" ] && [ -z "${KEEP:-}" ]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

# run_sql <label> <user> <file> [psql args...]: fails the variant on any SQL error
run_sql() {
  local label="$1" user="$2" file="$3"; shift 3
  local out
  if ! out=$(docker exec -i "$CONTAINER" psql -X -q -U "$user" -d postgres -v ON_ERROR_STOP=1 "$@" < "$file" 2>&1); then
    echo "$out" | tail -40
    echo "FAIL  $label" >&2
    return 1
  fi
  [ -n "${VERBOSE:-}" ] && echo "$out"
  LAST_OUT="$out"
  echo "  ok  $label"
}

start_container() {
  CONTAINER="intervous-sqltest-$1-$$"
  docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
  # the image runs its init scripts on a temporary server, then restarts: wait for the real one
  for _ in $(seq 1 120); do
    if docker logs "$CONTAINER" 2>&1 | grep -q 'init process complete' &&
       docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null &&
       docker exec "$CONTAINER" psql -X -U supabase_admin -d postgres -tAc "select 1" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "container $CONTAINER did not become ready" >&2
  docker logs "$CONTAINER" 2>&1 | tail -20 >&2
  return 1
}

failed=()
for v in "${VARIANTS[@]}"; do
  # shellcheck disable=SC2207
  vars=($(variant_vars "$v"))
  echo "== variant: $v (${vars[*]})"
  if ! start_container "$v"; then failed+=("$v"); continue; fi
  if run_sql "setup"            supabase_admin "$TESTS/setup.sql" "${vars[@]}" &&
     run_sql "migration, run 1" postgres       "$MIGRATION" &&
     run_sql "migration, run 2" postgres       "$MIGRATION" &&
     echo "$LAST_OUT" | grep -A2 'new_tables' | sed 's/^/      /' &&
     run_sql "test.sql"         supabase_admin       "$TESTS/test.sql"  "${vars[@]}" &&
     run_sql "test2.sql"        supabase_admin       "$TESTS/test2.sql" "${vars[@]}"; then
    echo "PASS  $v"
  else
    failed+=("$v")
  fi
  if [ -z "${KEEP:-}" ]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; CONTAINER=""; fi
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "FAILED variants: ${failed[*]}" >&2
  exit 1
fi
echo "all variants passed: ${VARIANTS[*]}"
