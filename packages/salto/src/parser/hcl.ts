import path from 'path'
import * as fs from 'async-file'
import './wasm_exec'

// Not sure why eslint ignores this definition from wasm_exec.d.ts,
// but this doesn't work without the following disable
// eslint-disable-next-line no-undef
const go = new Go()

class HCLParser {
  private wasmModule: Promise<WebAssembly.Module> | null = null

  get wasmInstance(): Promise<WebAssembly.Instance> {
    if (this.wasmModule === null) {
      // Load web assembly module data once in the life of a parser
      this.wasmModule = (async () => {
        // Relative path from source location
        const modulePath = path.join(__dirname, '..', '..', 'hcl.wasm')
        const data = await fs.readFile(modulePath)
        // Not sure why eslint ignores this definition from webassembly.d.ts,
        // but this doesn't work without the following disable
        // eslint-disable-next-line no-undef
        const wasmObj = await WebAssembly.instantiate(data, go.importObject)
        return wasmObj.module
      })()
    }

    // Not sure why eslint ignores this definition from webassembly.d.ts,
    // but this doesn't work without the following disable
    // eslint-disable-next-line no-undef
    return this.wasmModule.then(module => WebAssembly.instantiate(module, go.importObject))
  }

  async Parse(
    src: Buffer,
    filename: string,
  ): Promise<{ body: HCLBlock; errors: string[] }> {
    try {
      // Setup arguments to parse function
      global.hclParserArgs = {
        src,
        filename,
      }
      // Call parse function from go
      await go.run(await this.wasmInstance)
      // Return value should be populated by the above call
      return {
        body: global.hclParserReturn.value,
        errors: global.hclParserReturn.errors,
      }
    } finally {
      // cleanup args and return values
      delete global.hclParserArgs
      delete global.hclParserReturn
    }
  }
}

export default new HCLParser()
