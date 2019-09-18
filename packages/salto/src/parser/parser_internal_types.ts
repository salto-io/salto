import { collections } from '@salto/lowerdash'
import { ElemID } from 'adapter-api'

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

export class SourceMap extends collections.map.DefaultMap<string, SourceRange[]> {
  constructor() {
    super(() => [])
  }

  push(id: ElemID, source: SourceRange | { source: SourceRange }): void {
    this.get(id.getFullName()).push(isSourceRange(source) ? source : source.source)
  }
}
