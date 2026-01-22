async function cleanupTestUsers(): Promise<void> {
  try {
    const response = await fetch('http://localhost:3001/api/health/cleanup-test-users', { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      if (data.deleted > 0) {
        console.log(`Cleaned up ${data.deleted} test users`);
      }
    }
  } catch {
    // Server may already be down
  }
}

export default async function globalTeardown() {
  console.log('\nCleaning up e2e tests...');

  // Cleanup test users before killing server
  await cleanupTestUsers();

  const pid = (global as Record<string, unknown>).__SERVER_PID__ as number | undefined;

  if (pid) {
    try {
      process.kill(pid);
      console.log(`Killed server process ${pid}`);
    } catch {
      // Process might already be dead
    }
  }
}
