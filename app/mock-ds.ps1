$components = @(
    "select", "option", "button", "radio-group", "radio-button", "icon",
    "icon-button", "input", "checkbox", "spinner", "tab-group", "tab",
    "tab-panel", "avatar", "dropdown", "menu", "menu-item", "menu-label", "divider", "dialog"
)

$baseDir = "C:\Dev\focus\app\src\mock-design-system\react"
New-Item -ItemType Directory -Force -Path $baseDir

foreach ($comp in $components) {
    # Convert kebab-case to PascalCase for component name (e.g. radio-button -> TsRadioButton)
    $nameParts = $comp -split "-"
    $pascalName = "Ts"
    foreach ($part in $nameParts) {
        $pascalName += $part.Substring(0,1).ToUpper() + $part.Substring(1).ToLower()
    }

    $fileContent = "export const $pascalName = (props: any) => { return <div {...props}>{props.children}</div> };"
    
    $dirPath = Join-Path $baseDir $comp
    New-Item -ItemType Directory -Force -Path $dirPath
    
    $filePath = Join-Path $dirPath "index.ts"
    Set-Content -Path $filePath -Value $fileContent
}

# Update tsconfig.json
$tsconfig = Get-Content "C:\Dev\focus\app\tsconfig.json" -Raw | ConvertFrom-Json
if (-not $tsconfig.compilerOptions.paths) {
    $tsconfig.compilerOptions | Add-Member -MemberType NoteProperty -Name "paths" -Value @{}
}
$tsconfig.compilerOptions.paths | Add-Member -MemberType NoteProperty -Name "@tuvsud/design-system/*" -Value @("./src/mock-design-system/*")
$tsconfig | ConvertTo-Json -Depth 10 | Set-Content "C:\Dev\focus\app\tsconfig.json"
