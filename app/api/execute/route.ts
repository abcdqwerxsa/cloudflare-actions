import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { code, language } = await req.json();
    
    const tmpDir = os.tmpdir();
    const filename = `task_${Date.now()}`;
    let filepath = '';
    let command = '';

    if (language === 'python') {
      filepath = path.join(tmpDir, `${filename}.py`);
      await fs.writeFile(filepath, code);
      command = `python3 ${filepath}`;
    } else if (language === 'javascript' || language === 'nodejs') {
      filepath = path.join(tmpDir, `${filename}.js`);
      await fs.writeFile(filepath, code);
      command = `node ${filepath}`;
    } else if (language === 'bash') {
      filepath = path.join(tmpDir, `${filename}.sh`);
      await fs.writeFile(filepath, code);
      command = `bash ${filepath}`;
    } else {
      return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
    }

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      await fs.unlink(filepath).catch(() => {});
      return NextResponse.json({ stdout, stderr });
    } catch (execError: any) {
      await fs.unlink(filepath).catch(() => {});
      return NextResponse.json({ error: execError.message, stderr: execError.stderr }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Execution failed' }, { status: 500 });
  }
}
