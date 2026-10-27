# P5.42 Windows PowerShell 5.1 native dialog, invoked by double-click CMD.
# Paths are serialized to UTF-8 JSON piped to a FIXED Node script via stdin.
# File-dialog paths must never be expanded into native shell commands.
$ErrorActionPreference = 'Stop'
if ($args.Count -ne 0) {
    [Console]::Error.WriteLine('PICKER_UNEXPECTED_ARGUMENTS')
    exit 2
}
try {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    try {
        $dialog.Title = 'RAG Studio local PDF/DOCX preview (select 2-4 files)'
        $dialog.Filter = 'PDF and DOCX (*.pdf;*.docx)|*.pdf;*.docx'
        $dialog.Multiselect = $true
        $dialog.CheckFileExists = $true
        $dialog.CheckPathExists = $true
        $dialog.RestoreDirectory = $true
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
            [Console]::WriteLine('PICKER_CANCELLED_NO_CHANGES')
            exit 0
        }
        $selected = [string[]] @($dialog.FileNames)
    } finally {
        $dialog.Dispose()
    }
    if ($selected.Length -lt 2 -or $selected.Length -gt 4) {
        [Console]::Error.WriteLine('PICKER_SELECT_TWO_TO_FOUR_FILES')
        exit 2
    }
    # PowerShell 5.1 otherwise defaults to legacy encoding for native pipes.
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $packet = [pscustomobject]@{
        source = 'WINDOWS_NATIVE_PICKER_V1'
        documents = $selected
    }
    $json = ConvertTo-Json -InputObject $packet -Depth 3 -Compress
    $json | & node 'src\native-document-picker-cli.mjs'
    exit $LASTEXITCODE
} catch {
    [Console]::Error.WriteLine('PICKER_UI_OR_RUNTIME_UNAVAILABLE')
    exit 2
}
