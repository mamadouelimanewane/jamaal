# Patches prisma/schema.prisma for JAMAAL phases 1-4
# Run from repo root: C:\gravity\parfume
#
#   Unblock-File .\patch-prisma.ps1
#   Set-ExecutionPolicy -Scope Process Bypass
#   .\patch-prisma.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Location).Path
$Schema = Join-Path $RepoRoot "prisma\schema.prisma"

if (-not (Test-Path -LiteralPath $Schema)) {
  throw "prisma\schema.prisma not found. Run from C:\gravity\parfume"
}

# Backup
$bak = "$Schema.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $Schema -Destination $bak -Force
Write-Host "Backup: $bak" -ForegroundColor Yellow

$text = Get-Content -LiteralPath $Schema -Raw -Encoding UTF8

# --- 1. Payment enums (after ReturnStatus block) ---
if ($text -notmatch "enum PaymentMethod") {
  $paymentEnums = @'

enum PaymentMethod {
  COD
  WAVE
  ORANGE_MONEY
  STRIPE
}

enum PaymentStatus {
  NONE
  PENDING
  PAID
  FAILED
  REFUNDED
}
'@
  if ($text -match '(?s)(enum ReturnStatus\s*\{[^}]+\})') {
    $text = $text -replace '(?s)(enum ReturnStatus\s*\{[^}]+\})', "`$1$paymentEnums"
    Write-Host "[OK] Payment enums added" -ForegroundColor Green
  } else {
    Write-Host "[WARN] enum ReturnStatus not found - add Payment enums manually" -ForegroundColor Yellow
  }
} else {
  Write-Host "[SKIP] Payment enums already present" -ForegroundColor Cyan
}

# --- 2. Product.wishlistItems ---
if ($text -notmatch "wishlistItems") {
  if ($text -match 'orderItems\s+OrderItem\[\]') {
    $text = $text -replace '(orderItems\s+OrderItem\[\])', "`$1`r`n  wishlistItems     WishlistItem[]"
    Write-Host "[OK] Product.wishlistItems added" -ForegroundColor Green
  } else {
    Write-Host "[WARN] orderItems field not found on Product" -ForegroundColor Yellow
  }
} else {
  Write-Host "[SKIP] wishlistItems already present" -ForegroundColor Cyan
}

# --- 3. Order payment fields ---
if ($text -notmatch "paymentMethod") {
  $payFields = @"
  paymentMethod PaymentMethod `@default(COD)
  paymentStatus PaymentStatus `@default(NONE)
  paymentRef    String?
  paidAt        DateTime?

"@
  # Insert before first @@index on Order model - look for deliveryLng then notifications
  if ($text -match '(deliveryLng\s+Float\?)') {
    $text = $text -replace '(deliveryLng\s+Float\?)', "`$1`r`n`r`n  paymentMethod PaymentMethod @default(COD)`r`n  paymentStatus PaymentStatus @default(NONE)`r`n  paymentRef    String?`r`n  paidAt        DateTime?"
    Write-Host "[OK] Order payment fields added" -ForegroundColor Green
  } else {
    Write-Host "[WARN] deliveryLng not found - add payment fields on Order manually" -ForegroundColor Yellow
  }
} else {
  Write-Host "[SKIP] paymentMethod already present" -ForegroundColor Cyan
}

# --- 4. Consultant.slug ---
if ($text -notmatch 'slug\s+String\?\s+@unique' -or ($text -match 'model Consultant' -and $text -notmatch '(?s)model Consultant \{[^}]*slug')) {
  # Check only inside Consultant - simple approach: if Consultant block lacks slug
  $needsSlug = $true
  if ($text -match '(?s)model Consultant \{.*?slug\s+String') {
    $needsSlug = $false
  }
  if ($needsSlug) {
    if ($text -match '(?s)(model Consultant \{[^}]*active\s+Boolean\s+@default\(true\))') {
      $text = $text -replace '(active\s+Boolean\s+@default\(true\))', "`$1`r`n  slug      String?  @unique"
      Write-Host "[OK] Consultant.slug field added" -ForegroundColor Green
    } else {
      Write-Host "[WARN] Could not find Consultant.active - add slug manually" -ForegroundColor Yellow
    }
    # Add index if missing near Consultant indexes
    if ($text -notmatch '@@index\(\[slug\]\)') {
      if ($text -match '(?s)(model Consultant \{.*?)(@@index\(\[sponsorId\]\))') {
        $text = $text -replace '(@@index\(\[sponsorId\]\))', "`$1`r`n  @@index([slug])"
        Write-Host "[OK] Consultant @@index([slug]) added" -ForegroundColor Green
      }
    }
  } else {
    Write-Host "[SKIP] Consultant.slug already present" -ForegroundColor Cyan
  }
} else {
  Write-Host "[SKIP] slug @unique already present" -ForegroundColor Cyan
}

# --- 5. Phase 4 models at end of file ---
if ($text -notmatch "model LoyaltyAccount") {
  $phase4 = @'

model LoyaltyAccount {
  id        String         @id @default(cuid())
  phone     String         @unique
  name      String?
  points    Int            @default(0)
  lifetime  Int            @default(0)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  events    LoyaltyEvent[]
}

model LoyaltyEvent {
  id        String         @id @default(cuid())
  accountId String
  account   LoyaltyAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  type      String
  points    Int
  orderId   String?
  note      String?
  createdAt DateTime       @default(now())

  @@index([accountId])
}

model WishlistItem {
  id        String   @id @default(cuid())
  phone     String
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([phone, productId])
  @@index([phone])
}

model AnalyticsEvent {
  id        String   @id @default(cuid())
  name      String
  path      String?
  productId String?
  orderId   String?
  meta      Json?
  sessionId String?
  createdAt DateTime @default(now())

  @@index([name, createdAt])
  @@index([createdAt])
}
'@
  $text = $text.TrimEnd() + "`r`n" + $phase4 + "`r`n"
  Write-Host "[OK] Phase 4 models appended" -ForegroundColor Green
} else {
  Write-Host "[SKIP] LoyaltyAccount already present" -ForegroundColor Cyan
}

# Write UTF8 without BOM issues
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($Schema, $text, $utf8NoBom)

Write-Host ""
Write-Host "Schema updated: $Schema" -ForegroundColor Green
Write-Host ""
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host "  npx prisma validate"
Write-Host "  npx prisma migrate dev --name jamaal_phases_1_4"
Write-Host "  npx prisma generate"
Write-Host ""
