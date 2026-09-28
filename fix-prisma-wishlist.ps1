# Fix wishlistItems relation (must be on Product, not ProductVariant)
# Run from C:\gravity\parfume

$ErrorActionPreference = "Stop"
$Schema = Join-Path (Get-Location).Path "prisma\schema.prisma"
if (-not (Test-Path -LiteralPath $Schema)) { throw "prisma\schema.prisma not found" }

$bak = "$Schema.bak-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $Schema -Destination $bak -Force
Write-Host "Backup: $bak" -ForegroundColor Yellow

$text = Get-Content -LiteralPath $Schema -Raw -Encoding UTF8

# 1) Remove ALL wishlistItems lines (we will re-add on Product only)
$before = $text
$text = [regex]::Replace($text, '(?m)^\s*wishlistItems\s+WishlistItem\[\]\r?\n', '')
if ($text -ne $before) {
  Write-Host "[OK] Removed misplaced wishlistItems line(s)" -ForegroundColor Green
} else {
  Write-Host "[INFO] No wishlistItems line to remove" -ForegroundColor Cyan
}

# 2) Ensure WishlistItem.product points to Product (not ProductVariant)
if ($text -match 'model WishlistItem') {
  $text = $text -replace 'product\s+ProductVariant\s+@relation', 'product   Product  @relation'
  Write-Host "[OK] WishlistItem -> Product relation checked" -ForegroundColor Green
}

# 3) Add wishlistItems inside model Product only (after orderItems if present, else before closing of useful fields)
if ($text -notmatch '(?s)model Product\s*\{[^}]*wishlistItems') {
  if ($text -match '(?s)(model Product\s*\{.*?)(orderItems\s+OrderItem\[\])') {
    $text = [regex]::Replace(
      $text,
      '(model Product\s*\{[\s\S]*?)(orderItems\s+OrderItem\[\])',
      { param($m) $m.Groups[1].Value + $m.Groups[2].Value + "`r`n  wishlistItems     WishlistItem[]" },
      1
    )
    Write-Host "[OK] wishlistItems added on model Product" -ForegroundColor Green
  } elseif ($text -match '(?s)(model Product\s*\{.*?)(@@index\(\[category\]\))') {
    $text = [regex]::Replace(
      $text,
      '(model Product\s*\{[\s\S]*?)(@@index\(\[category\]\))',
      { param($m) $m.Groups[1].Value + "  wishlistItems     WishlistItem[]`r`n`r`n  " + $m.Groups[2].Value },
      1
    )
    Write-Host "[OK] wishlistItems added on model Product (before @@index)" -ForegroundColor Green
  } else {
    Write-Host "[WARN] Could not locate model Product - open schema and add: wishlistItems WishlistItem[]" -ForegroundColor Yellow
  }
} else {
  Write-Host "[SKIP] Product already has wishlistItems" -ForegroundColor Cyan
}

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($Schema, $text, $utf8)

Write-Host ""
Write-Host "Done. Run:" -ForegroundColor Green
Write-Host "  npx prisma validate"
Write-Host "  npx prisma migrate dev --name jamaal_phases_1_4"
Write-Host "  npx prisma generate"
