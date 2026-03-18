$dir = 'c:\Users\LYKART06\Downloads\MY WEBSITES PROJ\ARTGALZIM WEB'
$files = Get-ChildItem -Path "$dir\*.html"
foreach ($f in $files) {
    try {
        $p = $f.FullName
        $txt = Get-Content -Path $p -Raw
        $txt = $txt.Replace([char]0x2014, '-')
        $txt = $txt.Replace([char]0x2013, '-')
        $txt = $txt.Replace([char]0x201C, '"')
        $txt = $txt.Replace([char]0x201D, '"')
        $txt = $txt.Replace([char]0x2018, "'")
        $txt = $txt.Replace([char]0x2019, "'")
        $txt = $txt.Replace([char]0x00B7, '-')
        $txt = $txt.Replace('<span class="ticker-sep">*</span>', '<span class="ticker-sep">***</span>')
        Set-Content -Path $p -Value $txt -Encoding UTF8
        Write-Host "Fixed $($f.Name)"
    } catch {
        Write-Host "Skip $($f.Name)"
    }
}
