'use strict';

const { createRuntime } = require('./runtime/bootstrap');

async function run() {
  const cmd = process.argv[2] || 'status';
  const arg = process.argv.slice(3).join(' ') || 'hello';
  const runtime = createRuntime();

  if (cmd === 'start') {
    await runtime.start();
    console.log('castellan started');
    return;
  }

  if (cmd === 'run') {
    await runtime.start();
    const res = await runtime.runTurn(arg, { inputSource: 'manual_trigger', sessionId: 'cli' });
    console.log(res.text || '');
    await runtime.stop();
    return;
  }

  if (cmd === 'status') {
    console.log(JSON.stringify({
      provider: runtime.config.defaultProvider,
      dbPath: runtime.config.dbPath,
      tools: runtime.toolRegistry.list().length,
      heartbeatRunning: runtime.heartbeat.isRunning(),
    }, null, 2));
    await runtime.stop();
    return;
  }

  if (cmd === 'stop') {
    await runtime.stop();
    console.log('castellan stopped');
    return;
  }

  console.log('usage: node cli.js [start|status|run <text>|stop]');
  await runtime.stop();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
