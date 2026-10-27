/** P5.5: read-only Windows synthetic demo *prerequisite* checks, not an installer.
 * Real Windows execution is never inferred from a simulated platform argument.
 * Does not bind sockets, install software, download files, or handle customer data.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {checkRuntime,checkPackage} from './doctor.mjs';

const PROJECT_ROOT=fileURLToPath(new URL('../',import.meta.url));
const DEMO_RELATIVE='fixtures/ax_multi_doc_v0';
const EXPECTED_FIXTURE=Object.freeze({
  'sales.csv':'8213907ae23423c34db415c0e31f8113eccceed9fdbc2bb4557e1b6ea31e03b9',
  'returns_policy.txt':'906d20338fc26e3e755abd24ed04cc62b9fd8d51c079805b073e4609d360a950',
  'shipping_policy.txt':'e263fc52d0b6ab7d3a2d06abc767b49ad0b7519869baea60599c75ba91773fed'
});
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
// Prevent a locally rewritten manifest plus rewritten files from passing as the
// checked-in public demo source. This is NOT a signed distribution check.
function canonicalPublicDemo(root){
  try{
    const fixture=path.join(root,DEMO_RELATIVE);
    const manifest=JSON.parse(fs.readFileSync(path.join(fixture,'manifest.json'),'utf8'));
    if(manifest.project_id!=='synthetic-shop-001'||manifest.schema_version!=='AX_DATA_PACKAGE_V0'||
      manifest.files.length!==3)return false;
    return Object.entries(EXPECTED_FIXTURE).every(([relative,digest])=>{
      const entry=manifest.files.find(x=>x.relative_path===relative);
      if(entry?.sha256!==digest||entry.import_status!=='ACCEPTED')return false;
      const content=fs.readFileSync(path.join(fixture,relative));
      return crypto.createHash('sha256').update(content).digest('hex')===digest;
    });
  }catch{return false;}
}

/** A one-shot loopback bind probe. It closes before dashboard startup;
 * therefore only the dashboard's actual bind is authoritative (TOCTOU).
 * The probe never connects to or reads from another local process.
 */
async function probeLoopbackPort(port){
  return new Promise(resolve=>{
    const listener=net.createServer();
    listener.once('error',()=>resolve(false));
    try{
      listener.listen({host:'127.0.0.1',port,exclusive:true},()=>{
        listener.close(()=>resolve(true));
      });
    }catch{resolve(false);}
  });
}

/** Machine-readable output includes no local paths, content or environment secrets. */
export async function checkWindowsDemoReadiness({
  projectRoot=PROJECT_ROOT,
  nodeVersion=process.versions.node,
  port=8765,
  packageVerifier
}={}){
  if(typeof projectRoot!=='string'||!projectRoot.trim()){
    return Object.freeze({contract:'rag.windows-demo-preflight.v1',status:'BLOCKED_INVALID_ROOT',
      run_platform:process.platform,ready_for_customer_data:false,
      windows_browser_verified:false,installer_verified:false});
  }
  if(!Number.isInteger(port)||port<1||port>65535){
    return Object.freeze({contract:'rag.windows-demo-preflight.v1',status:'BLOCKED_INVALID_PORT',
      run_platform:process.platform,ready_for_customer_data:false,
      windows_browser_verified:false,installer_verified:false});
  }
  const runtime=checkRuntime({nodeVersion});
  const absent=REQUIRED.filter(relative=>!ordinaryFile(projectRoot,relative));
  const pkg=absent.length?{status:'NOT_CHECKED'}:
    await checkPackage(path.join(projectRoot,DEMO_RELATIVE),packageVerifier);
  const sourceVerified=canonicalPublicDemo(projectRoot)&&
    pkg.status==='CONTRACT_VALIDATED'&&pkg.schema_version==='AX_DATA_PACKAGE_V0'&&
    pkg.datasets===1&&pkg.documents===2&&pkg.files===3&&pkg.accepted_files===3&&
    pkg.needs_review_files===0&&pkg.rejected_files===0;
  const needsProbe=runtime.status==='SUPPORTED_NODE'&&absent.length===0&&sourceVerified;
  const portAvailable=needsProbe?await probeLoopbackPort(port):null;
  const status=runtime.status!=='SUPPORTED_NODE'?'BLOCKED_NODE':
    absent.length?'BLOCKED_REQUIRED_FILES':
    !sourceVerified?'BLOCKED_SYNTHETIC_SOURCE':
    !portAvailable?'BLOCKED_PORT_UNAVAILABLE':
    process.platform!=='win32'?'WINDOWS_HOST_NOT_TESTED':
    'WINDOWS_DEMO_PREFLIGHT_PASS';
  return Object.freeze({
    contract:'rag.windows-demo-preflight.v1',status,
    run_platform:process.platform,node_supported:runtime.status==='SUPPORTED_NODE',
    required_files_present:REQUIRED.length-absent.length,required_files_total:REQUIRED.length,
    synthetic_package_validated:sourceVerified,
    port_available:portAvailable,
    network_download_required:false,admin_required:false,
    ready_for_customer_data:false,
    windows_browser_verified:false,installer_verified:false
  });
}
