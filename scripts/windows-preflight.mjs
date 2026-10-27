/** Explicit, offline, synthetic-only Windows launcher prerequisite gate. */
import {checkWindowsDemoReadiness} from '../src/windows-readiness.mjs';
try{
  const result=await checkWindowsDemoReadiness();
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result.status!=='WINDOWS_DEMO_PREFLIGHT_PASS')process.exitCode=1;
}catch{
  process.stderr.write('WINDOWS_SYNTHETIC_PREFLIGHT_FAILED\n');
  process.exitCode=1;
}
