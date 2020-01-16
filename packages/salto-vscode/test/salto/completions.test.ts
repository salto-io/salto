import * as path from 'path'
import _ from 'lodash'

import { file } from 'salto'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getPositionContext } from '../../src/salto/context'
import {
  provideWorkspaceCompletionItems, SaltoCompletion,
} from '../../src/salto/completions/provider'
import { mockWorkspace } from './workspace'

interface Pos {
  line: number
  col: number
}

// TODO: figure how to fix this
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Test auto complete', () => {
  const getLine = async (
    workspace: EditorWorkspace,
    filename: string,
    pos: Pos
  ): Promise<string> => {
    const bp = await workspace.getParsedBlueprint(filename)
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
  const adapterRef = ['vs']
  const types = [
    'vs_str',
    'vs_num',
    'vs_bool',
    'vs_person',
    'vs_car',
    'vs_loan',
    'vs_ref_tester',
  ]
  const instances = [
    'weekend_car',
    'not_a_loan',
  ]

  let workspace: EditorWorkspace
  let bpContent: string

  const bpFileName = path.resolve(`${__dirname}/../../../test/salto/test-bps/all.bp`)
  beforeAll(async () => {
    workspace = new EditorWorkspace(await mockWorkspace(bpFileName))
    bpContent = await file.readTextFile(bpFileName)
  })

  describe('empty line', () => {
    it('should suggest type and instances as first word', async () => {
      const pos = { line: 74, col: 0 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...kw, ...types]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('type def line', () => {
    it('should suggest type as 1st token', async () => {
      const pos = { line: 1, col: 0 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...kw, ...types]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest types as 2nd token', async () => {
      const pos = { line: 1, col: 6 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types]
      const exclude = [...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest "is" as 3rd token', async () => {
      const pos = { line: 1, col: 13 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['is']
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest primitive type as 4th token', async () => {
      const pos = { line: 1, col: 16 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['string', 'boolean', 'number']
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('field def inside type', () => {
    it('should suggest all fields for 1st token', async () => {
      const pos = { line: 33, col: 5 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types]
      const exclude = [...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest updates', async () => {
      const pos = { line: 33, col: 4 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['update first_name', 'update last_name', 'update age']
      const exclude = ['update car_owner', ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing for field name ', async () => {
      const pos = { line: 33, col: 12 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      expect(suggestions.length).toBe(0)
    })
  })

  describe('annotation values definitions in field', () => {
    it('should give field annotation as 1st token', async () => {
      const pos = { line: 34, col: 8 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label', '_required']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give eq as 2nd token', async () => {
      const pos = { line: 34, col: 15 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['=']
      const exclude = ['label', '_required', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give "" as 3rd token for string', async () => {
      const pos = { line: 34, col: 16 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give true/false as 3rd token for boolean', async () => {
      const pos = { line: 35, col: 20 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['true', 'false']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give only adapter ref as 3rd token for number', async () => {
      const pos = { line: 92, col: 14 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('instance definition', () => {
    it('should types as 1st token', async () => {
      const pos = { line: 87, col: 0 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types, ...kw]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should instance names as 2nd token', async () => {
      const pos = { line: 87, col: 8 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...instances]
      const exclude = [...types, ...kw]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('instance values', () => {
    it('should give fields in 1st token', async () => {
      const pos = { line: 88, col: 4 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = ['car_owner', 'model', 'year', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give fields in 1st token - nested', async () => {
      const pos = { line: 95, col: 8 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['car_owner', 'model', 'year']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give eq as 2nd token', async () => {
      const pos = { line: 88, col: 11 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['=']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token', async () => {
      const pos = { line: 89, col: 13 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token - nested', async () => {
      const pos = { line: 95, col: 20 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token - nested more then once', async () => {
      const pos = { line: 96, col: 25 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return restriction values', async () => {
      const pos = { line: 104, col: 11 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['"ticket"', '"accident"', '"to much fun"', '"car"', '"plane"']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return list brackets', async () => {
      const pos = { line: 134, col: 16 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['[]']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return list inside value', async () => {
      const pos = { line: 134, col: 24 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })
  describe('references', () => {
    it('should suggest all adapters on empty first token', async () => {
      const pos = { line: 139, col: 17 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter', async () => {
      const pos = { line: 139, col: 20 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs_', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all instance fields', async () => {
      const pos = { line: 139, col: 45 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = ['car_owner', 'model', 'year', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all instance fields with 1 level nesting', async () => {
      const pos = { line: 142, col: 54 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['car_owner', 'model', 'year']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all instance fields with 2 level nesting', async () => {
      const pos = { line: 142, col: 64 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['first_name', 'last_name', 'age']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest fields when base is an object type', async () => {
      const pos = { line: 145, col: 31 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest annotations when base is an object type with 1 level nesting', async () => {
      const pos = { line: 145, col: 38 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing on empty first token in string without template', async () => {
      const pos = { line: 148, col: 17 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template', async () => {
      const pos = { line: 148, col: 19 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template', async () => {
      const pos = { line: 148, col: 22 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs_', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template', async () => {
      const pos = { line: 148, col: 34 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all field\'s annotations inside string template', async () => {
      const pos = { line: 148, col: 41 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing on empty first token in string with prefix without template', async () => {
      const pos = { line: 151, col: 21 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template with prefix', async () => {
      const pos = { line: 151, col: 23 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template with prefix', async () => {
      const pos = { line: 151, col: 26 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs_', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template with prefix', async () => {
      const pos = { line: 151, col: 38 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all field\'s annotations inside string template with prefix', async () => {
      const pos = { line: 151, col: 45 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing on empty first token in string with empty prefix without template', async () => {
      const pos = { line: 154, col: 21 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template with empty prefix', async () => {
      const pos = { line: 154, col: 23 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template with empty prefix', async () => {
      const pos = { line: 154, col: 26 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs_', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template with empty prefix', async () => {
      const pos = { line: 154, col: 38 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all field\'s annotations inside string template with empty prefix', async () => {
      const pos = { line: 154, col: 45 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    // /
    // /

    it('should suggest nothing on empty first token in string with complex prefix without template', async () => {
      const pos = { line: 157, col: 21 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template with complex prefix', async () => {
      const pos = { line: 157, col: 23 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template with complex prefix', async () => {
      const pos = { line: 157, col: 26 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs_', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template with complex prefix', async () => {
      const pos = { line: 157, col: 38 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all field\'s annotations inside string template with complex prefix', async () => {
      const pos = { line: 157, col: 45 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest a complex annotation fields', async () => {
      const pos = { line: 160, col: 42 }
      const line = await getLine(workspace, bpFileName, pos)
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['first_name', 'last_name']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return nothing on non-existing base element', async () => {
      const pos = { line: 139, col: 31 }
      const line = (await getLine(workspace, bpFileName, pos)).replace('vs_weekend_car', 'nothing')
      const ctx = await getPositionContext(workspace, bpContent, bpFileName, pos)
      const suggestions = provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })
})
