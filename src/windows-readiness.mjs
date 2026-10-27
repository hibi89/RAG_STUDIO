/** P5.5: read-only Windows synthetic demo *prerequisite* checks, not an installer.
 * Real Windows execution is never inferred from a simulated platform argument.
 * Does not bind sockets, install software, download files, or handle customer data.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkRuntime,checkPackage} from './doctor.mjs';

const PROJECT_ROOT=fileURLToPath(new URL('../',import.meta.url));
const DEMO_RELATIVE='fixtures/ax_multi_doc_v0';
const REQUIRED=[
  'package.json',
  'RUN_SYNTHETIC_WINDOWS.cmd',
  'scripts/windows-preflight.mjs',
  'src/dashboard-cli.mjs',
  'src/dashboard-server.mjs',
  'src/doctor.mjs',
  'src/validate.mjs',
  'ui/index.html',
  'ui/app.css',
  'ui/app.js',
  'ui/provenance.js',
  'fixtures/ax_multi_doc_v0/manifest.json',
  'fixtures/ax_multi_doc_v0/sales.csv',
  'fixtures/ax_multi_doc_v0/returns_policy.txt',
  'fixtures/ax_multi_doc_v0/shipping_policy.txt'
];

function ordinaryFile(root,relative){
  try{
    const full=path.join(root,relative);
    const stat=fs.lstatSync(full);
    return stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=2*1024*1024;
  }catch{return false;}
}
/** Machine-readable output includes no local paths, content or environment secrets. */
export async function checkWindowsDemoReadiness({
  projectRoot=PROJECT_ROOT,
  nodeVersion=process.versions.node,
  packageVerifier
}={}){
  if(typeof projectRoot!=='string'||!projectRoot.trim()){
    return Object.freeze({contract:'rag.windows-demo-preflight.v1',status:'BLOCKED_INVALID_ROOT',
      run_platform:process.platform,ready_for_customer_data:false,
      windows_browser_verified:false,installer_verified:false});
  }
  const runtime=checkRuntime({nodeVersion});
  const absent=REQUIRED.filter(relative=>!ordinaryFile(projectRoot,relative));
  const pkg=absent.length?{status:'NOT_CHECKED'}:
    await checkPackage(path.join(projectRoot,DEMO_RELATIVE),packageVerifier);
  const sourceVerified=pkg.status==='CONTRACT_VALIDATED'&&pkg.schema_version==='AX_DATA_PACKAGE_V0'&&
    pkg.datasets===1&&pkg.documents===2&&pkg.files===3&&pkg.accepted_files===3&&
    pkg.needs_review_files===0&&pkg.rejected_files===0;
  const status=runtime.status!=='SUPPORTED_NODE'?'BLOCKED_NODE':
    absent.length?'BLOCKED_REQUIRED_FILES':
    !sourceVerified?'BLOCKED_SYNTHETIC_SOURCE':
    process.platform!=='win32'?'WINDOWS_HOST_NOT_TESTED':
    'WINDOWS_DEMO_PREFLIGHT_PASS';
  return Object.freeze({
    contract:'rag.windows-demo-preflight.v1',status,
    run_platform:process.platform,node_supported:runtime.status==='SUPPORTED_NODE',
    required_files_present:REQUIRED.length-absent.length,required_files_total:REQUIRED.length,
    synthetic_package_validated:sourceVerified,
    network_download_required:false,admin_required:false,
    ready_for_customer_data:false,
    windows_browser_verified:false,installer_verified:false
  });
}
