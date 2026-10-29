param()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$inputData = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())) | ConvertFrom-Json
$files = New-Object System.Collections.Specialized.StringCollection
foreach ($item in $inputData.paths) { if (Test-Path -LiteralPath $item) { [void]$files.Add([string]$item) } }
if ($files.Count -eq 0) { exit 2 }
$data = New-Object System.Windows.Forms.DataObject
$data.SetFileDropList($files)
$preferred = if ($inputData.operation -eq 'copy') { [byte[]](1,0,0,0) } elseif ($inputData.operation -eq 'move') { [byte[]](2,0,0,0) } else { [byte[]](3,0,0,0) }
$data.SetData('Preferred DropEffect', $false, [System.IO.MemoryStream]::new($preferred))
$form = New-Object System.Windows.Forms.Form
$form.ShowInTaskbar = $false
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$form.Opacity = 0
$form.Show()
$allowed = if ($inputData.operation -eq 'copy') { [System.Windows.Forms.DragDropEffects]::Copy } elseif ($inputData.operation -eq 'move') { [System.Windows.Forms.DragDropEffects]::Move } else { [System.Windows.Forms.DragDropEffects]::Copy -bor [System.Windows.Forms.DragDropEffects]::Move }
[void]$form.DoDragDrop($data, $allowed)
$form.Close()
