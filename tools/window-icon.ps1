param([long]$WindowHandle)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WorkHubIconProbe {
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd,uint msg,IntPtr wp,IntPtr lp);
}
'@
$hwnd=[IntPtr]::new($WindowHandle)
$icon=[IntPtr]::Zero
foreach($kind in @(2,0,1)){
 $icon=[WorkHubIconProbe]::SendMessage($hwnd,0x007F,[IntPtr]::new($kind),[IntPtr]::Zero)
 if($icon -ne [IntPtr]::Zero){break}
}
if($icon -eq [IntPtr]::Zero){throw 'Window has no native icon'}
$bitmap=[System.Drawing.Icon]::FromHandle($icon).ToBitmap()
try{
 $yellow=0
 for($y=0;$y -lt $bitmap.Height;$y++){for($x=0;$x -lt $bitmap.Width;$x++){$c=$bitmap.GetPixel($x,$y);if($c.A -gt 100 -and $c.R -gt 140 -and $c.G -gt 90 -and $c.B -lt 180 -and $c.R -ge $c.G){$yellow++}}}
 @{width=$bitmap.Width;height=$bitmap.Height;yellowPixels=$yellow}|ConvertTo-Json -Compress
}finally{$bitmap.Dispose()}

