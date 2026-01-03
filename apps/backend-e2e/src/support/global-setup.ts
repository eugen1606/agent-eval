import { execSync } from 'child_process';

export default async function globalSetup() {
  // Start the backend server for e2e tests
  console.log('\nStarting backend server for e2e tests...');

  // Check if server is already running
  try {
    const response = await fetch('http://localhost:3001/api/health');
    if (response.ok) {
      console.log('Backend server already running');
      return;
    }
  } catch {
    // Server not running, we'll start it
  }

  // Build the backend first
  console.log('Building backend...');
  execSync('yarn nx build backend', {
    stdio: 'inherit',
    cwd: process.cwd().replace('/apps/backend-e2e', ''),
  });

  // Start the server in background
  const { spawn } = await import('child_process');
  const server = spawn('node', ['dist/apps/backend/main.js'], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://agent_eval:agent_eval_password@localhost:5433/agent_eval',
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-e2e-testing-only',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-for-e2e-testing-only',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'a'.repeat(64),
    },
    cwd: process.cwd().replace('/apps/backend-e2e', ''),
  });

  server.unref();

  // Store PID for teardown
  (global as Record<string, unknown>).__SERVER_PID__ = server.pid;

  // Wait for server to be ready
  console.log('Waiting for server to be ready...');
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        console.log('Backend server is ready!');
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Backend server failed to start within 30 seconds');
}
