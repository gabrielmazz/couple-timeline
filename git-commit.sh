#!/usr/bin/env bash
# git-commit.sh - Fluxo seguro para stage, commit, rebase, merge e push.

set -o errexit
set -o pipefail
set -o nounset
IFS=$'\n\t'

# ==== UI ====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

say()   { printf "%b\n" "$*"; }
ok()    { say "${GREEN}OK${RESET} $*"; }
warn()  { say "${YELLOW}AVISO:${RESET} $*" >&2; }
alert() { say "${BOLD}${RED}ERRO:${RESET} $*" >&2; }
step()  { say "${CYAN}${BOLD}> $*${RESET}"; }

usage() {
  cat <<'USAGE'
Uso:
  ./git-commit.sh "mensagem do commit"
  ./git-commit.sh

O script:
  - evita commitar .env e .env.*;
  - detecta rebase/merge/cherry-pick/revert em andamento;
  - faz commit apenas quando ha staged changes;
  - sincroniza com upstream usando rebase + autostash;
  - tenta recuperar push rejeitado com fetch + rebase + novo push.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

MESSAGE="${*:-}"
PROTECTED_BRANCHES=("main" "master" "develop" "production" "release")

confirm() {
  local prompt="${1:-Continuar? [s/N]} "
  local ans=""
  read -r -p "$(printf "%b" "${YELLOW}${prompt}${RESET}")" ans || true
  [[ "${ans:-}" =~ ^([sS]([iI][mM])?|[yY]([eE][sS])?)$ ]]
}

confirm_yes() {
  local prompt="${1:-Continuar? [S/n]} "
  local ans=""
  read -r -p "$(printf "%b" "${YELLOW}${prompt}${RESET}")" ans || true
  [[ -z "${ans:-}" || "${ans:-}" =~ ^([sS]([iI][mM])?|[yY]([eE][sS])?)$ ]]
}

has_cmd() { command -v "$1" >/dev/null 2>&1; }

die() {
  alert "$*"
  exit 1
}

# ==== Repo / Git state ====
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Este diretorio nao e um repositorio Git."
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

detect_remote() {
  if git remote | grep -qxF origin; then
    printf "origin\n"
    return 0
  fi

  git remote | head -n1 || true
}

REMOTE="$(detect_remote)"

refresh_remote() {
  REMOTE="$(detect_remote)"
}

require_remote() {
  refresh_remote
  if [[ -z "${REMOTE:-}" ]]; then
    warn "Nenhum remote configurado."
    return 1
  fi
}

current_branch() {
  git branch --show-current 2>/dev/null || true
}

display_branch() {
  local branch
  branch="$(current_branch)"
  if [[ -n "$branch" ]]; then
    printf "%s\n" "$branch"
  else
    printf "detached@%s\n" "$(git rev-parse --short HEAD)"
  fi
}

sanitize_branch_name() {
  local raw="$1"
  local value="$raw"

  if has_cmd iconv; then
    value="$(printf "%s" "$value" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf "%s" "$raw")"
  fi

  value="$(printf "%s" "$value" | tr '[:upper:]' '[:lower:]')"
  value="$(printf "%s" "$value" | sed -E \
    -e 's/[[:space:]]+/-/g' \
    -e 's#[^a-z0-9._/-]+#-#g' \
    -e 's#/{2,}#/#g' \
    -e 's/-+/-/g' \
    -e 's#\.+#.#g' \
    -e 's#(^[/.-]+|[/.-]+$)##g' \
    -e 's#/[./-]+#/#g' \
    -e 's#[./-]+/#/#g')"

  printf "%s\n" "$value"
}

valid_branch_name() {
  local name="$1"
  [[ -n "$name" ]] || return 1
  [[ "$name" != -* ]] || return 1
  [[ "$name" != *"@{"* ]] || return 1
  [[ "$name" != *".lock" ]] || return 1
  git check-ref-format --branch "$name" >/dev/null 2>&1
}

ensure_named_branch() {
  local branch
  branch="$(current_branch)"
  if [[ -n "$branch" ]]; then
    return 0
  fi

  alert "Voce esta em detached HEAD. Push direto daqui nao e seguro."
  confirm "Criar uma branch a partir do commit atual? [s/N] " || return 1

  local raw=""
  local name=""
  while true; do
    read -r -p "Nome da nova branch: " raw
    name="$(sanitize_branch_name "$raw")"
    if valid_branch_name "$name"; then
      break
    fi
    warn "Nome invalido: ${name:-vazio}"
  done

  git switch -c "$name" 2>/dev/null || git checkout -b "$name"
  ok "Branch '${name}' criada."
}

local_branch_exists() {
  git show-ref --verify --quiet "refs/heads/$1"
}

remote_branch_exists() {
  require_remote || return 1
  git show-ref --verify --quiet "refs/remotes/${REMOTE}/$1" \
    || git ls-remote --exit-code --heads "$REMOTE" "refs/heads/$1" >/dev/null 2>&1
}

detect_main_branch() {
  if [[ -n "${REMOTE:-}" ]] && git symbolic-ref --quiet --short "refs/remotes/${REMOTE}/HEAD" >/dev/null 2>&1; then
    git symbolic-ref --short "refs/remotes/${REMOTE}/HEAD" | sed "s#^${REMOTE}/##"
    return 0
  fi

  if local_branch_exists main || git show-ref --verify --quiet "refs/remotes/${REMOTE:-origin}/main"; then
    printf "main\n"
  elif local_branch_exists master || git show-ref --verify --quiet "refs/remotes/${REMOTE:-origin}/master"; then
    printf "master\n"
  else
    printf "main\n"
  fi
}

protected_branch() {
  local branch="$1"
  local protected=""
  for protected in "${PROTECTED_BRANCHES[@]}"; do
    [[ "$branch" == "$protected" ]] && return 0
  done
  return 1
}

git_operation() {
  if [[ -d "$(git rev-parse --git-path rebase-merge)" || -d "$(git rev-parse --git-path rebase-apply)" ]]; then
    printf "rebase\n"
  elif [[ -f "$(git rev-parse --git-path MERGE_HEAD)" ]]; then
    printf "merge\n"
  elif [[ -f "$(git rev-parse --git-path CHERRY_PICK_HEAD)" ]]; then
    printf "cherry-pick\n"
  elif [[ -f "$(git rev-parse --git-path REVERT_HEAD)" ]]; then
    printf "revert\n"
  elif [[ -f "$(git rev-parse --git-path BISECT_LOG)" ]]; then
    printf "bisect\n"
  else
    printf "none\n"
  fi
}

has_conflicts() {
  [[ -n "$(git diff --name-only --diff-filter=U)" ]]
}

show_conflicts() {
  local files
  files="$(git diff --name-only --diff-filter=U)"
  if [[ -n "$files" ]]; then
    warn "Arquivos com conflito:"
    printf "%s\n" "$files"
  else
    ok "Nenhum conflito nao resolvido detectado."
  fi
}

continue_operation() {
  local op
  op="$(git_operation)"

  case "$op" in
    rebase)
      git rebase --continue
      ;;
    merge)
      git merge --continue 2>/dev/null || git commit
      ;;
    cherry-pick)
      git cherry-pick --continue
      ;;
    revert)
      git revert --continue
      ;;
    bisect)
      warn "Bisect em andamento. Use 'git bisect reset' quando terminar."
      return 1
      ;;
    none)
      ok "Nao ha operacao Git em andamento."
      ;;
  esac
}

abort_operation() {
  local op
  op="$(git_operation)"

  case "$op" in
    rebase)
      git rebase --abort
      ;;
    merge)
      git merge --abort 2>/dev/null || git reset --merge
      ;;
    cherry-pick)
      git cherry-pick --abort
      ;;
    revert)
      git revert --abort
      ;;
    bisect)
      git bisect reset
      ;;
    none)
      ok "Nao ha operacao Git em andamento."
      ;;
  esac
}

skip_operation() {
  local op
  op="$(git_operation)"

  case "$op" in
    rebase)
      git rebase --skip
      ;;
    cherry-pick)
      git cherry-pick --skip
      ;;
    revert)
      git revert --skip
      ;;
    *)
      warn "A operacao '${op}' nao suporta skip por este script."
      return 1
      ;;
  esac
}

sensitive_file() {
  local file="$1"
  case "$file" in
    .env|.env.*|*/.env|*/.env.*)
      [[ "$file" == ".env.example" || "$file" == */.env.example ]] && return 1
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

list_sensitive_status_files() {
  local tmp
  local file=""
  tmp="$(mktemp)"

  while IFS= read -r -d '' file; do
    if sensitive_file "$file"; then
      printf "%s\n" "$file" >> "$tmp"
    fi
  done < <(git ls-files -mo --exclude-standard -z)

  while IFS= read -r -d '' file; do
    if sensitive_file "$file"; then
      printf "%s\n" "$file" >> "$tmp"
    fi
  done < <(git diff --cached --name-only -z)

  sort -u "$tmp"
  rm -f "$tmp"
}

unstage_sensitive_files() {
  local file=""
  while IFS= read -r -d '' file; do
    if sensitive_file "$file"; then
      git restore --staged -- "$file" 2>/dev/null || git reset -q -- "$file"
      warn "Arquivo sensivel mantido fora do commit: ${file}"
    fi
  done < <(git diff --cached --name-only -z)
}

stage_all_safe() {
  step "Adicionando alteracoes ao index"
  git add -A
  unstage_sensitive_files

  if has_staged_changes; then
    if ! git diff --cached --check; then
      warn "Foram encontrados problemas de whitespace no diff staged."
      confirm "Continuar mesmo assim? [s/N] " || return 1
    fi
  fi
}

operation_recovery_menu() {
  local op=""
  local opt=""

  while true; do
    op="$(git_operation)"
    if [[ "$op" == "none" ]]; then
      ok "Repositorio sem rebase/merge/cherry-pick/revert pendente."
      return 0
    fi

    say ""
    alert "Operacao Git em andamento: ${op}"
    git status --short || true
    show_conflicts

    say ""
    say "${BOLD}Recuperacao:${RESET}"
    say "  1) Ver status completo"
    say "  2) Stage seguro (sem .env) e continuar"
    say "  3) Continuar operacao"
    say "  4) Abortar operacao"
    say "  5) Pular item atual (quando suportado)"
    say "  0) Voltar"
    read -r -p "Escolha: " opt

    case "${opt:-}" in
      1)
        git status
        ;;
      2)
        confirm "Rodar stage seguro e continuar '${op}'? [s/N] " || continue
        if stage_all_safe && continue_operation; then
          ok "Operacao continuada."
        else
          warn "A operacao ainda precisa de atencao."
        fi
        ;;
      3)
        if has_conflicts; then
          warn "Ainda existem conflitos. Resolva os arquivos antes de continuar."
          continue
        fi
        if continue_operation; then
          ok "Operacao continuada."
        else
          warn "A operacao ainda precisa de atencao."
        fi
        ;;
      4)
        confirm "Abortar '${op}' e voltar ao estado anterior? [s/N] " || continue
        abort_operation
        ok "Operacao abortada."
        ;;
      5)
        confirm "Pular o item atual de '${op}'? [s/N] " || continue
        if skip_operation; then
          ok "Item pulado."
        else
          warn "Nao foi possivel pular."
        fi
        ;;
      0)
        return 1
        ;;
      *)
        warn "Opcao invalida."
        ;;
    esac
  done
}

ensure_no_operation() {
  local op
  op="$(git_operation)"
  if [[ "$op" == "none" ]]; then
    return 0
  fi

  operation_recovery_menu || true
  op="$(git_operation)"
  if [[ "$op" != "none" ]]; then
    warn "Ainda ha '${op}' em andamento. Parei para evitar perda de estado."
    return 1
  fi
}

has_staged_changes() {
  ! git diff --cached --quiet --ignore-submodules
}

has_unstaged_changes() {
  ! git diff --quiet --ignore-submodules
}

has_untracked_files() {
  [[ -n "$(git ls-files --others --exclude-standard)" ]]
}

has_any_changes() {
  has_staged_changes || has_unstaged_changes || has_untracked_files
}

commit_prefix_from_branch() {
  local branch="$1"
  local base="${branch##*/}"

  if [[ "$base" =~ ^([A-Za-z]+-[0-9]+|[A-Za-z]+[0-9]+)([-_].*)?$ ]]; then
    printf "%s - " "${BASH_REMATCH[1]}"
  fi
}

print_repo_header() {
  local branch="$1"
  local remote_url=""

  if [[ -n "${REMOTE:-}" ]]; then
    remote_url="$(git remote get-url --push "$REMOTE" 2>/dev/null || true)"
  fi

  say ""
  say "${BOLD}Repositorio:${RESET} $(basename "$REPO_ROOT")"
  say "${BOLD}Branch atual:${RESET} ${BLUE}${branch}${RESET}"
  if [[ -n "${REMOTE:-}" ]]; then
    say "${BOLD}Remote:${RESET} ${REMOTE}  ${BOLD}URL:${RESET} ${remote_url}"
  else
    warn "Sem remote configurado."
  fi
}

print_status_summary() {
  say ""
  step "Resumo de alteracoes"
  git status --short

  local sensitive
  sensitive="$(list_sensitive_status_files)"
  if [[ -n "$sensitive" ]]; then
    say ""
    warn "Arquivos .env detectados. Eles nao serao commitados:"
    printf "%s\n" "$sensitive"
  fi
}

ensure_upstream_for_branch() {
  local branch="$1"
  local upstream=""

  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -n "$upstream" ]]; then
    printf "%s\n" "$upstream"
    return 0
  fi

  require_remote || return 1
  if remote_branch_exists "$branch"; then
    git fetch "$REMOTE" "refs/heads/${branch}:refs/remotes/${REMOTE}/${branch}" >/dev/null 2>&1 || true
    git branch --set-upstream-to="${REMOTE}/${branch}" "$branch" >/dev/null
    printf "%s/%s\n" "$REMOTE" "$branch"
    return 0
  fi

  return 1
}

fetch_prune() {
  require_remote || return 1
  step "Sincronizando remote (${REMOTE})"
  git fetch "$REMOTE" --prune
}

show_ahead_behind() {
  local upstream=""
  local counts=""
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"

  say ""
  step "Estado em relacao ao remote"
  if [[ -z "$upstream" ]]; then
    warn "Sem upstream configurado."
    return 0
  fi

  counts="$(git rev-list --left-right --count "${upstream}...HEAD" 2>/dev/null || true)"
  if [[ -z "$counts" ]]; then
    warn "Nao foi possivel calcular ahead/behind."
    return 0
  fi

  say "Upstream: ${upstream}"
  say "Atras: $(awk '{print $1}' <<< "$counts") | A frente: $(awk '{print $2}' <<< "$counts")"
}

safe_pull_rebase() {
  ensure_no_operation || return 1
  require_remote || return 1

  local branch=""
  local upstream=""
  branch="$(current_branch)"

  fetch_prune || return 1
  upstream="$(ensure_upstream_for_branch "$branch" || true)"
  if [[ -z "$upstream" ]]; then
    warn "Sem upstream. Pull/rebase pulado ate a branch ser publicada."
    return 0
  fi

  step "Pull com rebase e autostash (${upstream})"
  if git pull --rebase --autostash; then
    ok "Sincronizacao concluida."
    return 0
  fi

  alert "Pull/rebase interrompido."
  operation_recovery_menu || true
  return 1
}

safe_push() {
  ensure_no_operation || return 1
  require_remote || return 1

  local branch=""
  local upstream=""
  branch="$(current_branch)"

  if protected_branch "$branch"; then
    alert "Voce esta na branch protegida '${branch}'."
    confirm "Enviar para o remote mesmo assim? [s/N] " || return 1
  fi

  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -z "$upstream" ]]; then
    step "Push com upstream para ${REMOTE}/${branch}"
    if git push -u "$REMOTE" "$branch"; then
      ok "Push concluido."
      return 0
    fi
  else
    step "Push para ${upstream}"
    if git push; then
      ok "Push concluido."
      return 0
    fi
  fi

  warn "Push falhou ou foi rejeitado."
  confirm "Tentar fetch + rebase + novo push? [s/N] " || return 1
  safe_pull_rebase || return 1

  step "Tentando push novamente"
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -z "$upstream" ]]; then
    if git push -u "$REMOTE" "$branch"; then
      ok "Push concluido apos sincronizacao."
      return 0
    fi
  else
    if git push; then
      ok "Push concluido apos sincronizacao."
      return 0
    fi
  fi

  alert "Push ainda falhou. Verifique permissao, protecao de branch ou conflitos remotos."
  return 1
}

parse_github_owner_repo() {
  local url="${1:-}"
  local cleaned=""
  cleaned="$url"
  cleaned="${cleaned#git@github.com:}"
  cleaned="${cleaned#ssh://git@github.com/}"
  cleaned="${cleaned#https://github.com/}"
  cleaned="${cleaned#http://github.com/}"
  cleaned="${cleaned%.git}"

  if [[ "$cleaned" == */* && "$cleaned" != "$url" ]]; then
    printf "%s\n" "$cleaned"
  fi
}

check_open_pr() {
  local branch="$1"
  local remote_url=""
  local full_name=""
  local api=""
  local resp=""
  local matches=""
  local auth_header=()

  [[ -n "${REMOTE:-}" ]] || return 0
  remote_url="$(git remote get-url "$REMOTE" 2>/dev/null || true)"
  full_name="$(parse_github_owner_repo "$remote_url")"

  if [[ -z "$full_name" ]]; then
    warn "Remote nao parece ser GitHub. Checagem de PR pulada."
    return 0
  fi

  if ! has_cmd curl || ! has_cmd jq; then
    warn "curl/jq nao encontrados. Checagem de PR pulada."
    return 0
  fi

  step "Verificando PRs abertos para ${full_name}:${branch}"
  api="https://api.github.com/repos/${full_name}/pulls?state=open&per_page=100"
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth_header=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
  fi

  resp="$(curl -fsS "${auth_header[@]}" "$api" 2>/dev/null || true)"
  if [[ -z "$resp" ]]; then
    warn "Falha ao consultar GitHub API. Checagem de PR pulada."
    return 0
  fi

  matches="$(jq --arg b "$branch" '[ .[] | select(.head.ref == $b) ]' <<< "$resp" 2>/dev/null || true)"
  if [[ -z "$matches" ]]; then
    warn "Resposta inesperada da GitHub API. Checagem de PR pulada."
    return 0
  fi

  if jq -e 'length > 0' <<< "$matches" >/dev/null; then
    alert "Ha PR aberto para '${branch}':"
    jq -r '.[].html_url' <<< "$matches"
    confirm "Prosseguir mesmo assim? [s/N] " || return 1
  else
    ok "Nenhum PR aberto encontrado para '${branch}'."
  fi
}

main_ref() {
  local main_branch="$1"

  if [[ -n "${REMOTE:-}" ]] && git show-ref --verify --quiet "refs/remotes/${REMOTE}/${main_branch}"; then
    printf "%s/%s\n" "$REMOTE" "$main_branch"
  elif local_branch_exists "$main_branch"; then
    printf "%s\n" "$main_branch"
  else
    return 1
  fi
}

switch_to_branch() {
  local branch="$1"
  if git switch "$branch" 2>/dev/null; then
    return 0
  fi

  git checkout "$branch"
}

ensure_clean_for_integration() {
  if has_any_changes; then
    warn "Existem alteracoes locais. Commit/stash antes de integrar com a branch principal."
    git status --short
    return 1
  fi
}

integrate_with_main() {
  ensure_no_operation || return 1
  require_remote || return 1
  ensure_clean_for_integration || return 1

  local original_branch=""
  local main_branch=""
  local base_ref=""
  local opt=""

  original_branch="$(current_branch)"
  main_branch="$(detect_main_branch)"

  fetch_prune || return 1
  base_ref="$(main_ref "$main_branch" || true)"
  if [[ -z "$base_ref" ]]; then
    warn "Nao encontrei '${main_branch}' local nem em ${REMOTE}."
    return 1
  fi

  say ""
  step "Integracao com '${main_branch}'"
  say "  1) Rebase da branch atual sobre ${base_ref}"
  say "  2) Merge de ${base_ref} na branch atual"
  say "  3) Merge da branch atual em ${main_branch}"
  say "  0) Pular"
  read -r -p "Escolha: " opt

  case "${opt:-}" in
    1)
      if [[ "$original_branch" == "$main_branch" ]]; then
        warn "Voce ja esta em '${main_branch}'."
        return 0
      fi
      step "Rebase de '${original_branch}' sobre '${base_ref}'"
      if git rebase "$base_ref"; then
        ok "Rebase concluido."
      else
        alert "Rebase interrompido por conflito."
        operation_recovery_menu || true
        return 1
      fi
      ;;
    2)
      if [[ "$original_branch" == "$main_branch" ]]; then
        warn "Voce ja esta em '${main_branch}'."
        return 0
      fi
      step "Merge de '${base_ref}' em '${original_branch}'"
      if git merge --no-ff "$base_ref"; then
        ok "Merge concluido."
      else
        alert "Merge interrompido por conflito."
        operation_recovery_menu || true
        return 1
      fi
      ;;
    3)
      if [[ "$original_branch" == "$main_branch" ]]; then
        warn "Voce ja esta em '${main_branch}'."
        return 0
      fi
      check_open_pr "$original_branch" || return 1
      alert "Isto mesclara '${original_branch}' em '${main_branch}'."
      confirm "Confirmar merge na branch principal? [s/N] " || return 1

      if ! local_branch_exists "$main_branch"; then
        if remote_branch_exists "$main_branch"; then
          git switch -c "$main_branch" --track "${REMOTE}/${main_branch}" 2>/dev/null || git checkout -t "${REMOTE}/${main_branch}"
        else
          warn "Branch principal '${main_branch}' nao encontrada."
          return 1
        fi
      else
        switch_to_branch "$main_branch"
      fi

      git pull --ff-only "$REMOTE" "$main_branch" || return 1
      if git merge --no-ff "$original_branch"; then
        ok "Merge em '${main_branch}' concluido."
      else
        alert "Conflitos ao mesclar em '${main_branch}'. Resolva antes de voltar."
        operation_recovery_menu || true
        return 1
      fi

      if confirm_yes "Push de '${main_branch}' para ${REMOTE}? [S/n] "; then
        git push "$REMOTE" "$main_branch"
        ok "Branch principal enviada."
      fi

      switch_to_branch "$original_branch"
      ok "Retornado para '${original_branch}'."
      ;;
    0)
      warn "Integracao pulada."
      ;;
    *)
      warn "Opcao invalida."
      ;;
  esac
}

create_commit_if_needed() {
  local branch="$1"
  local message="$2"
  local prefix=""
  local final_message=""

  if ! has_any_changes; then
    warn "Nenhuma alteracao detectada no working tree/index."
    confirm "Continuar apenas com sincronizacao/push? [s/N] " || return 1
    return 0
  fi

  if [[ -z "$message" ]]; then
    say ""
    read -r -p "$(printf "%b" "${YELLOW}Mensagem de commit (vazio = 'Auto commit'): ${RESET}")" message || true
    message="${message:-Auto commit}"
  fi

  prefix="$(commit_prefix_from_branch "$branch")"
  final_message="$message"
  if [[ -n "$prefix" && "$final_message" != "$prefix"* ]]; then
    final_message="${prefix}${final_message}"
  fi

  say ""
  step "Mensagem final: ${BOLD}${final_message}${RESET}"

  if confirm_yes "Adicionar tudo com protecao de .env? [S/n] "; then
    stage_all_safe || return 1
  else
    warn "Stage automatico pulado. Usarei apenas o que ja estiver staged."
    unstage_sensitive_files
  fi

  if ! has_staged_changes; then
    warn "Nao ha alteracoes staged para commit."
    return 0
  fi

  if ! confirm_yes "Criar commit com essa mensagem? [S/n] "; then
    warn "Commit pulado."
    return 0
  fi

  step "Criando commit"
  if git commit -m "$final_message"; then
    ok "Commit criado."
  else
    alert "Commit falhou. Verifique hooks, conflitos ou arquivos staged."
    return 1
  fi
}

# ==== Fluxo principal ====
ensure_no_operation || die "Resolva a operacao Git pendente antes de continuar."
ensure_named_branch || die "Branch nomeada e obrigatoria para este fluxo."

BRANCH="$(current_branch)"
MAIN_BRANCH="$(detect_main_branch)"

print_repo_header "$BRANCH"

if protected_branch "$BRANCH"; then
  alert "Voce esta na branch protegida: ${BRANCH}"
  confirm "Tem certeza que deseja commitar/push nessa branch? [s/N] " || die "Operacao abortada."
fi

print_status_summary
create_commit_if_needed "$BRANCH" "$MESSAGE" || die "Fluxo de commit interrompido."

say ""
if confirm_yes "Sincronizar com upstream antes do push? [S/n] "; then
  safe_pull_rebase || die "Sincronizacao interrompida."
else
  warn "Sincronizacao pulada."
fi

show_ahead_behind

say ""
if confirm "Integrar com '${MAIN_BRANCH}' agora? [s/N] "; then
  integrate_with_main || die "Integracao interrompida."
else
  warn "Integracao com '${MAIN_BRANCH}' pulada."
fi

BRANCH="$(current_branch)"
say ""
if confirm_yes "Executar push da branch atual (${BRANCH})? [S/n] "; then
  safe_push || die "Push interrompido."
else
  warn "Push pulado."
fi

say ""
if confirm "Executar pull final --ff-only para conferir sincronizacao? [s/N] "; then
  if git pull --ff-only; then
    ok "Pull final concluido."
  else
    warn "Pull final nao foi fast-forward. Nenhum merge automatico foi criado."
  fi
else
  warn "Pull final pulado."
fi

say ""
ok "Fluxo encerrado na branch $(display_branch)."
