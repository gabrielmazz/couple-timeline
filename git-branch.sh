#!/usr/bin/env bash
# git-branch.sh — Branch wizard (v3 robust)

set -o errexit
set -o pipefail
set -o nounset

# ==== Cores/UI ====
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()    { echo -e "${GREEN}✔${RESET} $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET} $*"; }
alert() { echo -e "${BOLD}${RED}⛔ $*${RESET}"; }
step()  { echo -e "${CYAN}${BOLD}▶ $*${RESET}"; }

confirm() {
  local prompt="${1:-Continuar? [s/N]} "
  read -r -p "$(echo -e "${YELLOW}${prompt}${RESET}")" ans || true
  [[ "${ans:-}" =~ ^([sS]([iI][mM])?|y|Y)$ ]]
}
has_cmd() { command -v "$1" >/dev/null 2>&1; }

# ==== Git checks ====
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { alert "Não é um repo Git."; exit 1; }
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
if git remote | grep -qxF origin; then
  REMOTE="origin"
else
  REMOTE="$(git remote | head -n1 || echo origin)"
fi
current_branch() { git rev-parse --abbrev-ref HEAD; }

# ==== Sanitização ====
sanitize_branch_name() {
  local raw="$1"
  local no_accents
  no_accents=$(echo "$raw" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || echo "$raw")
  local safe
  safe=$(echo "$no_accents" | sed -E 's/[^a-zA-Z0-9._-]+/-/g' | sed -E 's/-+/-/g; s/^-//; s/-$//')
  if [[ "$safe" == *"-"* ]]; then
    local head="${safe%%-*}"
    local tail="${safe#*-}"
    echo "${head}-$(echo "$tail" | tr '[:upper:]' '[:lower:]')"
  else
    echo "$safe"
  fi
}

# ==== Listas (sempre limpando \r) ====
list_local_branches_raw() {
  git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/heads | tr -d '\r'
}
list_remote_branches_raw() {
  # só entradas REMOTAS válidas: REMOTE/<nome>, sem “HEAD -> …”, sem a linha 'origin'
  git for-each-ref --sort=-committerdate --format='%(refname:short)' "refs/remotes/${REMOTE}" \
    | tr -d '\r' \
    | grep -E "^${REMOTE}/" \
    | grep -v "HEAD ->" \
    | sed "s#^${REMOTE}/##"
}
list_for_switch_menu() {
  local locals remotes
  mapfile -t locals  < <(list_local_branches_raw  | sed '/^[[:space:]]*$/d' || true)
  mapfile -t remotes < <(list_remote_branches_raw | sed '/^[[:space:]]*$/d' || true)

  # set para deduplicar remotas que já existem localmente
  local tmpfile; tmpfile="$(mktemp)"
  printf "%s\n" "${locals[@]}" > "$tmpfile"

  local out=()
  local name
  for name in "${locals[@]}";  do [[ -n "$name" ]] && out+=("$name"); done
  for name in "${remotes[@]}"; do
    [[ -z "$name" ]] && continue
    if ! grep -qxF "$name" "$tmpfile"; then
      out+=("$name [remota]")
    fi
  done
  rm -f "$tmpfile"

  # remove vazias/duplicadas e imprime uma por linha
  awk 'NF && !seen[$0]++' < <(printf "%s\n" "${out[@]}")
}


# ==== Seleção robusta (sem fzf) ====
choose_from_list() {
  local title="$1"; shift
  local items=("$@")
  [[ ${#items[@]} -gt 0 ]] || { warn "Nada para selecionar."; return 1; }

  if command -v fzf >/dev/null 2>&1; then
    printf "%s\n" "${items[@]}" | fzf --prompt="$title > " --height=20 --reverse
  else
    echo -e "${BOLD}${title}${RESET}"
    local PS3="Escolha: "
    local opt
    select opt in "${items[@]}"; do
      if [[ -n "$opt" ]]; then
        echo "$opt"
        break
      else
        warn "Opção inválida."
      fi
    done
  fi
}


# ==== Ações ====
fetch_prune() {
  step "Sincronizando remotos (fetch --all --prune)…"
  git fetch --all --prune
  ok "Remotos sincronizados."
}
create_branch() {
  step "Criar branch"
  read -r -p "Nome da nova branch: " rawname
  [[ -n "${rawname}" ]] || { alert "Nome inválido."; return; }
  local name; name="$(sanitize_branch_name "$rawname")"
  step "Nome normalizado: ${BLUE}${name}${RESET}"

  local base="$(current_branch)"
  if confirm "Usar base diferente da atual (${base})? [s/N] "; then
    local bases=(); mapfile -t bases < <(list_local_branches_raw || true)
    if [[ ${#bases[@]} -gt 0 ]]; then
      base="$(choose_from_list 'Escolha a base' "${bases[@]}")" || base="$(current_branch)"
    fi
  fi

  step "Criando '${name}' a partir de '${base}'"
  git checkout -b "$name" "$base"
  ok "Local criada e ativada."
  step "Publicando em ${REMOTE} (upstream)"
  git push -u "${REMOTE}" "$name"
  ok "Upstream configurado."
}
switch_branch() {
  fetch_prune
  step "Trocar de branch"

  # monta a lista (locais + remotas [remota])
  local options=()
  mapfile -t options < <(list_for_switch_menu || true)

  if [[ ${#options[@]} -eq 0 ]]; then
    warn "Nenhuma branch disponível (local ou remota)."
    return
  fi

  # imprime lista numerada (sem confundir com o prompt)
  echo -e "${BOLD}Branches disponíveis:${RESET}"
  local i
  for (( i=0; i<${#options[@]}; i++ )); do
    printf "%2d) %s\n" $((i+1)) "${options[$i]}"
  done

  # leitura robusta (ignora lixo, só aceita intervalo válido)
  local idx=""
  while true; do
    read -r -p "Escolha [1-${#options[@]}]: " idx
    [[ "$idx" =~ ^[0-9]+$ ]] && (( idx>=1 && idx<=${#options[@]} )) && break
    warn "Índice inválido."
  done

  local pick="${options[$((idx-1))]}"
  # remove sufixo " [remota]" se existir
  local target="${pick%% *}"

  # short-circuit se já está nela
  if [[ "$target" == "$(current_branch)" ]]; then
    warn "Você já está em '${target}'."
    return
  fi

  # existe local?
  if git show-ref --verify --quiet "refs/heads/${target}"; then
    step "Checkout local → ${target}"
    git checkout "$target"
    ok "Agora em ${target}."
    return
  fi

  # existe apenas no remoto?
  if git show-ref --verify --quiet "refs/remotes/${REMOTE}/${target}"; then
    step "Criando branch local com tracking de ${REMOTE}/${target} e trocando…"
    if git switch -c "$target" --track "${REMOTE}/${target}" 2>/dev/null; then
      ok "Agora em ${target} (tracking)."
    else
      git checkout -t "${REMOTE}/${target}"
      ok "Agora em ${target} (tracking)."
    fi
    return
  fi

  # não existe em lugar nenhum → oferecer criar/publicar
  warn "Branch '${target}' não existe local nem no remoto."
  if confirm "Criar a partir da atual ($(current_branch)) e publicar? [s/N] "; then
    git checkout -b "$target"
    git push -u "${REMOTE}" "$target"
    ok "Criada e publicada. Agora em ${target}."
  else
    warn "Operação cancelada."
  fi
}

delete_branch_local() {
  step "Excluir branch local"
  local locals=(); mapfile -t locals < <(list_local_branches_raw | grep -v "^$(current_branch)\$" || true)
  [[ ${#locals[@]} -gt 0 ]] || { warn "Nada para excluir (exceto a atual)."; return; }
  local pick; pick="$(choose_from_list 'Excluir local' "${locals[@]}")" || return
  if confirm "Excluir '${pick}' (git branch -d)? [s/N] "; then
    set +e; git branch -d "$pick"; local st=$?; set -e
    if [[ $st -ne 0 ]]; then
      confirm "Falhou com -d. Forçar (-D)? [s/N] " && git branch -D "$pick"
    fi
    ok "Excluída."
  fi
}
delete_branch_remote() {
  step "Excluir branch remota em ${REMOTE}"
  local remotes=(); mapfile -t remotes < <(list_remote_branches_raw || true)
  [[ ${#remotes[@]} -gt 0 ]] || { warn "Nenhuma remota encontrada."; return; }
  local pick; pick="$(choose_from_list "Excluir no remoto (${REMOTE})" "${remotes[@]}")" || return
  alert "Apagará ${REMOTE}/${pick} no servidor."
  confirm "Confirmar? [s/N] " || return
  git push "${REMOTE}" --delete "$pick"
  ok "Remota excluída."
}
rename_branch() {
  step "Renomear branch"
  local locals=(); mapfile -t locals < <(list_local_branches_raw || true)
  [[ ${#locals[@]} -gt 0 ]] || { warn "Nenhuma branch local."; return; }
  local old; old="$(choose_from_list 'Escolha a branch' "${locals[@]}")" || return
  read -r -p "Novo nome: " rawnew; [[ -n "$rawnew" ]] || { alert "Nome inválido."; return; }
  local new; new="$(sanitize_branch_name "$rawnew")"; step "Normalizado: ${BLUE}${new}${RESET}"
  git branch -m "$old" "$new"; ok "Renomeada ${old} → ${new}."
  if confirm "Atualizar remoto? (push -u e remover antiga) [s/N] "; then
    git push -u "${REMOTE}" "$new"
    if git ls-remote --heads "${REMOTE}" "$old" >/dev/null 2>&1; then git push "${REMOTE}" --delete "$old" || true; fi
    ok "Remoto atualizado."
  fi
}
set_upstream() {
  step "Configurar upstream"
  local locals=(); mapfile -t locals < <(list_local_branches_raw || true)
  local pick; pick="$(choose_from_list 'Branch local' "${locals[@]}")" || return
  read -r -p "Nome remoto (default = ${pick}): " rb; rb="${rb:-$pick}"
  git branch --set-upstream-to="${REMOTE}/${rb}" "$pick" 2>/dev/null || { warn "Sem upstream. Fazendo push -u…"; git push -u "${REMOTE}" "$pick"; }
  ok "Upstream definido."
}
restore_branch() {
  step "Restaurar branch (reflog)"
  echo -e "1) Escolher pelo reflog\n2) Informar commit"
  read -r -p "Escolha [1/2]: " mode
  local commit=""
  if [[ "$mode" == "1" ]]; then
    local lines; mapfile -t lines < <(git reflog --date=iso --max-count=200 | nl -ba | tr -d '\r')
    [[ ${#lines[@]} -gt 0 ]] || { warn "Reflog vazio."; return; }
    local pick; pick="$(choose_from_list 'Entrada do reflog' "${lines[@]}")" || return
    commit="$(echo "$pick" | awk '{print $2}')"
  else
    read -r -p "Hash/commit: " commit
  fi
  [[ -n "$commit" ]] || { alert "Commit inválido."; return; }
  read -r -p "Nome da branch: " rawname; [[ -n "$rawname" ]] || { alert "Nome inválido."; return; }
  local name; name="$(sanitize_branch_name "$rawname")"; step "Normalizado: ${BLUE}${name}${RESET}"
  git branch "$name" "$commit"; ok "Criada '${name}' em ${commit}."
  confirm "Trocar para '${name}' agora? [s/N] " && git checkout "$name"
}
show_graph() { step "Gráfico (50 commits)"; git log --oneline --decorate --graph --all -n 50; }

list_menu() {
  fetch_prune
  step "Locais";  list_local_branches_raw  || true
  echo; step "Remotas (${REMOTE})"; list_remote_branches_raw || true
  echo; step "Stale (rastros no local de remotas apagadas)"
  git remote prune "${REMOTE}" --dry-run | sed 's/^ *//' || true
}

# ==== Menu ====
while true; do
  BRANCH="$(current_branch)"
  echo; echo -e "${BOLD}Repo:${RESET} ${REPO_NAME}  ${BOLD}Branch:${RESET} ${BLUE}${BRANCH}${RESET}"
  echo -e "${BOLD}Menu:${RESET}
  1) Criar branch (publica no remoto)
  2) Trocar de branch (local/remota)
  3) Listar (locais, remotas e stale)
  4) Excluir branch local
  5) Excluir branch remota
  6) Renomear branch
  7) Definir upstream
  8) Restaurar branch (reflog)
  9) Ver gráfico de branches
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
    0) echo "Até mais!"; exit 0 ;;
    *) warn "Opção inválida." ;;
  esac
done
