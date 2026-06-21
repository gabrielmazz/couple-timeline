#!/usr/bin/env bash

# Reverte o working tree para o último commit (HEAD) ou para o upstream (@{u})
set -o errexit
set -o pipefail
set -o nounset

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
say() { echo -e "$*"; }
step() { echo -e "${BLUE}${BOLD}▶ $*${RESET}"; }
ok() { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠ $*${RESET}"; }
die() { echo -e "${RED}Erro:${RESET} $*" >&2; exit 1; }

confirm() {
  local prompt="${1:-Confirmar? [s/N]} "
  read -r -p "$(echo -e "${YELLOW}${prompt}${RESET}")" ans || true
  [[ "${ans:-}" =~ ^([sS][iI]?[mM]?|y|Y)$ ]]
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Este diretório não é um repositório Git."

BRANCH=$(git rev-parse --abbrev-ref HEAD)
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)

MODE="head"    # head | upstream
CLEAN="keep"    # keep | clean (remove untracked/ignored)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --upstream|-u) MODE="upstream"; shift ;;
    --head|-h) MODE="head"; shift ;;
    --clean) CLEAN="clean"; shift ;;
    --keep) CLEAN="keep"; shift ;;
    *) warn "Flag desconhecida: $1"; shift ;;
  esac
done

say "${BOLD}Branch:${RESET} ${BRANCH}"
[[ -n "$UPSTREAM" ]] && say "${BOLD}Upstream:${RESET} ${UPSTREAM}"

echo ""
step "Resumo de alterações (git status --short):"
git status --short || true

TARGET="HEAD"
if [[ "$MODE" == "upstream" ]]; then
  [[ -n "$UPSTREAM" ]] || die "Sem upstream configurado para ${BRANCH}. Use --head ou configure o tracking."
  TARGET="@{u}"
fi

echo ""
warn "Esta ação DESCARTA alterações locais (reset --hard ${TARGET})."
[[ "$CLEAN" == "clean" ]] && warn "Arquivos não-versionados/ignorados também serão removidos (git clean -fdx)."

confirm "Prosseguir com o reset para ${TARGET}? [s/N] " || die "Abortado pelo usuário."

step "Resetando working tree…"
git reset --hard "$TARGET"

if [[ "$CLEAN" == "clean" ]]; then
  step "Limpando arquivos não versionados/ignorados (git clean -fdx)…"
  git clean -fdx
fi

ok "Revert concluído para ${TARGET}."
git status -sb || true

