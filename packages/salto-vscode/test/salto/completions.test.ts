import * as path from 'path'
import * as fs from 'async-file'
import _ from 'lodash'

import { initWorkspace, SaltoWorkspace } from '../../src/salto/workspace'
import { getPositionContext } from '../../src/salto/context'
import {
  provideWorkspaceCompletionItems, SaltoCompletion,
} from '../../src/salto/completions/provider'

interface Pos {
  line: number
  col: number
}

describe('Test auto complete', () => {
  const getLine = (
    workspace: SaltoWorkspace,
    filename: string,
    pos: Pos
  ): string => {
    const bp = workspace.parsedBlueprints[filename]
    const fullLine = (bp) ? bp.buffer.toString().split('\n')[pos.line - 1] : ''
    return _.trimStart(fullLine.slice(0, pos.col))
  }

  const checkSuggestions = (
    suggestions: SaltoCompletion[],
    include: string[],
    exclude: string[]
  ): boolean => {
    const intersect = (
      arrA: string[],
      arrB: string[]
    ): string[] => arrA.filter(x => arrB.includes(x))

    const labels = suggestions.map(s => s.label)
    return intersect(labels, include).length === include.length
           && intersect(labels, exclude).length === 0
  }

  const kw = ['type']
  const types = [
    'vs_str',
    'vs_num',
    'vs_bool',
    'vs_person',
    'vs_car',
    'vs_loan',
  ]
  const instances = [
    'vs_weekend_car',
    'vs_lavi',
    'vs_evyatar',
  ]

  let workspace: SaltoWorkspace
  let bpContent: string
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/completionsBP`)
  const bpFileName = path.resolve(`${baseBPDir}/all.bp`)
  beforeAll(async () => {
    workspace = await initWorkspace(baseBPDir)
    bpContent = await fs.readFile(bpFileName, 'utf8')
  })

  describe('empty line', () => {
    it('should suggest type and instances as first word', () => {
      const pos = { line: 74, col: 0 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...kw, ...types]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('type def line', () => {
    it('should suggest type as 1st token', () => {
      const pos = { line: 1, col: 0 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...kw, ...types]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest types as 2nd token', () => {
      const pos = { line: 1, col: 6 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types]
      const exclude = [...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest "is" as 3rd token', () => {
      const pos = { line: 1, col: 13 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['is']
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest primitive type as 4th token', () => {
      const pos = { line: 1, col: 16 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['string', 'boolean', 'number']
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('field def inside type', () => {
    it('should suggest all fields for 1st token', () => {
      const pos = { line: 33, col: 5 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types]
      const exclude = [...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest updates', () => {
      const pos = { line: 33, col: 4 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['update first_name', 'update last_name', 'update age']
      const exclude = ['update car_owner', ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing for field name ', () => {
      const pos = { line: 33, col: 12 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      expect(suggestions.length).toBe(0)
    })
  })

  describe('annotation values definitions in field', () => {
    it('should give field annotaion as 1st token', () => {
      const pos = { line: 34, col: 9 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label', '_required']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give eq as 2nd token', () => {
      const pos = { line: 34, col: 15 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['=']
      const exclude = ['label', '_required', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give "" as 3rd token for string', () => {
      const pos = { line: 34, col: 16 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give true/false as 3rd token for boolean', () => {
      const pos = { line: 35, col: 20 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['true', 'false']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give  nothing as 3rd token for number', () => {
      const pos = { line: 92, col: 14 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      expect(suggestions.length).toBe(0)
    })
  })

  describe('instance definition', () => {
    it('should types as 1st token', () => {
      const pos = { line: 87, col: 0 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types, ...kw]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should instace names as 2nd token', () => {
      const pos = { line: 87, col: 8 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...instances]
      const exclude = [...types, ...kw]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('instance values', () => {
    it('should give fields in 1st token', () => {
      const pos = { line: 88, col: 4 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = ['car_owner', 'model', 'year', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give fields in 1st token - nested', () => {
      const pos = { line: 95, col: 9 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['car_owner', 'model', 'year']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      console.log(suggestions, include, exclude)
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give eq as 2nd token', () => {
      const pos = { line: 88, col: 11 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['=']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token', () => {
      const pos = { line: 89, col: 13 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token - nested', () => {
      const pos = { line: 95, col: 20 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token - nested more then once', () => {
      const pos = { line: 96, col: 25 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return restriction values', () => {
      const pos = { line: 104, col: 11 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['"ticket"', '"accident"', '"to much fun"']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return list brackets', () => {
      const pos = { line: 143, col: 16 }
      const line = getLine(workspace, bpFileName, pos)
      console.log("LINE:", line)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['[]']
      const exclude = [...types, ...kw, ...instances]
      console.log("SUG:", suggestions)
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return list inside value', () => {
      const pos = { line: 143, col: 24 }
      const line = getLine(workspace, bpFileName, pos)
      const ctx = getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })
})
