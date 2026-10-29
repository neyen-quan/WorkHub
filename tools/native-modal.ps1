param([string]$Title='WorkHub',[string]$Button='Cancelar',[int]$TargetProcessId,[string]$Report)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class WorkHubModal {
 public delegate bool EnumProc(IntPtr hwnd,IntPtr lparam);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr lparam);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hwnd,EnumProc callback,IntPtr lparam);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int max);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd,StringBuilder text,int max);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd,uint msg,IntPtr wp,IntPtr lp);
 public static string Text(IntPtr h){var b=new StringBuilder(2048);GetWindowText(h,b,b.Capacity);return b.ToString();}
 public static string Kind(IntPtr h){var b=new StringBuilder(256);GetClassName(h,b,b.Capacity);return b.ToString();}
}
'@
$deadline=[DateTime]::UtcNow.AddSeconds(25)
$observed=@()
while([DateTime]::UtcNow -lt $deadline){
  $processFilter=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$TargetProcessId)
  $elements=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Descendants,$processFilter)
  foreach($element in $elements){
    $name=$element.Current.Name
    if($name){$observed+=$name}
    if($element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $name.Replace('&','').Trim() -in @($Button,'Cancel','Cancelar')){
      Start-Sleep -Milliseconds 2500
      if($Report){[System.IO.File]::WriteAllText($Report,'native modal observed via UIAutomation')}
      $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
      exit 0
    }
  }
  # Owned Windows dialogs can be represented outside the owner's UIA subtree.
  # Locate the real native dialog/button by process and class instead of title.
  $script:cancelHandle=[IntPtr]::Zero
  $windowCallback=[WorkHubModal+EnumProc]{param($handle,$unused)
    [uint32]$ownerId=0
    [void][WorkHubModal]::GetWindowThreadProcessId($handle,[ref]$ownerId)
    if($ownerId -eq $TargetProcessId -and [WorkHubModal]::Kind($handle) -eq '#32770'){
      $childCallback=[WorkHubModal+EnumProc]{param($child,$other)
        if([WorkHubModal]::Kind($child) -eq 'Button' -and [WorkHubModal]::Text($child).Replace('&','').Trim() -in @($Button,'Cancel','Cancelar')){$script:cancelHandle=$child;return $false}
        return $true
      }
      [void][WorkHubModal]::EnumChildWindows($handle,$childCallback,[IntPtr]::Zero)
    }
    return ($script:cancelHandle -eq [IntPtr]::Zero)
  }
  [void][WorkHubModal]::EnumWindows($windowCallback,[IntPtr]::Zero)
  if($script:cancelHandle -ne [IntPtr]::Zero){
    Start-Sleep -Milliseconds 2500
    if($Report){[System.IO.File]::WriteAllText($Report,'native modal observed via Win32')}
    [void][WorkHubModal]::SendMessage($script:cancelHandle,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)
    exit 0
  }
  Start-Sleep -Milliseconds 100
}
Write-Output (($observed|Select-Object -Unique)|ConvertTo-Json -Compress)
throw 'Native confirmation dialog was not found'

