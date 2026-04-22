const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const pythonServiceDir = path.join(workspaceRoot, 'server', 'python_service');
const appPath = path.join(pythonServiceDir, 'app.py');

const candidates = process.platform === 'win32'
  ? [
      path.join(pythonServiceDir, 'venv', 'Scripts', 'python.exe'),
      'python',
      'py'
    ]
  : [
      path.join(pythonServiceDir, 'venv', 'bin', 'python'),
      'python3',
      'python'
    ];

const pickPythonCommand = () => {
  for (const cmd of candidates) {
    if (cmd.includes(path.sep)) {
      if (fs.existsSync(cmd)) return cmd;
      continue;
    }
    return cmd;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
};

if (!fs.existsSync(appPath)) {
  console.error('Python service entry not found:', appPath);
  process.exit(1);
}

const pythonCmd = pickPythonCommand();
const args = pythonCmd === 'py' ? ['-3', appPath] : [appPath];

console.log(`[python:dev] starting face service using ${pythonCmd}`);

const child = spawn(pythonCmd, args, {
  cwd: pythonServiceDir,
  env: {
    ...process.env,
    PYTHON_SERVICE_PORT: process.env.PYTHON_SERVICE_PORT || '8001'
  },
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('error', (err) => {
  console.error('[python:dev] failed to start:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code == null ? 1 : code);
});
