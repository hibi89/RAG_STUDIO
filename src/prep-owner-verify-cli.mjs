/** P5.47: print only the held, re-attested plan; do not echo paths or CSV cells. */
import {verifyLocalOwnerMapping} from './prep-owner-verify.mjs';
try {
  if (process.argv.length !== 4) throw Error('ARGS');
  const verified=verifyLocalOwnerMapping(process.argv[2],process.argv[3]);
  process.stdout.write(JSON.stringify(verified)+'\n');
} catch {
  process.stdout.write(JSON.stringify({status:'OWNER_MAPPING_BLOCKED',approval:'NOT_GRANTED',
    ax_package_created:false,sqlite_imported:false,remote_upload:false})+'\n');
  process.exitCode=1;
}
