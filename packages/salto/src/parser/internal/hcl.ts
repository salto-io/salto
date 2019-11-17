import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { Worker } from 'worker_threads'
import {
  HclParseReturn, DumpedHclBlock, HclDumpReturn, HclReturn, HclWorkerFuncNames, HclArgs,
} from './types'
import { hclWorker, WorkerInterface } from './worker'

// We must use the standard readFile here beacuse we want to read things that are inside the
// packaged application
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

type HclWorker = WorkerInterface & {
  stop: () => Promise<void>
}
type HclReturnResolver = (ret: HclReturn) => void
const createThreadWorker = async (): Promise<HclWorker> => {
  const activeCalls = new Map<number, HclReturnResolver>()
  const workerData = await Promise.all([
    // Since worker cannot load wasm_exec dynamically when packaged, we run both modules together
    readFile(require.resolve('./wasm_exec')),
    readFile(require.resolve('./worker')),
  ])
  const worker = new Worker(workerData.join('\n'), { eval: true })
  worker.on('message', ([callID, ret]: [number, HclReturn]): void => {
    const resolver = activeCalls.get(callID) as HclReturnResolver
    resolver(ret)
    activeCalls.delete(callID)
  })
  return {
    call: (callID, wasmModule, context) => new Promise<HclReturn>(resolve => {
      activeCalls.set(callID, resolve)
      worker.postMessage(['call', [callID, wasmModule, context]])
    }),
    stop: () => new Promise<void>(resolve => {
      worker.on('exit', resolve)
      worker.postMessage(['stop', []])
    }),
  }
}

// Exported only for tests, any other use case should use the default export
export class HclParserCls {
  private activeCallIDs = new Set<number>()
  private workerInstance: Promise<HclWorker> | null = null
  private wasmModuleInstance: Promise<WebAssembly.Module> | null = null

  constructor(
    private singleThreaded = true,
  ) {}

  setThreading(singleThreaded: boolean): void {
    this.singleThreaded = singleThreaded
  }

  private get worker(): Promise<HclWorker> {
    if (this.workerInstance === null) {
      this.workerInstance = this.singleThreaded
        ? Promise.resolve({ call: hclWorker.call, stop: () => Promise.resolve() })
        : createThreadWorker()
    }
    return this.workerInstance
  }

  private get wasmModule(): Promise<WebAssembly.Module> {
    if (this.wasmModuleInstance === null) {
      this.wasmModuleInstance = loadWasmModule()
    }
    return this.wasmModuleInstance
  }

  private async callWorker(func: HclWorkerFuncNames, args: HclArgs): Promise<HclReturn> {
    // Generate call ID
    const currMaxID = _.max([0, ...this.activeCallIDs]) as number
    const callID = currMaxID + 1
    this.activeCallIDs.add(callID)

    // Call the actual function
    const res = await (await this.worker).call(callID, await this.wasmModule, { func, args })
    // Cleanup call ID and close pool if it is no longer used
    this.activeCallIDs.delete(callID)

    if (this.activeCallIDs.size === 0) {
      await this.stop()
    }
    return res
  }

  async stop(): Promise<void> {
    await (await this.worker).stop()
    this.workerInstance = null
  }

  /**
   * Parse serialized HCL data
   *
   * @param content The data to parse
   * @param filename The name of the file from which the data was read, this will be used
   *  in error messages to specify the location of each error
   * @returns body: The parsed HCL body
   *          errors: a list of errors encountered during parsing
   */
  parse(content: string, filename: string): Promise<HclParseReturn> {
    return this.callWorker('parse', { content, filename }) as Promise<HclParseReturn>
  }

  /**
   * Serialize structured HCL data to buffer
   *
   * @param body The HCL data to dump
   * @returns The serialized data
   */
  dump(body: DumpedHclBlock): Promise<HclDumpReturn> {
    return this.callWorker('dump', { body }) as Promise<HclDumpReturn>
  }
}

export default new HclParserCls()
