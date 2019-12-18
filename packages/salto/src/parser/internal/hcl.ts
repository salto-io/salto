import fs from 'fs'
import path from 'path'
import './wasm_exec'
import { queue, AsyncQueue, ErrorCallback } from 'async'
import { HclCallContext, HclParseReturn, DumpedHclBlock, HclDumpReturn, HclReturn } from './types'
import { parse as tsParse } from './ts_plugin/parse'
import { dump as tsDump } from './ts_plugin/dump'

export const useGoParser = (Object.keys(process.env).includes('SALTO_USE_GO_PARSER'))

class HclParser {
  // Limit max concurrency to avoid web assembly out of memory errors
  private static MAX_CONCURENCY = 10
  // Execution env vars for Go webassembly
  private static GO_ENV = {
    // Go garbage collection target percentage (lower means more aggressive, default is 100)
    GOGC: '20',
    // Go garbage collection strategy, it seems like concurrent strategies do not work well
    // and causes the code to crash with bad pointers to go heap, so we set the strategy to
    // "stop the world" in every collection cycle to make garbage collection single threaded
    GODEBUG: 'gcstoptheworld=2',
  }

  private wasmModule: Promise<WebAssembly.Module> | null = null
  private parseQueue: AsyncQueue<HclCallContext>

  public constructor() {
    global.hclParserCall = {}
    this.parseQueue = queue(this.pluginWorker.bind(this), HclParser.MAX_CONCURENCY)
  }

  /**
   * @returns a fresh instance of the HCL plugin web assembly module
   */
  private get wasmInstance(): Promise<{ go: Go; inst: WebAssembly.Instance }> {
    if (this.wasmModule === null) {
      // Load web assembly module data once in the life of a parser
      this.wasmModule = (async () => {
        // Relative path from source location
        const modulePath = path.join(__dirname, '..', '..', '..', 'hcl.wasm')
        const data = fs.readFileSync(modulePath)
        // Not sure why eslint ignores this definition from webassembly.d.ts,
        // but this doesn't work without the following disable
        // eslint-disable-next-line no-undef
        return WebAssembly.compile(data)
      })()
    }

    return this.wasmModule.then(async module => {
      // Not sure why eslint ignores this definition from webassembly.d.ts,
      // but this doesn't work without the following disable
      // eslint-disable-next-line no-undef
      const go = new Go()
      go.env = HclParser.GO_ENV
      // eslint-disable-next-line no-undef
      return { go, inst: await WebAssembly.instantiate(module, go.importObject) }
    })
  }

  private async pluginWorker(context: HclCallContext, done: ErrorCallback): Promise<void> {
    // Place call context in global object
    const { hclParserCall } = global
    const currCalls = Object.keys(hclParserCall).map(k => Number.parseInt(k, 10))
    const callId = currCalls.length === 0 ? 0 : Math.max(...currCalls) + 1
    hclParserCall[callId] = context

    try {
      // TODO: maybe refactor this?
      // eslint-disable-next-line no-async-promise-executor
      await new Promise<void>(async resolve => {
        // Set callback function in context
        context.callback = resolve

        // Call the go code
        const { go, inst } = await this.wasmInstance
        await go.run(inst, [callId.toString()])
      })

      // Return value should be populated by the above call
      done()
    } finally {
      // cleanup call context from global scope
      delete hclParserCall[callId]
    }
  }

  private callPlugin(context: HclCallContext): Promise<HclReturn> {
    return new Promise<HclReturn>(resolve => {
      this.parseQueue.push<HclReturn>(
        context,
        () => resolve(context.return)
      )
    })
  }

  /**
   * Parse serialized HCL data
   *
   * @param src The data to parse
   * @param filename The name of the file from which the data was read, this will be used
   *  in error messages to specify the location of each error
   * @returns body: The parsed HCL body
   *          errors: a list of errors encountered during parsing
   */
  public async parse(src: Buffer, filename: string, forceGo = false): Promise<HclParseReturn> {
    return useGoParser || forceGo
      ? this.callPlugin({ func: 'parse', args: { src: src.toString(), filename } }) as Promise<HclParseReturn>
      : tsParse(src, filename)
  }

  /**
   * Serialize structured HCL data to buffer
   *
   * @param body The HCL data to dump
   * @returns The serialized data
   */
  public dump(body: DumpedHclBlock, forceGo = false): Promise<HclDumpReturn> {
    return useGoParser || forceGo
      ? this.callPlugin({ func: 'dump', args: { body } }) as Promise<HclDumpReturn>
      : tsDump(body)
  }
}

export default new HclParser()
