import { ElemID } from 'adapter-api'

export type ExpressionType = 'list'|'map'|'template'|'literal'|'reference'

export type HclExpression = {
  type: ExpressionType
  expressions: HclExpression[]
  source: SourceRange
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any
}

export type HclAttribute = {
  source: SourceRange
  expressions: HclExpression[]
}

// TODO: add "blocks" with recursive reference when it's allowed in TS3.7
export type HclBlock = {
  type: string
  labels: string[]
  attrs: Record<string, HclAttribute>
}

export type ParsedHclBlock = HclBlock & {
  blocks: ParsedHclBlock[]
  source: SourceRange
}

export type DumpedHclBlock = HclBlock & {
  blocks: DumpedHclBlock[]
}

// hcl.Diagnostic struct taken from
// https://github.com/hashicorp/hcl2/blob/f45c1cd/hcl/diagnostic.go#L26
// TODO: include expression and evalContext when it's needed
export interface HclParseError {
  severity: number
  summary: string
  detail: string
  subject: SourceRange
  context?: SourceRange
}

export interface HclParseArgs {
  src: string
  filename: string
}

export interface HclParseReturn {
  body: Pick<ParsedHclBlock, 'attrs' | 'blocks'>
  errors: HclParseError[]
}

export interface HclDumpArgs {
  body: DumpedHclBlock
}


export type HclDumpReturn = string

export type HclArgs = HclParseArgs | HclDumpArgs
export type HclReturn = HclParseReturn | HclDumpReturn

export interface HclCallContext {
  func: 'parse' | 'dump'
  callback?: () => void
  args: HclArgs
  return?: HclReturn
}

export interface SourcePos {
  line: number
  col: number
  byte: number
}

export interface SourceRange {
  filename: string
  start: SourcePos
  end: SourcePos
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isSourceRange(v: any): v is SourceRange {
  return v && typeof v.filename === 'string' && v.start && v.end
}

export class SourceMap extends Map<string, SourceRange[]> {
  push(id: ElemID, source: SourceRange | { source: SourceRange }): void {
    const key = id.getFullName()
    let sourceRangeList = this.get(key)
    if (!sourceRangeList) {
      sourceRangeList = []
      this.set(key, sourceRangeList)
    }
    const sourceRange = isSourceRange(source) ? source : source.source
    sourceRangeList.push(sourceRange)
  }
}
