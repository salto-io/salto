import _ from 'lodash'
import path from 'path'
import { Worker } from 'worker_threads'
import { readFile } from '../../file'
import {
  HclParseReturn, DumpedHclBlock, HclDumpReturn, HclReturn, HclWorkerFuncNames, HclArgs,
} from './types'
import { hclWorker, WorkerInterface } from './worker'


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

const createThreadWorker = (): HclWorker => {
  const activeCalls: Record<number, (ret: HclReturn) => void> = {}
  const worker = new Worker(require.resolve('./worker'))
  worker.on('message', ([callId, ret]: [number, HclReturn]): void => {
    activeCalls[callId](ret)
    delete activeCalls[callId]
  })
  return {
    call: (callId, wasmModule, context) => new Promise<HclReturn>(resolve => {
      activeCalls[callId] = resolve
      worker.postMessage(['call', [callId, wasmModule, context]])
    }),
    stop: () => new Promise<void>(resolve => {
      worker.on('exit', resolve)
      worker.postMessage(['stop', []])
    }),
  }
}

// Exported only for tests, any other use case should use the default export
export class HclParserCls {
  private inFlightIDs = new Set<number>()
  private workerInst: HclWorker | null = null
  private wasmModuleInst: Promise<WebAssembly.Module> | null = null

  constructor(
    private singleThreaded = true,
  ) {}

  setThreading(singleThreaded: boolean): void {
    this.singleThreaded = singleThreaded
  }

  private get worker(): HclWorker {
    if (this.workerInst === null) {
      this.workerInst = this.singleThreaded
        ? { call: hclWorker.call, stop: () => Promise.resolve() }
        : createThreadWorker()
    }
    return this.workerInst
  }

  private get wasmModule(): Promise<WebAssembly.Module> {
    if (this.wasmModuleInst === null) {
      this.wasmModuleInst = loadWasmModule()
    }
    return this.wasmModuleInst
  }

  private async callWorker(func: HclWorkerFuncNames, args: HclArgs): Promise<HclReturn> {
    // Generate call ID
    const currMaxID = _.max([0, ...this.inFlightIDs]) as number
    const callID = currMaxID + 1
    this.inFlightIDs.add(callID)

    // Call the actual function
    const res = await this.worker.call(callID, await this.wasmModule, { func, args })
    // Cleanup call ID and close pool if it is no longer used
    this.inFlightIDs.delete(callID)

    if (this.inFlightIDs.size === 0) {
      await this.stop()
    }
    return res
  }

  async stop(): Promise<void> {
    await this.worker.stop()
    this.workerInst = null
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
