'use strict';

const { createRuntime } = require('./runtime/bootstrap');

async function main() {
  const runtime = createRuntime();
  await runtime.start();
  const res = await runtime.runTurn(process.env.CASTELLAN_BOOT_MESSAGE || 'Castellan integration self-check', { inputSource: 'manual_trigger', sessionId: 'bootstrap' });
  runtime.logger.info('bootstrap_turn_complete', { text: res.text, toolCalls: res.toolCalls?.length || 0 });
  await runtime.stop();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createRuntime };
