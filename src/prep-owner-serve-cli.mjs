/** P5.48: expose only static UI assets on 127.0.0.1 ephemeral port. */
import {createPrepOwnerLocalServer} from './prep-owner-local-server.mjs';
const server=createPrepOwnerLocalServer();
if(process.argv.length!==2){process.stderr.write('Usage: node src/prep-owner-serve-cli.mjs\n');process.exitCode=2;}
else server.listen(0,'127.0.0.1',()=>{
 const addr=server.address();
 if(typeof addr!=='object'||addr.address!=='127.0.0.1'){
  server.close();process.exitCode=1;return;
 }
 process.stdout.write(`Local review only: http://127.0.0.1:${addr.port}/\n`);
 process.stdout.write('No CSV upload or import endpoint. Press Ctrl+C to stop.\n');
});
