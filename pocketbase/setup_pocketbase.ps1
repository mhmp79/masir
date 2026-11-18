#requires -Version 3.0
<#
  Provision PocketBase collections for the Konkur app (safe, non-destructive).

  Works on PocketBase 0.23+ including 0.40.x.
  - Creates the 11 app collections if they are missing.
  - Keeps all existing collections and records untouched (nothing is deleted).
  - Adds missing fields (order, examId, ...) and fixes the owner relation.
  - Applies the per-user access rules and the unique (localId, owner) index.

  Usage (no parameters needed - it asks interactively):
      powershell -ExecutionPolicy Bypass -File .\setup_pocketbase.ps1

  Non-interactive:
      powershell -ExecutionPolicy Bypass -File .\setup_pocketbase.ps1 `
          -Url https://masir-69623a.dockhold.app -Email admin@example.com -Password '...'

  Show planned changes only:
      ... -DryRun
#>

[CmdletBinding()]
param(
  [string]$Url,
  [string]$Email,
  [string]$Password,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Schema (keep in sync with pb_collections.json / js/12-pocketbase.js)
# ---------------------------------------------------------------------------

$Collections = @(
  @{ name = 'settings';   fields = @('owner', 'localId', 'value') },
  @{ name = 'subjects';   fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'activities'; fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'classes';    fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'sessions';   fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'sleeps';     fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'phones';     fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'exams';      fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'questions';  fields = @('owner', 'localId', 'value', 'order', 'examId') },
  @{ name = 'plan';       fields = @('owner', 'localId', 'value', 'order') },
  @{ name = 'reserved';   fields = @('owner', 'localId', 'value', 'order') }
)

# This field pair drives incremental sync (server change timestamps).
$TimestampFields = @('created', 'updated')

$Rules = [ordered]@{
  listRule   = 'owner = @request.auth.id'
  viewRule   = 'owner = @request.auth.id'
  createRule = '@request.auth.id != "" && owner = @request.auth.id'
  updateRule = 'owner = @request.auth.id'
  deleteRule = 'owner = @request.auth.id'
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Read-PlainPassword {
  $secure = Read-Host -AsSecureString 'PocketBase superuser password'
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Invoke-Pb {
  param(
    [string]$Method,
    [string]$Path,
    $Body,
    [string]$Token
  )
  $headers = @{}
  if ($Token) { $headers['Authorization'] = $Token }
  $request = @{
    Method      = $Method
    Uri         = $script:BaseUrl + $Path
    Headers     = $headers
    ContentType = 'application/json'
  }
  if ($null -ne $Body) {
    $request['Body'] = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  try {
    return Invoke-RestMethod @request
  } catch {
    $detail = $_.ErrorDetails.Message
    if (-not $detail) { $detail = $_.Exception.Message }
    throw ("PocketBase API error on $Method $Path`n$detail")
  }
}

function Get-FieldType {
  param([string]$Name)
  if ($TimestampFields -contains $Name) { return 'autodate' }
  switch ($Name) {
    'owner' { return 'relation' }
    'value' { return 'json' }
    'order' { return 'number' }
    default { return 'text' }
  }
}

function New-Field {
  param(
    [string]$Name,
    [string]$UsersId,
    [System.Collections.Generic.HashSet[string]]$Used
  )
  $type = Get-FieldType $Name
  $prefix = $type.Substring(0, [Math]::Min(4, $type.Length))
  do {
    $id = $prefix + (-join (1..10 | ForEach-Object { Get-Random -Minimum 0 -Maximum 10 }))
  } while ($Used.Contains($id))
  [void]$Used.Add($id)

  if ($type -eq 'autodate') {
    return [pscustomobject][ordered]@{
      id          = $id
      name        = $Name
      type        = 'autodate'
      system      = $false
      presentable = $false
      hidden      = $false
      onCreate    = $true
      onUpdate    = ($Name -eq 'updated')
    }
  }

  $field = [ordered]@{
    id          = $id
    name        = $Name
    type        = $type
    system      = $false
    presentable = $false
    hidden      = $false
    required    = $false
    help        = ''
  }
  switch ($type) {
    'relation' {
      $field['collectionId'] = $UsersId
      $field['cascadeDelete'] = $false
      $field['minSelect'] = 0
      $field['maxSelect'] = 1
    }
    'json' { $field['maxSize'] = 0 }
    'number' {
      $field['onlyInt'] = $false
      $field['min'] = $null
      $field['max'] = $null
    }
  }
  return [pscustomobject]$field
}

function Get-EnsuredFields {
  param(
    $Collection,
    [string[]]$FieldNames,
    [string]$UsersId
  )
  $fields = @()
  $used = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($field in @($Collection.fields)) {
    $copy = $field.PSObject.Copy()
    $fields += $copy
    if ($copy.id) { [void]$used.Add([string]$copy.id) }
  }

  $changed = $false
  foreach ($name in $FieldNames) {
    $expected = Get-FieldType $name
    $existing = $fields | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if (-not $existing) {
      $fields += New-Field $name $UsersId $used
      $changed = $true
      continue
    }
    if ($existing.type -ne $expected) {
      throw ('Collection "' + $Collection.name + '" already has field "' + $name + '" with type "' +
        $existing.type + '" but "' + $expected + '" is required. Rename or remove that field in the ' +
        'PocketBase admin and run the script again.')
    }
    if ($name -eq 'owner' -and $existing.collectionId -ne $UsersId) {
      $existing.collectionId = $UsersId
      $changed = $true
    }
  }

  return @{ Fields = $fields; Changed = $changed }
}

function Get-EnsuredIndexes {
  param($Collection, [string]$Name)
  $indexes = @()
  foreach ($index in @($Collection.indexes)) {
    if ($index) { $indexes += [string]$index }
  }
  $hasUnique = $indexes | Where-Object {
    $_ -match '(?i)unique' -and $_ -match '(?i)localid' -and $_ -match '(?i)owner'
  }
  if ($hasUnique) {
    return @{ Indexes = $indexes; Changed = $false }
  }
  $indexes += ('CREATE UNIQUE INDEX `idx_' + $Name + '_local_owner` ON `' + $Name + '` (`localId`, `owner`)')
  return @{ Indexes = $indexes; Changed = $true }
}

function Get-AllCollections {
  $items = @()
  $page = 1
  do {
    $result = Invoke-Pb -Method 'Get' -Path ("/api/collections?page=$page&perPage=100") -Token $script:Token
    $items += @($result.items)
    $totalPages = 1
    if ($result.totalPages) { $totalPages = [int]$result.totalPages }
    $page++
  } while ($page -le $totalPages)
  return $items
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if (-not $Url) { $Url = Read-Host 'PocketBase URL (e.g. https://masir-69623a.dockhold.app)' }
if (-not $Email) { $Email = Read-Host 'Superuser email' }
if (-not $Password) { $Password = Read-PlainPassword }

$Url = $Url.Trim().TrimEnd('/')
if ($Url -notmatch '^https?://') {
  throw 'URL must start with http:// or https://'
}
$script:BaseUrl = $Url
$Email = $Email.Trim()

$auth = Invoke-Pb -Method 'Post' -Path '/api/collections/_superusers/auth-with-password' -Body @{
  identity = $Email
  password = $Password
}
$script:Token = $auth.token
if (-not $script:Token) {
  throw 'Login failed: no token returned (check email/password).'
}

$all = Get-AllCollections

$usersCollection = $all | Where-Object { $_.name -eq 'users' } | Select-Object -First 1
if ($usersCollection) {
  $usersId = $usersCollection.id
} else {
  $authCollection = $all | Where-Object { $_.type -eq 'auth' } | Select-Object -First 1
  if ($authCollection) { $usersId = $authCollection.id } else { $usersId = '_pb_users_auth_' }
}

$created = 0
$updated = 0
$unchanged = 0
$warnings = @()

foreach ($spec in $Collections) {
  $name = $spec.name
  $fieldNames = $spec.fields
  $existing = $all | Where-Object { $_.name -eq $name } | Select-Object -First 1

  if (-not $existing) {
    $fields = @()
    $used = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($fieldName in @($fieldNames + $TimestampFields)) {
      $fields += New-Field $fieldName $usersId $used
    }
    $index = 'CREATE UNIQUE INDEX `idx_' + $name + '_local_owner` ON `' + $name + '` (`localId`, `owner`)'
    $payload = [ordered]@{
      name    = $name
      type    = 'base'
      fields  = $fields
      indexes = @($index)
      options = @{}
    }
    foreach ($ruleName in $Rules.Keys) { $payload[$ruleName] = $Rules[$ruleName] }

    if ($DryRun) {
      Write-Host "[dry-run] create $name"
      $created++
      continue
    }

    try {
      Invoke-Pb -Method 'Post' -Path '/api/collections' -Body $payload -Token $script:Token | Out-Null
      Write-Host "created  $name"
      $created++
    } catch {
      if ($_.Exception.Message -match '(?i)index') {
        $payload['indexes'] = @()
        Invoke-Pb -Method 'Post' -Path '/api/collections' -Body $payload -Token $script:Token | Out-Null
        Write-Host "created  $name (index skipped)"
        $warnings += "$name : unique index could not be created"
        $created++
      } else {
        throw
      }
    }
    continue
  }

  if ($existing.type -ne 'base') {
    throw ('Collection "' + $name + '" exists but is of type "' + $existing.type +
      '", not "base". Rename it in the PocketBase admin and run the script again.')
  }

  $ensuredFields = Get-EnsuredFields $existing @($fieldNames + $TimestampFields) $usersId
  $ensuredIndexes = Get-EnsuredIndexes $existing $name

  $payload = [ordered]@{}
  if ($ensuredFields.Changed) { $payload['fields'] = $ensuredFields.Fields }
  if ($ensuredIndexes.Changed) { $payload['indexes'] = $ensuredIndexes.Indexes }
  foreach ($ruleName in $Rules.Keys) {
    if ([string]$existing.$ruleName -ne [string]$Rules[$ruleName]) {
      $payload[$ruleName] = $Rules[$ruleName]
    }
  }

  if ($payload.Count -eq 0) {
    Write-Host "ok       $name"
    $unchanged++
    continue
  }

  $changedKeys = @($payload.Keys) -join ', '

  if ($DryRun) {
    Write-Host "[dry-run] update $name : $changedKeys"
    $updated++
    continue
  }

  try {
    Invoke-Pb -Method 'Patch' -Path ('/api/collections/' + $existing.id) -Body $payload -Token $script:Token | Out-Null
    Write-Host "updated  $name : $changedKeys"
    $updated++
  } catch {
    if ($payload.Contains('indexes') -and $_.Exception.Message -match '(?i)index') {
      $payload.Remove('indexes')
      if ($payload.Count -eq 0) {
        Write-Host "ok       $name (index skipped)"
        $warnings += "$name : unique index skipped (duplicate localId/owner records exist)"
        $unchanged++
        continue
      }
      Invoke-Pb -Method 'Patch' -Path ('/api/collections/' + $existing.id) -Body $payload -Token $script:Token | Out-Null
      Write-Host "updated  $name (index skipped)"
      $warnings += "$name : unique index skipped (duplicate localId/owner records exist)"
      $updated++
    } else {
      throw
    }
  }
}

if ($DryRun) {
  Write-Host ''
  Write-Host "[dry-run] created=$created updated=$updated unchanged=$unchanged"
  return
}

$final = Get-AllCollections
$finalNames = @($final | ForEach-Object { $_.name })
$missing = @($Collections | Where-Object { $finalNames -notcontains $_.name } | ForEach-Object { $_.name })
if ($missing.Count -gt 0) {
  throw ('Provisioning finished but these collections are missing: ' + ($missing -join ', '))
}

Write-Host ''
Write-Host "Done: created=$created updated=$updated unchanged=$unchanged"
foreach ($warning in $warnings) { Write-Host "warning: $warning" }
Write-Host 'Now create the app users in PocketBase (Collections -> users -> New record).'
