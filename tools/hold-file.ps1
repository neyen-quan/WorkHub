param([string]$File,[string]$Ready,[string]$Stop)
$ErrorActionPreference='Stop'
$stream=[System.IO.File]::Open($File,[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::Read)
try{
 [System.IO.File]::WriteAllText($Ready,'locked')
 $until=[DateTime]::UtcNow.AddMinutes(2)
 while(-not [System.IO.File]::Exists($Stop) -and [DateTime]::UtcNow -lt $until){Start-Sleep -Milliseconds 100}
}finally{$stream.Dispose()}

