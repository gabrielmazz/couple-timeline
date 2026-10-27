#!/usr/bin/env bash

# =====================[ Config Inicial ]=====================
set -o errexit
set -o pipefail
set -o nounset

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Mensagem de commit: 1º arg ou pergunta interativa
MESSAGE="${1:-}"

# Branches que exigem alerta forte
PROTECTED_BRANCHES=("main" "master")

# =====================[ Funções utilitárias ]================
die() { echo -e "${RED}Erro:${RESET} $*" >&2; exit 1; }

confirm() {
  local prompt="${1:-Continuar? [s/N]} "
  read -r -p "$(echo -e "${YELLOW}${prompt}${RESET}")" ans || true
  [[ "${ans:-}" =~ ^([sS][iI]?[mM]?|y|Y)$ ]]
}

say()   { echo -e "$*"; }
step()  { echo -e "${CYAN}${BOLD}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}✔${RESET} $*"; }
warn()  { echo -e "${YELLOW}⚠ $*${RESET}"; }
alert() { echo -e "${BOLD}${RED}⛔ $*${RESET}"; }

# --------------------- Git helpers --------------------------
current_branch() { git rev-parse --abbrev-ref HEAD; }

# =====================[ Pré-checagens ]======================
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Este diretório não é um repositório Git."

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

BRANCH="$(current_branch)"
REMOTE="$(git remote 2>/dev/null | head -n1 || true)"
REMOTE_URL=""
if [[ -n "${REMOTE}" ]]; then
  REMOTE_URL="$(git remote get-url --push "${REMOTE}" 2>/dev/null || true)"
fi

say ""
say "${BOLD}Repositório:${RESET} $(basename "${REPO_ROOT}")"
say "${BOLD}Branch atual:${RESET} ${BLUE}${BRANCH}${RESET}"
[[ -n "${REMOTE}" ]] && say "${BOLD}Remote:${RESET} ${REMOTE}  ${BOLD}URL:${RESET} ${REMOTE_URL}"

# Detecta qual é o branch principal (main/master)
if git rev-parse --verify main >/dev/null 2>&1; then
  MAIN_BRANCH="main"
elif git rev-parse --verify master >/dev/null 2>&1; then
  MAIN_BRANCH="master"
else
  MAIN_BRANCH="main"  # fallback
fi

# Alerta se branch protegida
for b in "${PROTECTED_BRANCHES[@]}"; do
  if [[ "${BRANCH}" == "${b}" ]]; then
    alert "Você está na branch protegida: ${BRANCH}"
    confirm "Tem certeza que deseja commitar/push na ${BRANCH}? [s/N] " || die "Operação abortada pelo usuário."
    break
  fi
done

# =========[ Prefixo de commit derivado da branch ]===========
BASE_BRANCH="${BRANCH##*/}"
COMMIT_PREFIX=""
if [[ "$BASE_BRANCH" == *-* ]]; then
  CANDIDATE="${BASE_BRANCH%%-*}"
  if [[ "$CANDIDATE" =~ ^[A-Za-z]+[0-9]+$ ]]; then
    COMMIT_PREFIX="${CANDIDATE} - "
  fi
fi

# Mostrar resumo do status
say ""
step "Resumo de alterações (git status --short):"
git status --short
echo ""

# Contagens úteis
TOTAL_CHANGED=$(git status --porcelain | wc -l | tr -d ' ')
if [[ "${TOTAL_CHANGED}" -eq 0 ]]; then
  warn "Nenhuma alteração detectada no working tree."
  if ! confirm "Deseja continuar mesmo assim (pode apenas puxar/push sem commit)? [s/N] "; then
    die "Nada a fazer. Abortado."
  fi
fi

# =====================[ Mensagem de commit ]=================
if [[ -z "${MESSAGE}" && "${TOTAL_CHANGED}" -gt 0 ]]; then
  say ""
  read -r -p "$(echo -e "${YELLOW}Digite a mensagem de commit (vazio = 'Auto commit'): ${RESET}")" MESSAGE || true
  MESSAGE="${MESSAGE:-Auto commit}"
fi

FINAL_MESSAGE="${MESSAGE:-Auto commit}"
if [[ -n "$COMMIT_PREFIX" && "$FINAL_MESSAGE" != "${COMMIT_PREFIX}"* ]]; then
  FINAL_MESSAGE="${COMMIT_PREFIX}${FINAL_MESSAGE}"
fi
say ""
step "Mensagem final do commit: ${BOLD}${FINAL_MESSAGE}${RESET}"

# =====================[ Staging ]============================
if [[ "${TOTAL_CHANGED}" -gt 0 ]]; then
  step "Adicionar alterações ao index (git add .)"
  if confirm "Adicionar tudo (git add .)? [s/N] "; then
    git add .
    ok "Arquivos adicionados ao index."
  else
    warn "Pulado 'git add '."
  fi
fi

# =====================[ Commit ]=============================
if [[ "${TOTAL_CHANGED}" -gt 0 ]]; then
  step "Commit"
  if confirm "Fazer commit com mensagem acima? [s/N] "; then
    set +e
    git commit -m "${FINAL_MESSAGE}"
    COMMIT_STATUS=$?
    set -e
    if [[ ${COMMIT_STATUS} -eq 0 ]]; then
      ok "Commit criado."
    else
      warn "Nenhuma mudança para commitar (possivelmente index vazio)."
    fi
  else
    warn "Pulado 'git commit'."
  fi
fi

# =====================[ Pull (antes do push)? ]==============
say ""
step "Sincronizar antes do push"
if confirm "Deseja executar 'git pull --rebase --autostash' agora? [s/N] "; then
  git pull --rebase --autostash "${REMOTE:-origin}" "${BRANCH}"
  ok "Pull (rebase) concluído."
else
  warn "Pulado 'git pull --rebase --autostash'."
fi

# Mostrar se há commits à frente/atrás
say ""
step "Estado em relação ao remoto"
set +e
AHEAD_BEHIND=$(git rev-list --left-right --count "${REMOTE:-origin}/${BRANCH}...${BRANCH}" 2>/dev/null)
set -e
if [[ -n "${AHEAD_BEHIND}" ]]; then
  LEFT=$(echo "${AHEAD_BEHIND}" | awk '{print $1}')
  RIGHT=$(echo "${AHEAD_BEHIND}" | awk '{print $2}')
  say "Commits atrás do remoto: ${LEFT} | à frente: ${RIGHT}"
else
  warn "Não foi possível calcular ahead/behind."
fi

# =====================[ Checagem de Pull Request (GitHub) ]=====================
# Tenta detectar owner/repo do GitHub a partir do origin
parse_github_owner_repo() {
  local url="${1:-}"
  # Formatos suportados:
  #  - git@github.com:owner/repo.git
  #  - https://github.com/owner/repo.git
  #  - https://github.com/owner/repo
  if [[ "$url" =~ github\.com[:/]+([^/]+)/([^.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  else
    echo ""
  fi
}

check_open_pr() {
  local remote_url; remote_url="$(git remote get-url "${REMOTE:-origin}" 2>/dev/null || true)"
  local full_name; full_name="$(parse_github_owner_repo "$remote_url")"

  if [[ -z "$full_name" ]]; then
    warn "Host do remoto não é GitHub ou não foi possível detectar owner/repo. Pulando checagem de PR."
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    warn "curl/jq não encontrados — não será possível checar PRs abertos."
    return 0
  fi

  step "Verificando PRs abertos no GitHub para '${full_name}' (branch '${BRANCH}')..."
  local api="https://api.github.com/repos/${full_name}/pulls?state=open&per_page=100"
  local auth_header=()
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth_header=(-H "Authorization: token ${GITHUB_TOKEN}")
  fi

  # Busca PRs abertos e filtra por branch head == BRANCH
  local resp
  set +e
  resp=$(curl -s "${auth_header[@]}" "$api")
  local curl_status=$?
  set -e
  if [[ $curl_status -ne 0 || -z "$resp" ]]; then
    warn "Falha ao consultar GitHub API. Pulando checagem de PR."
    return 0
  fi

  local matches
  matches=$(echo "$resp" | jq --arg b "$BRANCH" '[ .[] | select(.head.ref == $b) ]')
  if echo "$matches" | jq -e 'length > 0' >/dev/null; then
    alert "Há Pull Request(s) aberto(s) para a branch '${BRANCH}':"
    echo "$matches" | jq -r '.[].html_url'
    if ! confirm "Prosseguir mesmo assim com merge/push? [s/N] "; then
      die "Abortado por segurança (PR aberto encontrado)."
    fi
  else
    ok "Nenhum PR aberto encontrado para '${BRANCH}'."
  fi
}

# roda a checagem de PR antes de qualquer merge com a main
check_open_pr

# =====================[ Merge com main ]=====================
merge_with_main() {
  say ""
  step "Merge com '${MAIN_BRANCH}'"
  echo "1) Trazer '${MAIN_BRANCH}' para a sua branch atual (${BRANCH})"
  echo "2) Enviar sua branch (${BRANCH}) para '${MAIN_BRANCH}'"
  read -r -p "Escolha [1/2]: " MERGE_OPT

  case "${MERGE_OPT}" in
    1)
      step "Atualizando '${MAIN_BRANCH}' local e mesclando na sua branch"
      git fetch "${REMOTE:-origin}" --prune
      git checkout "${MAIN_BRANCH}"
      git pull --ff-only "${REMOTE:-origin}" "${MAIN_BRANCH}"
      git checkout "${BRANCH}"
      set +e; git merge --no-ff "${MAIN_BRANCH}"; MERGE_STATUS=$?; set -e
      if [[ ${MERGE_STATUS} -ne 0 ]]; then
        alert "Conflitos detectados. Resolva, faça commit e rode novamente."
        exit 1
      fi
      ok "Merge de '${MAIN_BRANCH}' → '${BRANCH}' concluído."
      ;;
    2)
      if [[ "${BRANCH}" == "${MAIN_BRANCH}" ]]; then
        warn "Você já está em '${MAIN_BRANCH}'."
        return
      fi
      step "Mesclando '${BRANCH}' em '${MAIN_BRANCH}'"
      git fetch "${REMOTE:-origin}" --prune
      git checkout "${MAIN_BRANCH}"
      git pull --ff-only "${REMOTE:-origin}" "${MAIN_BRANCH}"
      set +e; git merge --no-ff "${BRANCH}"; MERGE_STATUS=$?; set -e
      if [[ ${MERGE_STATUS} -ne 0 ]]; then
        alert "Conflitos detectados ao mesclar '${BRANCH}' em '${MAIN_BRANCH}'."
        exit 1
      fi
      if confirm "Push de '${MAIN_BRANCH}' para ${REMOTE:-origin}? [s/N] "; then
        git push "${REMOTE:-origin}" "${MAIN_BRANCH}"
        ok "Push de '${MAIN_BRANCH}' concluído."
      fi
      git checkout "${BRANCH}"
      ok "Retornado para '${BRANCH}'."
      ;;
    *)
      warn "Opção inválida."
      ;;
  esac
}

say ""
step "Integração com ${MAIN_BRANCH}"
if confirm "Deseja realizar um merge com '${MAIN_BRANCH}' agora? [s/N] "; then
  merge_with_main
else
  warn "Merge com '${MAIN_BRANCH}' pulado."
fi

# =====================[ Push ]===============================
say ""
step "Enviar alterações (push)"
if confirm "Executar 'git push ${REMOTE:-origin} ${BRANCH}'? [s/N] "; then
  git push "${REMOTE:-origin}" "${BRANCH}"
  ok "Push concluído."
else
  warn "Pulado 'git push'."
fi

# =====================[ Pull final opcional ]================
say ""
step "Atualizar local após push (opcional)"
if confirm "Deseja executar um 'git pull' final para garantir sincronização? [s/N] "; then
  git pull "${REMOTE:-origin}" "${BRANCH}"
  ok "Pull final concluído."
else
  warn "Pulado 'git pull' final."
fi

say ""
ok "Fluxo encerrado na branch ${BRANCH}."
