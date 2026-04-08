import { preview } from './preview.ts';
import { deploy } from './deploy.ts';

const root = process.cwd();
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'preview':
    preview(root, args);
    break;
  case 'deploy':
    deploy(root, args);
    break;
  default:
    console.log(`Usage: framework-cli <command>

Commands:
  preview [--app <name>]           Build assets + start wrangler dev
  deploy [--since <ref>] [--all]   Deploy workers (--since: only changed, --all: force all)`);
    process.exit(command ? 1 : 0);
}
