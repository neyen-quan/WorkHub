param([ValidateSet('read','write','clear','server')][string]$Action)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$ErrorActionPreference = 'Stop'
function Invoke-ClipboardAction($Action, $inputData) {
if ($Action -eq 'read') {
  $data = [System.Windows.Forms.Clipboard]::GetDataObject()
  $paths = @()
  if ($data -and $data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
    $paths = @($data.GetData([System.Windows.Forms.DataFormats]::FileDrop))
  }
  $operation = 'copy'
  if ($data -and $data.GetDataPresent('Preferred DropEffect')) {
    $effect = $data.GetData('Preferred DropEffect')
    if ($effect -is [System.IO.MemoryStream]) {
      $bytes = $effect.ToArray()
      if ($bytes.Length -ge 4 -and (([BitConverter]::ToUInt32($bytes, 0) -band 2) -ne 0)) { $operation = 'move' }
    } elseif ($effect -is [byte[]] -and $effect.Length -ge 4 -and (([BitConverter]::ToUInt32($effect, 0) -band 2) -ne 0)) { $operation = 'move' }
  }
  @{ paths = $paths; operation = $operation }
  return
}
if ($Action -eq 'clear') {
  [System.Windows.Forms.Clipboard]::Clear()
  @{}
  return
}
$files = New-Object System.Collections.Specialized.StringCollection
foreach ($item in $inputData.paths) { [void]$files.Add([string]$item) }
$data = New-Object System.Windows.Forms.DataObject
$data.SetFileDropList($files)
$effect = if ($inputData.operation -eq 'move') { [byte[]](2,0,0,0) } else { [byte[]](1,0,0,0) }
$data.SetData('Preferred DropEffect', $false, [System.IO.MemoryStream]::new($effect))
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
@{}

}
if ($Action -eq 'server') {
  while ($null -ne ($line = [Console]::ReadLine())) {
    try {
      $request = $line | ConvertFrom-Json
      $result = Invoke-ClipboardAction $request.action $request.payload
      @{ id = $request.id; ok = $true; result = $result } | ConvertTo-Json -Compress -Depth 8
    } catch {
      @{ id = $request.id; ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
    }
  }
} else {
  $payload = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())) | ConvertFrom-Json
  Invoke-ClipboardAction $Action $payload | ConvertTo-Json -Compress -Depth 8
}
