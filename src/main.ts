import './style.css';
import { startShell } from './platform/shell';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
startShell(root);
