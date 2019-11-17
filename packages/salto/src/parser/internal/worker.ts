import { isMainThread, parentPort } from 'worker_threads'
import { HclReturn, HclCallContext } from './types'

if (isMainThread) {
  // We need to load wasm_exec. we have to use require because in the packages application we
  // cannot import wasm_exec when running from a thread, so we only import if we are running
  // in the main thread (which means we are currently being imported).
  // When running from a thread we will actually have the text of wasm_exec prefixed before
  // the code in this file so we won't actually have to require the module
  // eslint-disable-next-line global-require
  require('./wasm_exec')
}

const GO_ENV = {
  // Go garbage collection target percentage (lower means more aggressive, default is 100)
  GOGC: '20',
  // Go garbage collection strategy, it seems like concurrent strategies do not work well
  // and causes the code to crash with bad pointers to go heap, so we set the strategy to
  // "stop the world" in every collection cycle to make garbage collection single threaded
  GODEBUG: 'gcstoptheworld=2',
}

// Initialize empty parser call context
global.hclParserCall = {}

export type WorkerInterface = {
  call: (
    callID: number,
    wasmModule: WebAssembly.Module,
    context: HclCallContext,
  ) => Promise<HclReturn>
}

export const hclWorker: WorkerInterface = {
  call: async (callID, wasmModule, context) => {
    // Place call context in global object
    const { hclParserCall } = global
    hclParserCall[callID] = context

    try {
      // Not sure why eslint ignores this definition from webassembly.d.ts,
      // but this doesn't work without the following disable
      // eslint-disable-next-line no-undef
      const go = new Go()
      go.env = GO_ENV
      // eslint-disable-next-line no-undef
      const inst = await WebAssembly.instantiate(wasmModule, go.importObject)

      const execDone = new Promise<void>(resolve => {
        let exitPromise: Promise<void>
        context.callback = () => {
          // Wait for next tick to ensure the line that assigns `exitPromise` runs before we use it
          process.nextTick(() => exitPromise.then(resolve))
        }
        exitPromise = go.run(inst, [callID.toString()])
      })

      await execDone
      return context.return as HclReturn
    } finally {
      // cleanup call context from global scope
      delete hclParserCall[callID]
    }
  },
}

// The following code only runs in the worker thread so it is never reported for coverage
/* istanbul ignore next */
if (parentPort !== null) {
  const parent = parentPort
  const handleCall = async ([func, args]: ['call' | 'stop', unknown[]]): Promise<void> => {
    if (func === 'stop') {
      process.exit(0)
    } else if (func === 'call') {
      const [callID, wasmModule, context] = args
      const ret = await hclWorker.call(
        callID as number,
        wasmModule as WebAssembly.Module,
        context as HclCallContext,
      )
      parent.postMessage([callID, ret])
    }
  }
  parent.on('message', handleCall)
  parent.on('close', () => process.exit(0))
}
