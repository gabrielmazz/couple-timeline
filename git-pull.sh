#!/usr/bin/env bash

# Pull seguro com rebase/autostash e detecção de upstream
set -o errexit
set -o pipefail
set -o nounset

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
say() { echo -e "$*"; }
step() { echo -e "${BLUE}${BOLD}▶ $*${RESET}"; }
ok() { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠ $*${RESET}"; }
die() { echo -e "${RED}Erro:${RESET} $*" >&2; exit 1; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Este diretório não é um repositório Git."

BRANCH=$(git rev-parse --abbrev-ref HEAD)
REMOTE_DEFAULT=$(git remote 2>/dev/null | head -n1 || true)

MODE="rebase"   # rebase | merge | ff-only
while [[ $# -gt 0 ]]; do
  case "$1" in
    --merge) MODE="merge"; shift ;;
    --ff-only|--ff) MODE="ff-only"; shift ;;
    --rebase) MODE="rebase"; shift ;;
    *) warn "Flag desconhecida: $1"; shift ;;
  esac
done

say "${BOLD}Repositório:${RESET} $(basename "$(git rev-parse --show-toplevel)")"
say "${BOLD}Branch:${RESET} ${BRANCH}"

# Descobre upstream atual (se existir)
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)"
if [[ -z "$UPSTREAM" ]]; then
  [[ -n "$REMOTE_DEFAULT" ]] || die "Nenhum remoto configurado. Use 'git remote add origin <url>'."
  step "Nenhum upstream configurado para ${BRANCH}. Tentando usar ${REMOTE_DEFAULT}/${BRANCH}…"
  if git ls-remote --exit-code --heads "$REMOTE_DEFAULT" "$BRANCH" >/dev/null 2>&1; then
    git branch --set-upstream-to="${REMOTE_DEFAULT}/${BRANCH}" "$BRANCH"
    ok "Upstream definido: ${REMOTE_DEFAULT}/${BRANCH}"
    UPSTREAM="${REMOTE_DEFAULT}/${BRANCH}"
  else
    die "A branch '${BRANCH}' não existe no remoto '${REMOTE_DEFAULT}'. Publique-a primeiro (git push -u ${REMOTE_DEFAULT} ${BRANCH})."
  fi
fi

step "Sincronizando remotos (fetch --all --prune)…"
git fetch --all --prune

# Escolhe estratégia de pull
case "$MODE" in
  rebase)
    step "Atualizando com rebase + autostash (git pull --rebase --autostash)"
    # Nem todos os Git têm --autostash em pull; fallback manual:
    if git pull --rebase --autostash 2>/dev/null; then
      ok "Pull (rebase) concluído."
    else
      warn "'git pull --rebase --autostash' não suportado. Fazendo autostash manual."
      git stash push -u -m "auto-stash: git-pull.sh" || true
      git pull --rebase
      git stash pop || true
      ok "Pull (rebase) concluído com autostash manual."
    fi
    ;;
  ff-only)
    step "Atualizando com fast-forward only"
    git pull --ff-only
    ok "Pull (ff-only) concluído."
    ;;
  merge)
    step "Atualizando com merge padrão"
    git pull
    ok "Pull (merge) concluído."
    ;;
esac

echo ""
git status --short
ok "Tudo certo. Upstream: ${UPSTREAM}"

