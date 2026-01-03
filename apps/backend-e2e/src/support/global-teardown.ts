export default async function globalTeardown() {
  console.log('\nCleaning up e2e tests...');

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
