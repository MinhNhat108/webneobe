# Opens the calculation workbook in Excel, recalculates every formula, fills the input cells yellow and saves a copy.
#   powershell -File scripts/recalcLiveWorkbook.ps1 <in.xlsx> <out.xlsx> <inputs.json>
param([string]$InPath, [string]$OutPath, [string]$InputsPath)
$inputs = Get-Content -Raw -Encoding UTF8 $InputsPath | ConvertFrom-Json
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Open($InPath)
  foreach ($p in $inputs.PSObject.Properties) {
    $ws = $wb.Worksheets.Item($p.Name)
    foreach ($a in $p.Value) { $ws.Range($a).Interior.Color = 10092543 }   # light yellow
    $ws.Rows.Item(5).Font.Bold = $true
  }
  $excel.CalculateFull()
  if (Test-Path $OutPath) { [System.IO.File]::Delete($OutPath) }
  $wb.SaveAs($OutPath, 51)
  $wb.Close($false)
  Write-Output "saved $OutPath"
} finally {
  $excel.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}
