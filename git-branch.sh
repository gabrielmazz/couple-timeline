#!/usr/bin/env bash
# git-branch.sh - Assistente robusto para branches Git.

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
REPO_NAME="$(basename "$REPO_ROOT")"

detect_remote() {
  if git remote | grep -qxF origin; then
    printf "origin\n"
    return 0
  fi

  git remote | head -n1 || true
}

REMOTE="$(detect_remote)"
AUTO_STASHED=0
AUTO_STASH_LABEL=""

refresh_remote() {
  REMOTE="$(detect_remote)"
}

require_remote() {
  refresh_remote
  if [[ -z "${REMOTE:-}" ]]; then
    warn "Nenhum remote configurado neste repositorio."
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

require_named_branch() {
  local branch
  branch="$(current_branch)"
  if [[ -z "$branch" ]]; then
    warn "Voce esta em detached HEAD. Crie ou troque para uma branch antes desta operacao."
    return 1
  fi
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
      warn "A operacao '${op}' nao suporta skip por este assistente."
      return 1
      ;;
  esac
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
    say "  2) Marcar tudo como resolvido (git add -A) e continuar"
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
        confirm "Rodar 'git add -A' e continuar '${op}'? [s/N] " || continue
        git add -A
        if continue_operation; then
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
    warn "Ainda ha '${op}' em andamento. Operacao cancelada por seguranca."
    return 1
  fi
}

working_tree_dirty() {
  [[ -n "$(git status --porcelain)" ]]
}

handle_dirty_worktree() {
  AUTO_STASHED=0
  AUTO_STASH_LABEL=""

  if ! working_tree_dirty; then
    return 0
  fi

  say ""
  warn "Existem alteracoes locais que podem bloquear troca/criacao de branch."
  git status --short

  while true; do
    say ""
    say "  1) Criar stash automatico incluindo arquivos nao rastreados"
    say "  2) Continuar sem stash"
    say "  0) Cancelar"
    read -r -p "Escolha: " opt

    case "${opt:-}" in
      1)
        AUTO_STASH_LABEL="auto-stash git-branch.sh $(date +%Y%m%d-%H%M%S)"
        git stash push -u -m "$AUTO_STASH_LABEL"
        AUTO_STASHED=1
        ok "Stash criado: ${AUTO_STASH_LABEL}"
        return 0
        ;;
      2)
        warn "Continuando com alteracoes locais."
        return 0
        ;;
      0)
        warn "Operacao cancelada."
        return 1
        ;;
      *)
        warn "Opcao invalida."
        ;;
    esac
  done
}

restore_auto_stash() {
  if [[ "$AUTO_STASHED" -ne 1 ]]; then
    return 0
  fi

  say ""
  if confirm "Reaplicar o stash automatico agora? [s/N] "; then
    if git stash pop --index stash@{0}; then
      ok "Stash automatico reaplicado."
    else
      alert "Falha ao reaplicar stash. Resolva os conflitos e use 'git stash list' se precisar."
      show_conflicts
      return 1
    fi
  else
    warn "Stash mantido. Veja com: git stash list"
  fi

  AUTO_STASHED=0
}

# ==== Branch helpers ====
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

prompt_branch_name() {
  local prompt="${1:-Nome da branch: }"
  local raw=""
  local name=""

  while true; do
    read -r -p "$prompt" raw
    if [[ -z "${raw:-}" ]]; then
      alert "Nome vazio."
      continue
    fi

    name="$(sanitize_branch_name "$raw")"
    if [[ "$name" != "$raw" ]]; then
      step "Nome normalizado: ${BLUE}${name}${RESET}" >&2
    fi

    if valid_branch_name "$name"; then
      printf "%s\n" "$name"
      return 0
    fi

    alert "Nome de branch invalido para Git: '${name}'"
  done
}

local_branch_exists() {
  git show-ref --verify --quiet "refs/heads/$1"
}

remote_branch_exists() {
  require_remote || return 1
  git show-ref --verify --quiet "refs/remotes/${REMOTE}/$1" \
    || git ls-remote --exit-code --heads "$REMOTE" "refs/heads/$1" >/dev/null 2>&1
}

list_local_branches_raw() {
  git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/heads | tr -d '\r'
}

list_remote_branches_raw() {
  require_remote || return 0
  git for-each-ref --sort=-committerdate --format='%(refname:short)' "refs/remotes/${REMOTE}" \
    | tr -d '\r' \
    | sed "s#^${REMOTE}/##" \
    | grep -v '^HEAD$' \
    | sed '/^[[:space:]]*$/d' || true
}

list_for_switch_menu() {
  local locals=()
  local remotes=()
  local local_tmp
  local name=""

  mapfile -t locals < <(list_local_branches_raw | sed '/^[[:space:]]*$/d' || true)
  mapfile -t remotes < <(list_remote_branches_raw | sed '/^[[:space:]]*$/d' || true)

  local_tmp="$(mktemp)"
  printf "%s\n" "${locals[@]}" > "$local_tmp"

  for name in "${locals[@]}"; do
    [[ -n "$name" ]] && printf "%s\n" "$name"
  done

  for name in "${remotes[@]}"; do
    [[ -z "$name" ]] && continue
    if ! grep -qxF "$name" "$local_tmp"; then
      printf "%s [remota]\n" "$name"
    fi
  done

  rm -f "$local_tmp"
}

choose_from_list() {
  local title="$1"
  shift
  local items=("$@")
  local selected=""

  if [[ "${#items[@]}" -eq 0 ]]; then
    warn "Nada para selecionar."
    return 1
  fi

  if has_cmd fzf; then
    selected="$(printf "%s\n" "${items[@]}" | fzf --prompt="$title > " --height=20 --reverse)" || return 1
    [[ -n "$selected" ]] || return 1
    printf "%s\n" "$selected"
    return 0
  fi

  say "${BOLD}${title}${RESET}" >&2
  local PS3="Escolha: "
  local opt=""
  select opt in "${items[@]}"; do
    if [[ -n "$opt" ]]; then
      printf "%s\n" "$opt"
      return 0
    fi
    warn "Opcao invalida."
  done
}

fetch_prune() {
  if ! require_remote; then
    return 1
  fi

  step "Sincronizando ${REMOTE} (fetch --prune)"
  git fetch "$REMOTE" --prune
  ok "Remote sincronizado."
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
  case "$1" in
    main|master|develop|production|release)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

safe_switch() {
  local target="$1"
  if git switch "$target" 2>/dev/null; then
    return 0
  fi

  git checkout "$target"
}

safe_switch_create() {
  local name="$1"
  local base="$2"
  if git switch -c "$name" "$base" 2>/dev/null; then
    return 0
  fi

  git checkout -b "$name" "$base"
}

choose_base_ref() {
  local current
  current="$(display_branch)"

  while true; do
    say "" >&2
    say "${BOLD}Base da nova branch:${RESET}" >&2
    say "  1) Atual (${current})" >&2
    say "  2) Branch local" >&2
    say "  3) Branch remota" >&2
    say "  4) Commit, tag ou ref manual" >&2
    read -r -p "Escolha [1-4]: " base_opt

    case "${base_opt:-}" in
      1)
        printf "HEAD\n"
        return 0
        ;;
      2)
        local locals=()
        local pick=""
        mapfile -t locals < <(list_local_branches_raw || true)
        pick="$(choose_from_list "Escolha a branch local base" "${locals[@]}")" || continue
        printf "%s\n" "$pick"
        return 0
        ;;
      3)
        fetch_prune >&2 || continue
        local remotes=()
        local pick=""
        mapfile -t remotes < <(list_remote_branches_raw || true)
        pick="$(choose_from_list "Escolha a branch remota base" "${remotes[@]}")" || continue
        printf "%s/%s\n" "$REMOTE" "$pick"
        return 0
        ;;
      4)
        local ref=""
        read -r -p "Commit/tag/ref: " ref
        if git rev-parse --verify "${ref}^{commit}" >/dev/null 2>&1; then
          printf "%s\n" "$ref"
          return 0
        fi
        warn "Ref invalida: ${ref}"
        ;;
      *)
        warn "Opcao invalida."
        ;;
    esac
  done
}

publish_branch() {
  local branch="$1"

  if ! require_remote; then
    warn "Branch criada apenas localmente."
    return 0
  fi

  if remote_branch_exists "$branch"; then
    warn "Ja existe ${REMOTE}/${branch}. Configurando upstream se possivel."
    git fetch "$REMOTE" "refs/heads/${branch}:refs/remotes/${REMOTE}/${branch}" >/dev/null 2>&1 || true
    git branch --set-upstream-to="${REMOTE}/${branch}" "$branch"
    return 0
  fi

  step "Publicando '${branch}' em ${REMOTE}"
  git push -u "$REMOTE" "HEAD:refs/heads/${branch}"
  ok "Upstream configurado."
}

# ==== Acoes ====
create_branch() {
  ensure_no_operation || return

  step "Criar branch"
  local name=""
  local base=""
  name="$(prompt_branch_name "Nome da nova branch: ")"

  if local_branch_exists "$name"; then
    warn "A branch local '${name}' ja existe."
    confirm "Trocar para ela agora? [s/N] " && switch_to_branch "$name"
    return
  fi

  if remote_branch_exists "$name"; then
    warn "A branch '${name}' ja existe no remote ${REMOTE}."
    confirm "Criar branch local rastreando ${REMOTE}/${name}? [s/N] " || return
    handle_dirty_worktree || return
    git fetch "$REMOTE" "refs/heads/${name}:refs/remotes/${REMOTE}/${name}" >/dev/null 2>&1 || true
    if git switch --track "${REMOTE}/${name}" 2>/dev/null || git checkout -t "${REMOTE}/${name}"; then
      ok "Agora em ${name}."
      restore_auto_stash || true
    fi
    return
  fi

  base="$(choose_base_ref)"
  handle_dirty_worktree || return

  step "Criando '${name}' a partir de '${base}'"
  safe_switch_create "$name" "$base"
  ok "Branch local criada e ativada."

  if confirm_yes "Publicar '${name}' no remote agora? [S/n] "; then
    publish_branch "$name"
  else
    warn "Publicacao pulada. Para publicar depois: git push -u ${REMOTE:-origin} ${name}"
  fi

  restore_auto_stash || true
}

switch_to_branch() {
  local target="$1"
  local current
  current="$(current_branch)"

  if [[ -n "$current" && "$target" == "$current" ]]; then
    warn "Voce ja esta em '${target}'."
    return 0
  fi

  handle_dirty_worktree || return

  if local_branch_exists "$target"; then
    step "Trocando para branch local '${target}'"
    safe_switch "$target"
    ok "Agora em ${target}."
    restore_auto_stash || true
    return
  fi

  if remote_branch_exists "$target"; then
    step "Criando branch local rastreando ${REMOTE}/${target}"
    if git switch --track "${REMOTE}/${target}" 2>/dev/null || git checkout -t "${REMOTE}/${target}"; then
      ok "Agora em ${target}."
      restore_auto_stash || true
      return
    fi
  fi

  warn "Branch '${target}' nao encontrada."
  restore_auto_stash || true
}

switch_branch() {
  ensure_no_operation || return
  fetch_prune || true

  step "Trocar de branch"
  local options=()
  local pick=""
  local target=""

  mapfile -t options < <(list_for_switch_menu | awk 'NF && !seen[$0]++' || true)

  if [[ "${#options[@]}" -eq 0 ]]; then
    warn "Nenhuma branch disponivel."
    return
  fi

  pick="$(choose_from_list "Branches disponiveis" "${options[@]}")" || return
  target="${pick% [remota]}"
  switch_to_branch "$target"
}

delete_branch_local() {
  ensure_no_operation || return

  step "Excluir branch local"
  local current
  local locals=()
  local pick=""
  current="$(current_branch)"

  mapfile -t locals < <(list_local_branches_raw | grep -vxF "${current:-}" || true)
  [[ "${#locals[@]}" -gt 0 ]] || { warn "Nada para excluir alem da branch atual."; return; }

  pick="$(choose_from_list "Excluir branch local" "${locals[@]}")" || return
  if protected_branch "$pick"; then
    alert "'${pick}' parece ser branch protegida."
    confirm "Excluir mesmo assim? [s/N] " || return
  fi

  if confirm "Excluir '${pick}' com seguranca (git branch -d)? [s/N] "; then
    if git branch -d "$pick"; then
      ok "Branch local excluida."
    else
      warn "A branch nao esta totalmente mesclada ou esta bloqueada."
      confirm "Forcar exclusao com 'git branch -D ${pick}'? [s/N] " || return
      git branch -D "$pick"
      ok "Branch local excluida com force."
    fi
  fi
}

delete_branch_remote() {
  ensure_no_operation || return
  fetch_prune || return

  step "Excluir branch remota em ${REMOTE}"
  local remotes=()
  local pick=""

  mapfile -t remotes < <(list_remote_branches_raw || true)
  [[ "${#remotes[@]}" -gt 0 ]] || { warn "Nenhuma branch remota encontrada."; return; }

  pick="$(choose_from_list "Excluir no remote (${REMOTE})" "${remotes[@]}")" || return
  if protected_branch "$pick"; then
    alert "'${pick}' parece ser branch protegida."
    confirm "Excluir do servidor mesmo assim? [s/N] " || return
  fi

  alert "Isto apagara ${REMOTE}/${pick} no servidor."
  confirm "Confirmar exclusao remota? [s/N] " || return
  git push "$REMOTE" --delete "$pick"
  ok "Branch remota excluida."
}

rename_branch() {
  ensure_no_operation || return

  step "Renomear branch"
  local locals=()
  local old=""
  local new=""

  mapfile -t locals < <(list_local_branches_raw || true)
  [[ "${#locals[@]}" -gt 0 ]] || { warn "Nenhuma branch local."; return; }

  old="$(choose_from_list "Escolha a branch local" "${locals[@]}")" || return
  if protected_branch "$old"; then
    alert "'${old}' parece ser branch protegida."
    confirm "Renomear mesmo assim? [s/N] " || return
  fi

  new="$(prompt_branch_name "Novo nome: ")"
  if local_branch_exists "$new"; then
    warn "Ja existe branch local '${new}'."
    return
  fi

  git branch -m "$old" "$new"
  ok "Renomeada: ${old} -> ${new}"

  if require_remote && confirm "Atualizar remote? (push -u nova e remover antiga) [s/N] "; then
    git push -u "$REMOTE" "$new"
    if git ls-remote --exit-code --heads "$REMOTE" "refs/heads/${old}" >/dev/null 2>&1; then
      confirm "Remover ${REMOTE}/${old}? [s/N] " && git push "$REMOTE" --delete "$old"
    fi
    ok "Remote atualizado."
  fi
}

set_upstream() {
  ensure_no_operation || return
  fetch_prune || return

  step "Configurar upstream"
  local locals=()
  local remotes=()
  local local_pick=""
  local remote_pick=""

  mapfile -t locals < <(list_local_branches_raw || true)
  local_pick="$(choose_from_list "Branch local" "${locals[@]}")" || return

  mapfile -t remotes < <(list_remote_branches_raw || true)
  if [[ "${#remotes[@]}" -gt 0 ]]; then
    remote_pick="$(choose_from_list "Branch remota para tracking" "${remotes[@]}")" || return
  else
    remote_pick="$local_pick"
  fi

  if remote_branch_exists "$remote_pick"; then
    git branch --set-upstream-to="${REMOTE}/${remote_pick}" "$local_pick"
    ok "Upstream definido: ${local_pick} -> ${REMOTE}/${remote_pick}"
    return
  fi

  warn "${REMOTE}/${remote_pick} nao existe."
  confirm "Publicar '${local_pick}' como '${remote_pick}' e configurar upstream? [s/N] " || return
  git push -u "$REMOTE" "${local_pick}:refs/heads/${remote_pick}"
  ok "Upstream criado e definido."
}

restore_branch() {
  ensure_no_operation || return

  step "Restaurar branch"
  local mode=""
  local commit=""
  local name=""

  say "  1) Escolher pelo reflog"
  say "  2) Informar commit/tag/ref"
  read -r -p "Escolha [1/2]: " mode

  if [[ "$mode" == "1" ]]; then
    local lines=()
    local pick=""
    mapfile -t lines < <(git reflog --date=iso --max-count=200 | nl -ba | tr -d '\r' || true)
    [[ "${#lines[@]}" -gt 0 ]] || { warn "Reflog vazio."; return; }
    pick="$(choose_from_list "Entrada do reflog" "${lines[@]}")" || return
    commit="$(awk '{print $2}' <<< "$pick")"
  else
    read -r -p "Commit/tag/ref: " commit
  fi

  if ! git rev-parse --verify "${commit}^{commit}" >/dev/null 2>&1; then
    alert "Commit invalido: ${commit}"
    return
  fi

  name="$(prompt_branch_name "Nome da branch restaurada: ")"
  if local_branch_exists "$name"; then
    warn "Ja existe branch local '${name}'."
    return
  fi

  git branch "$name" "$commit"
  ok "Branch '${name}' criada em ${commit}."
  confirm "Trocar para '${name}' agora? [s/N] " && switch_to_branch "$name"
}

sync_current_branch() {
  ensure_no_operation || return
  require_named_branch || return
  fetch_prune || return

  local branch
  local upstream=""
  branch="$(current_branch)"
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"

  if [[ -z "$upstream" ]]; then
    if remote_branch_exists "$branch"; then
      git fetch "$REMOTE" "refs/heads/${branch}:refs/remotes/${REMOTE}/${branch}" >/dev/null 2>&1 || true
      git branch --set-upstream-to="${REMOTE}/${branch}" "$branch"
      upstream="${REMOTE}/${branch}"
      ok "Upstream configurado: ${upstream}"
    else
      warn "Branch atual nao possui upstream e ${REMOTE}/${branch} nao existe."
      confirm "Publicar agora com upstream? [s/N] " || return
      git push -u "$REMOTE" "$branch"
      ok "Branch publicada."
      return
    fi
  fi

  step "Rebase da branch atual sobre '${upstream}' com autostash"
  if git pull --rebase --autostash; then
    ok "Branch sincronizada."
  else
    alert "Rebase/pull interrompido."
    operation_recovery_menu || true
  fi
}

push_current_branch() {
  ensure_no_operation || return
  require_named_branch || return
  require_remote || return

  local branch
  branch="$(current_branch)"

  if protected_branch "$branch"; then
    alert "Voce esta na branch protegida '${branch}'."
    confirm "Enviar para o remote mesmo assim? [s/N] " || return
  fi

  if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
    step "Push da branch atual"
    if git push; then
      ok "Push concluido."
      return
    fi
  else
    step "Push com upstream para ${REMOTE}/${branch}"
    if git push -u "$REMOTE" "$branch"; then
      ok "Push concluido."
      return
    fi
  fi

  warn "Push rejeitado ou falhou."
  if confirm "Tentar fetch + rebase + novo push? [s/N] "; then
    sync_current_branch || return
    git push
    ok "Push concluido apos sincronizacao."
  fi
}

show_graph() {
  step "Grafico de branches (ultimos 60 commits)"
  git log --oneline --decorate --graph --all -n 60
}

list_menu() {
  fetch_prune || true

  say ""
  step "Branches locais"
  list_local_branches_raw || true

  say ""
  if [[ -n "${REMOTE:-}" ]]; then
    step "Branches remotas (${REMOTE})"
    list_remote_branches_raw || true

    say ""
    step "Stale refs (${REMOTE})"
    git remote prune "$REMOTE" --dry-run | sed 's/^ *//' || true
  else
    warn "Sem remote configurado."
  fi
}

# ==== Menu ====
if [[ "$(git_operation)" != "none" ]]; then
  operation_recovery_menu || true
fi

while true; do
  refresh_remote
  BRANCH="$(display_branch)"
  MAIN_BRANCH="$(detect_main_branch)"

  say ""
  say "${BOLD}Repo:${RESET} ${REPO_NAME}  ${BOLD}Branch:${RESET} ${BLUE}${BRANCH}${RESET}  ${BOLD}Remote:${RESET} ${REMOTE:-nenhum}  ${BOLD}Principal:${RESET} ${MAIN_BRANCH}"
  say "${BOLD}Menu:${RESET}
  1) Criar branch
  2) Trocar de branch
  3) Listar branches e stale refs
  4) Excluir branch local
  5) Excluir branch remota
  6) Renomear branch
  7) Definir upstream
  8) Restaurar branch pelo reflog/commit
  9) Ver grafico de branches
 10) Sincronizar branch atual (pull --rebase --autostash)
 11) Push da branch atual
 12) Resolver rebase/merge/cherry-pick/revert pendente
  0) Sair"

  read -r -p "Escolha: " opt
  case "${opt:-}" in
    1) create_branch ;;
    2) switch_branch ;;
    3) list_menu ;;
    4) delete_branch_local ;;
    5) delete_branch_remote ;;
    6) rename_branch ;;
    7) set_upstream ;;
    8) restore_branch ;;
    9) show_graph ;;
    10) sync_current_branch ;;
    11) push_current_branch ;;
    12) operation_recovery_menu || true ;;
    0) say "Ate mais."; exit 0 ;;
    *) warn "Opcao invalida." ;;
  esac
done
