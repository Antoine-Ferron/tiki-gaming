#!/usr/bin/env bash
set -euo pipefail

dame_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
dame_tmp=$(mktemp -d "${TMPDIR:-/private/tmp}/tiki-dame-demo.XXXXXX")
trap 'rm -rf "$dame_tmp"' EXIT

cd "$dame_root/backend"
mvn -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath \
  "-Dmdep.outputFile=$dame_tmp/classpath"
java "-Ddame.demo.port=${DAME_DEMO_PORT:-8080}" \
  -cp "target/test-classes:target/classes:$(cat "$dame_tmp/classpath")" \
  fr.tikigaming.games.dame.demo.DameLocalDemo
