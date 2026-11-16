# Leva as mudanças da `main` para o repositório da organização (remoto `org`), sempre "limpas":
# sem CLAUDE.md, .claude/, docs/memoria/, docs/origem-manus/, web/imagens/, os dois docs internos
# abaixo e o .gitignore (a org-main é dona do próprio .gitignore; se a main o mudou, o script avisa).
# Uso:  powershell -File scripts/enviar-org.ps1             (mostra um menu: simular / preparar / enviar)
#       powershell -File scripts/enviar-org.ps1 -Simular    (só mostra o que iria; não toca na org-main)
#       powershell -File scripts/enviar-org.ps1             (sem opção: menu)
#       powershell -File scripts/enviar-org.ps1 -Preparar   (cria o commit na org-main, sem push)
#       powershell -File scripts/enviar-org.ps1 -Enviar     (prepara e dá push em org/main)
# A base do diff é a tag local `org-base` (último commit da main já enviado à organização).
# Se algo falhar no meio, a org-main é desfeita (reset --hard) e o script volta para a main.
param([string]$Mensagem = "", [switch]$Enviar, [switch]$Simular, [switch]$Preparar)
$ErrorActionPreference = "Stop"
function Invoke-Git { & git.exe @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') falhou" } }

$excluir = @(
  ':!CLAUDE.md', ':!.claude', ':!docs/memoria', ':!docs/origem-manus', ':!web/imagens',
  ':!docs/avaliacao-estrutura.md', ':!docs/comparativo-mercado.md', ':!scripts/enviar-org.ps1',
  ':!.gitignore'
)

$sujo = [bool](git status --porcelain)
if ((git branch --show-current) -ne "main") { throw "Rode a partir da branch main." }
$topo = (git rev-parse main).Trim()
$base = (git rev-parse org-base).Trim()
if ($topo -eq $base) { Write-Host "Nada novo para enviar à organização."; exit 0 }

# Menu quando nenhuma opção foi dada
if (-not ($Enviar -or $Simular -or $Preparar)) {
  Write-Host ""
  Write-Host "O que fazer?"
  Write-Host "  1) Simular  - mostra o que iria para a organização (não muda nada)"
  Write-Host "  2) Preparar - cria o commit na org-main, sem enviar"
  Write-Host "  3) Enviar   - prepara e dá push em org/main"
  Write-Host "  4) Cancelar"
  $escolha = Read-Host "Número"
  switch ($escolha) {
    "1" { $Simular = $true }
    "2" { $Preparar = $true }
    "3" { $Enviar = $true }
    default { Write-Host "Cancelado."; exit 0 }
  }
}

# Aviso: .gitignore mudou na main (não vai junto)
if (git diff --name-only $base main -- .gitignore) {
  Write-Host "AVISO: o .gitignore mudou na main e NÃO vai para a organização (a org-main tem o próprio). Aplique à mão se for preciso." -ForegroundColor Yellow
}

if ($Simular) {
  Write-Host ""
  Write-Host "Vai para a organização (base $($base.Substring(0,7)) -> main $($topo.Substring(0,7))):"
  & git.exe diff --stat $base main -- . @excluir
  $internos = git diff --name-only $base main | Where-Object { $_ -match '^(CLAUDE\.md|\.claude/|docs/memoria/|docs/origem-manus/|web/imagens/|docs/avaliacao-estrutura\.md|docs/comparativo-mercado\.md|scripts/enviar-org\.ps1|\.gitignore)' }
  if ($internos) { Write-Host ""; Write-Host "Mudaram, mas ficam de fora:"; $internos | ForEach-Object { Write-Host "  $_" } }
  if ($sujo) { Write-Host ""; Write-Host "(Há alterações não commitadas; elas não entram na simulação. Para preparar/enviar, faça commit antes.)" -ForegroundColor Yellow }
  exit 0
}

if ($sujo) { throw "Há alterações não commitadas. Faça commit antes." }
$patch =Join-Path $env:TEMP "org-patch.diff"
& git.exe diff --binary --output=$patch $base main -- . @excluir
if ($LASTEXITCODE -ne 0) { throw "git diff falhou" }
if (-not (Get-Item $patch).Length) { Write-Host "Só mudou arquivo interno; nada a enviar."; Invoke-Git tag -f org-base $topo; exit 0 }

Invoke-Git checkout org-main
$falhou = $null
try {
  Invoke-Git apply --3way --index $patch
  Write-Host "Rodando verificações (publicar + test)..."
  npm run publicar; if ($LASTEXITCODE -ne 0) { throw "publicar falhou" }
  npm test; if ($LASTEXITCODE -ne 0) { throw "testes falharam" }
  if (-not $Mensagem) { $Mensagem = (git log -1 --format=%s main).Trim() }
  # Segurança: nada interno pode entrar
  $proibidos = git diff --cached --name-only | Select-String -Pattern '^(CLAUDE\.md|\.claude/|docs/memoria/|docs/origem-manus/|web/imagens/)'
  if ($proibidos) { throw "Arquivo interno no commit: $proibidos" }
  Invoke-Git commit -m $Mensagem
  if ($Enviar) { Invoke-Git push org org-main:main; Invoke-Git tag -f org-base $topo }
  else { Write-Host "Commit pronto na org-main. Revise e rode com -Enviar (ou: git push org org-main:main; git tag -f org-base $topo)." }
} catch {
  $falhou = $_
} finally {
  if ($falhou) {
    Write-Host "Falhou: $falhou" -ForegroundColor Red
    Write-Host "Desfazendo a org-main (reset --hard)..." -ForegroundColor Yellow
    & git.exe reset --hard HEAD | Out-Null
  }
  & git.exe checkout main
  if ($LASTEXITCODE -ne 0) { Write-Host "ATENÇÃO: não consegui voltar para a main; rode 'git checkout main'." -ForegroundColor Red }
}
if ($falhou) { exit 1 }
