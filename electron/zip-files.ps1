param([ValidateSet('list','extract')][string]$Action)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inputData = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())) | ConvertFrom-Json
$zip = [System.IO.Compression.ZipFile]::OpenRead([string]$inputData.archive)
try {
  if ($Action -eq 'list') {
    $prefix = ([string]$inputData.prefix).Trim('/')
    if ($prefix) { $prefix += '/' }
    $found = @{}
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName.Replace([string][char]92,'/').TrimStart('/')
      if ($prefix -and -not $name.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { continue }
      $rest = $name.Substring($prefix.Length)
      if (-not $rest) { continue }
      $separator = $rest.IndexOf('/')
      $child = if ($separator -ge 0) { $rest.Substring(0, $separator) } else { $rest }
      if (-not $child) { continue }
      $isDirectory = ($separator -ge 0) -or $entry.FullName.EndsWith('/')
      if (-not $found.ContainsKey($child) -or $isDirectory) {
        $full = if ($prefix) { $prefix + $child } else { $child }
        if ($isDirectory) { $full += '/' }
        $found[$child] = @{ name = $child; entry = $full.TrimEnd('/'); directory = $isDirectory; size = if ($isDirectory) { $null } else { [long]$entry.Length } }
      }
    }
    $sorted = @($found.Values | Sort-Object @{Expression={ if ($_.directory) { 0 } else { 1 } }}, @{Expression={ $_.name }})
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject $sorted -Compress -Depth 4))
  } else {
    $requested = ([string]$inputData.entry).Replace([string][char]92,'/').TrimStart('/')
    if (-not $requested -or $requested.Split('/') -contains '..') { throw 'La ruta dentro del ZIP no es válida.' }
    $destination = [System.IO.Path]::GetFullPath([string]$inputData.destination)
    [System.IO.Directory]::CreateDirectory($destination) | Out-Null
    $isDirectory = [bool]$inputData.directory
    $prefix = $requested.TrimEnd('/') + '/'
    $count = 0
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName.Replace([string][char]92,'/').TrimStart('/')
      $matches = if ($isDirectory) { $name.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) } else { $name -eq $requested }
      if (-not $matches -or $entry.FullName.EndsWith('/')) { continue }
      $relative = if ($isDirectory) { $name.Substring($requested.TrimEnd('/').Length).TrimStart('/') } else { [System.IO.Path]::GetFileName($requested) }
      if (-not $relative) { continue }
      $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destination, $relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
      if (-not $target.StartsWith($destination.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'El ZIP contiene una ruta insegura.' }
      [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
      $sourceStream = $entry.Open()
      try { $targetStream = [System.IO.File]::Open($target, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write); try { $sourceStream.CopyTo($targetStream) } finally { $targetStream.Dispose() } } finally { $sourceStream.Dispose() }
      $count++
    }
    @{ count = $count } | ConvertTo-Json -Compress
  }
} finally { $zip.Dispose() }
