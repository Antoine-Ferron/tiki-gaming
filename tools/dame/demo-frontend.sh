#!/usr/bin/env bash
set -euo pipefail

dame_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$dame_root/frontend"
VITE_SUPABASE_URL=https://dame-demo.supabase.invalid \
VITE_SUPABASE_ANON_KEY=dame-demo-anon \
npm run dev -- --host localhost --port 5173 --strictPort
