# Leva as mudanças da `main` para o repositório da organização (remoto `org`), sempre "limpas":
# sem CLAUDE.md, .claude/, docs/memoria/, docs/origem-manus/, web/imagens/ e os dois docs internos abaixo.
# Uso:  powershell -File scripts/enviar-org.ps1            (prepara o commit na org-main)
#       powershell -File scripts/enviar-org.ps1 -Enviar    (prepara e dá push em org/main)
# A base do diff é a tag local `org-base` (último commit da main já enviado à organização).
param([string]$Mensagem = "", [switch]$Enviar)
$ErrorActionPreference = "Stop"
function Invoke-Git { & git.exe @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') falhou" } }

$excluir = @(
  ':!CLAUDE.md', ':!.claude', ':!docs/memoria', ':!docs/origem-manus', ':!web/imagens',
  ':!docs/avaliacao-estrutura.md', ':!docs/comparativo-mercado.md', ':!scripts/enviar-org.ps1'
)

if (git status --porcelain) { throw "Há alterações não commitadas. Faça commit antes." }
if ((git branch --show-current) -ne "main") { throw "Rode a partir da branch main." }
$topo = (git rev-parse main).Trim()
$base = (git rev-parse org-base).Trim()
if ($topo -eq $base) { Write-Host "Nada novo para enviar à organização."; exit 0 }

$patch = Join-Path $env:TEMP "org-patch.diff"
& git.exe diff --binary --output=$patch $base main -- . @excluir
if (-not (Get-Item $patch).Length) { Write-Host "Só mudou arquivo interno; nada a enviar."; Invoke-Git tag -f org-base $topo; exit 0 }

Invoke-Git checkout org-main
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
} finally {
  Invoke-Git checkout main
}
