# RAG_STUDIO single-command local verification (P5.43).
# Safe synthetic test suite; report files are written to a NEW system-temp folder.
# No dependency setup, real customer files, DB mutations, or external API calls.
param([switch]$Quick)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$reportDir = Join-Path ([System.IO.Path]::GetTempPath()) ('rag-studio-verify-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $reportDir -ErrorAction Stop | Out-Null
$results = New-Object System.Collections.Generic.List[object]
$started = [DateTime]::UtcNow.ToString('o')
$sha = 'unavailable'
$os = [System.Environment]::OSVersion.VersionString
$version = 'unavailable'
function Execute-Step([string]$name,[string]$exe,[string[]]$argv) {
    $logPath = Join-Path $reportDir ($name + '.log')
    $output = ''
    $exitCode = 2
    try {
        $output = (& $exe @argv 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 2 }
    } catch {
        $output = 'COMMAND_EXECUTION_EXCEPTION'
        $exitCode = 2
    }
    [System.IO.File]::WriteAllText($logPath, $output, [System.Text.UTF8Encoding]::new($false))
    $p = [regex]::Match($output,'(?m)^# pass (\d+)')
    $f = [regex]::Match($output,'(?m)^# fail (\d+)')
    $s = [regex]::Match($output,'(?m)^# skipped (\d+)')
    $pass = if($p.Success){[int]$p.Groups[1].Value}else{$null}
    $fail = if($f.Success){[int]$f.Groups[1].Value}else{$null}
    $skip = if($s.Success){[int]$s.Groups[1].Value}else{$null}
    $results.Add([pscustomobject]@{
        step=$name; status=$(if($exitCode -eq 0){'PASS'}else{'FAIL'});
        exit_code=$exitCode; tests_pass=$pass; tests_fail=$fail; tests_skip=$skip;
        log=$logPath
    })
    [Console]::WriteLine($name + ': ' + $(if($exitCode -eq 0){'PASS'}else{'FAIL'}))
}
try {
    Push-Location $repo
    try {
        $v = (& node --version 2>$null | Out-String).Trim()
        $version = $v
        $major = 0; $minor = 0
        if ($v -match '^v([0-9]+)\.([0-9]+)\.') {
            $major = [int]$matches[1]; $minor = [int]$matches[2]
        }
        if ($major -lt 22 -or ($IsWindows -or $env:OS -eq 'Windows_NT') -and
            $major -eq 22 -and $minor -lt 23) {
            throw 'NODE_UNSUPPORTED'
        }
        if ($major -eq 22 -and $minor -lt 16) { throw 'NODE_UNSUPPORTED' }
        try { $sha = (& git rev-parse HEAD 2>$null | Out-String).Trim() } catch {}
        Execute-Step 'syntax_picker' 'node' @('--check','src/native-document-picker-cli.mjs')
        Execute-Step 'syntax_portable' 'node' @('--check','scripts/p543-native-portable.mjs')
        if ($Quick) {
            Execute-Step 'native_core' 'node' @('--test','tests/p540-native-collection.test.mjs',
                'tests/p541-source-line-jump.test.mjs','tests/p542-native-file-picker.test.mjs',
                'tests/p543-native-portable.test.mjs')
        } else {
            Execute-Step 'full_tests' 'npm' @('test')
            Execute-Step 'gold' 'npm' @('run','test:gold')
            Execute-Step 'negative' 'npm' @('run','test:negative')
            Execute-Step 'heldout' 'npm' @('run','test:heldout')
            Execute-Step 'router' 'npm' @('run','demo:router')
            Execute-Step 'wizard_smoke' 'node' @('scripts/p537-interactive-smoke.mjs')
        }
    } finally { Pop-Location }
} catch {
    $results.Add([pscustomobject]@{
        step='environment';status='FAIL';exit_code=2;tests_pass=$null;
        tests_fail=$null;tests_skip=$null;log=$null
    })
    [Console]::Error.WriteLine('VERIFY_LOCAL_ENVIRONMENT_BLOCKED')
}
$failed = @($results | Where-Object {$_.status -eq 'FAIL'}).Count
$report = [ordered]@{
    contract='RAG_STUDIO_LOCAL_VERIFY_V1'; date_utc=$started;
    source_sha=$sha; node=$version; os=$os; quick=[bool]$Quick;
    status=$(if($failed -eq 0){'PASS'}else{'FAIL'}); steps=$results.ToArray()
}
$out = Join-Path $reportDir 'summary.json'
[System.IO.File]::WriteAllText($out, ($report|ConvertTo-Json -Depth 7),
    [System.Text.UTF8Encoding]::new($false))
[Console]::WriteLine('Summary: ' + $out)
[Console]::WriteLine('Local verification: ' + $report.status)
if ($failed -gt 0) { exit 2 }
exit 0
