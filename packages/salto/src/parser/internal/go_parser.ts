import fs from 'fs'
import { promisify } from 'util'
import path from 'path'
import { AsyncHclParser, HclParser } from './types'
import './wasm_exec'

const readFile = promisify(fs.readFile)

const loadWasmModule = async (): Promise<WebAssembly.Module> => {
  // Relative path from source location
  const modulePath = path.join(__dirname, '..', '..', '..', 'hcl.wasm')
  const data = await readFile(modulePath)
  // Not sure why eslint ignores this definition from webassembly.d.ts,
  // but this doesn't work without the following disable
  // eslint-disable-next-line no-undef
  return WebAssembly.compile(data)
}

const GO_ENV = {
  // Go garbage collection target percentage (lower means more aggressive, default is 100)
  GOGC: '20',
  // Go garbage collection strategy, it seems like concurrent strategies do not work well
  // and causes the code to crash with bad pointers to go heap, so we set the strategy to
  // "stop the world" in every collection cycle to make garbage collection single threaded
  GODEBUG: 'gcstoptheworld=2',
}

let savedWasmModule: WebAssembly.Module

export const wasmModule = async (): Promise<WebAssembly.Module> => {
  if (!savedWasmModule) {
    savedWasmModule = await loadWasmModule()
  }
  return savedWasmModule
}

const wasmInstance = async (
  useWasmModule?: WebAssembly.Module
): Promise<{ go: Go; inst: WebAssembly.Instance }> => {
  // Not sure why eslint ignores this definition from webassembly.d.ts,
  // but this doesn't work without the following disable
  // eslint-disable-next-line no-undef
  const go = new Go()
  go.env = GO_ENV

  const m = useWasmModule ?? await wasmModule()

  // eslint-disable-next-line no-undef
  return { go, inst: await WebAssembly.instantiate(m, go.importObject) }
}

export const createInlineParser = async (
  useWasmModule?: WebAssembly.Module
): Promise<HclParser> => {
  const { go, inst } = await wasmInstance(useWasmModule)

  return new Promise(resolve => {
    const goMain = go.run(inst, [])
    let stopping = false

    process.nextTick(() => {
      const goHclParser = global.saltoGoHclParser
      resolve({
        ...global.saltoGoHclParser,
        stop: async () => {
          if (stopping) {
            return
          }
          stopping = true
          await goHclParser.stop()
          await goMain
        },
      })
    })
  })
}

// wraps a sync function with a promise of the same type
const asyncify = <
  TReturn,
  TArgs extends unknown,
  TFunc extends (...args: TArgs[]) => TReturn,
>(f: TFunc): (
  ...args: TArgs[]
) => Promise<TReturn> => (...args: TArgs[]): Promise<TReturn> => Promise.resolve(f(...args))

export const createInlineAsyncParser = async (
  useWasmModule?: WebAssembly.Module
): Promise<AsyncHclParser> => {
  const syncParser = await createInlineParser(useWasmModule)
  return {
    ...syncParser,
    parse: asyncify(syncParser.parse),
    dump: asyncify(syncParser.dump),
  }
}
