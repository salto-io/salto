import path from 'path'
import * as fs from 'async-file'
import './wasm_exec'

// Not sure why eslint ignores this definition from wasm_exec.d.ts but this doesn't work without the following disable
// eslint-disable-next-line no-undef
const go = new Go()

class HCLParser {
  private wasmData: Promise<Buffer> | null = null

  get wasmModule(): Promise<WebAssembly.ResultObject> {
    if (this.wasmData === null) {
      // Load web assembly module data once in the life of a parser
      this.wasmData = (async () => {
        // Relative path from source location
        const modulePath = path.join(__dirname, '..', '..', 'dist', 'hcl.wasm')
        return fs.readFile(modulePath)
      })()
    }

    return this.wasmData.then(data =>
      // Not sure why eslint ignores this definition from webassembly.d.ts but this doesn't work without the following disable
      // eslint-disable-next-line no-undef
      WebAssembly.instantiate(data, go.importObject)
    )
  }

  async Parse(src: Buffer, filename: string): Promise<HCLBlock> {
    const wasmModule = await this.wasmModule

    global.hclParserArgs = {
      src,
      filename,
    }

    await go.run(wasmModule.instance)

    const result: HCLBlock = global.hclParserReturn.value

    // cleanup
    delete global.hclParserArgs
    delete global.hclParserReturn

    return result
  }
}

export default new HCLParser()
