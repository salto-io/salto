import path from 'path'
import * as fs from 'async-file'
import './wasm_exec'
import { queue, AsyncQueue, ErrorCallback } from 'async'

class HCLParser {
  // Limit max concurrency to avoid web assembly out of memory errors
  private static MAX_CONCURENCY = 10

  private wasmModule: Promise<WebAssembly.Module> | null = null
  private parseQueue: AsyncQueue<HclCallContext>

  public constructor() {
    global.hclParserCall = {}
    this.parseQueue = queue(this.pluginWorker.bind(this), HCLParser.MAX_CONCURENCY)
  }

  /**
   * @returns a fresh instance of the HCL plugin web assembly module
   */
  private get wasmInstance(): Promise<{ go: Go; inst: WebAssembly.Instance }> {
    if (this.wasmModule === null) {
      // Load web assembly module data once in the life of a parser
      this.wasmModule = (async () => {
        // Relative path from source location
        const modulePath = path.join(__dirname, '..', '..', 'hcl.wasm')
        const data = await fs.readFile(modulePath)
        // Not sure why eslint ignores this definition from webassembly.d.ts,
        // but this doesn't work without the following disable
        // eslint-disable-next-line no-undef
        const wasmObj = await WebAssembly.instantiate(data, new Go().importObject)
        return wasmObj.module
      })()
    }

    return this.wasmModule.then(async module => {
      // Not sure why eslint ignores this definition from webassembly.d.ts,
      // but this doesn't work without the following disable
      // eslint-disable-next-line no-undef
      const go = new Go()
      // eslint-disable-next-line no-undef
      return { go, inst: await WebAssembly.instantiate(module, go.importObject) }
    })
  }

  private async pluginWorker(context: HclCallContext, done: ErrorCallback): Promise<void> {
    // Place call context in global object
    const currCalls = Object.keys(global.hclParserCall).map(k => Number.parseInt(k, 10))
    const callId = currCalls.length === 0 ? 0 : Math.max(...currCalls) + 1
    global.hclParserCall[callId] = context

    try {
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
      delete global.hclParserCall[callId]
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
  public parse(src: Buffer, filename: string): Promise<HclParseReturn> {
    return this.callPlugin({ func: 'parse', args: { src, filename } }) as Promise<HclParseReturn>
  }

  /**
   * Serialize structured HCL data to buffer
   *
   * @param body The HCL data to dump
   * @returns The serialized data
   */
  public dump(body: HCLBlock): Promise<HclDumpReturn> {
    return this.callPlugin({ func: 'dump', args: { body } }) as Promise<HclDumpReturn>
  }
}

export default new HCLParser()
