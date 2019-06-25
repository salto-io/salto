declare class HCLBlock {
  type: string
  labels: string[]
  attrs: Record<string, any>
  blocks: HCLBlock[]
}

declare class HclParserArgs {
  src: Buffer
  filename: string
}

declare class HclParserReturn {
  value: HCLBlock
  errors: string[]
}

declare namespace NodeJS {
  interface Global {
    hclParserArgs: HclParserArgs
    hclParserReturn: HclParserReturn
  }
}