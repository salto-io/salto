declare class HCLBlock {
  type: string
  labels: string[]
  attrs: Record<string, any>
  blocks: HCLBlock[]
}

declare class HclParseArgs {
  src: Buffer
  filename: string
  callback: () => void
}

declare class HclParseReturn {
  body: HCLBlock
  errors: string[]
}

declare class HclDumpArgs {
  body: HCLBlock
  callback: () => void
}

type HclDumpReturn = Buffer

declare namespace NodeJS {
  interface Global {
    hclParserFunc: string
    hclParserArgs: HclParseArgs | HclDumpArgs
    hclParserReturn: HclParseReturn | HclDumpReturn
  }
}