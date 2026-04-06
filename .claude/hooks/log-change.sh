#!/usr/bin/env bash
# PostToolUse hook: after a git commit, remind Claude to log the change to nexus brain.
# Reads JSON from stdin (Claude Code hook protocol).

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
[ "$TOOL_NAME" != "Bash" ] && exit 0

COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)
echo "$COMMAND" | grep -q "git commit" || exit 0

STDOUT=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_result',{}).get('stdout',''))" 2>/dev/null)
echo "$STDOUT" | grep -qE "(file changed|files changed|create mode)" || exit 0

# Extract commit subject for context
SUBJECT=$(git log -1 --format=%s 2>/dev/null)

cat <<EOF
IMPORTANT: You just committed: "$SUBJECT"
Log this change to the nexus brain NOW before doing anything else.
Pick the right type(s) — wins, decisions, gotchas, or patterns — and run:
  ~/nexus/venv/bin/python ~/nexus/kb brain add metalzone --type <type> -c "title" -b "body"
For wins, add --comp with relevant competency slugs.
Do NOT skip this step. Do NOT just log it as a memory — categorize it properly.
EOF
