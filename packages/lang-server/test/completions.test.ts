/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash'
import { CORE_ANNOTATIONS, ElemID, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import path from 'path'
import { EditorWorkspace } from '../src/workspace'
import { getPositionContext, PositionContext, buildDefinitionsTree } from '../src/context'
import { provideWorkspaceCompletionItems, SaltoCompletion } from '../src/completions/provider'
import { mockWorkspace } from './workspace'

const { awu } = collections.asynciterable
interface Pos {
  line: number
  col: number
}

// TODO: figure how to fix this

describe('Test auto complete', () => {
  const getLine = async (workspace: EditorWorkspace, filename: string, pos: Pos): Promise<string> => {
    const naclFile = await workspace.getNaclFile(filename)
    const fullLine = naclFile ? naclFile.buffer.toString().split('\n')[pos.line - 1] : ''
    return _.trimStart(fullLine.slice(0, pos.col))
  }

  const checkSuggestions = (suggestions: SaltoCompletion[], include: string[], exclude: string[]): boolean => {
    const intersect = (arrA: unknown[], arrB: unknown[]): unknown[] => arrA.filter(x => arrB.includes(x))

    const labels = suggestions.map(s => _.last(s.label.split(ElemID.NAMESPACE_SEPARATOR)))
    return intersect(labels, include).length === include.length && intersect(labels, exclude).length === 0
  }

  const kw = ['type']
  const adapterRef = ['vs']
  const types = ['str', 'num', 'bool', 'person', 'car', 'loan', 'ref_tester', 'annotated']
  const instances = ['weekend_car', 'not_a_loan']

  let workspace: EditorWorkspace
  let definitionsTree: PositionContext
  let fullElementSource: ReadOnlyElementsSource | undefined
  const baseDir = path.resolve(`${__dirname}/../test/test-nacls/`)
  const naclFileName = path.join(baseDir, 'all.nacl')
  beforeAll(async () => {
    workspace = new EditorWorkspace(baseDir, await mockWorkspace([path.join(baseDir, 'all.nacl')]))
    definitionsTree = buildDefinitionsTree(
      (await workspace.getNaclFile(naclFileName))?.buffer as string,
      await workspace.getSourceMap(naclFileName),
      await awu(await workspace.getElements(naclFileName)).toArray(),
    )
    fullElementSource = await workspace.getElementSourceOfPath(naclFileName)
  })

  describe('empty line', () => {
    it('should suggest type and instances as first word', async () => {
      const pos = { line: 74, col: 0 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...kw, ...types]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('type def line', () => {
    it('should suggest type as 1st token', async () => {
      const pos = { line: 1, col: 0 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...kw, ...types]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest types as 2nd token', async () => {
      const pos = { line: 1, col: 6 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types]
      const exclude = [...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest "is" as 3rd token', async () => {
      const pos = { line: 1, col: 13 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['is']
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest primitive type as 4th token', async () => {
      const pos = { line: 1, col: 16 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['string', 'boolean', 'number']
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('field def inside type', () => {
    it('should suggest all fields for 1st token', async () => {
      const pos = { line: 33, col: 5 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types]
      const exclude = [...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing for field name ', async () => {
      const pos = { line: 33, col: 12 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      expect(suggestions.length).toBe(0)
    })
  })

  describe('annotation values definitions in field', () => {
    it('should give field annotation as 1st token', async () => {
      const pos = { line: 34, col: 8 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label', '_required']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give eq as 2nd token', async () => {
      const pos = { line: 34, col: 15 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['=']
      const exclude = ['label', '_required', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give "" as 3rd token for string', async () => {
      const pos = { line: 34, col: 16 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give true/false as 3rd token for boolean', async () => {
      const pos = { line: 35, col: 20 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['true', 'false']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give nothing as 3rd token for number', async () => {
      const pos = { line: 92, col: 14 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      expect(suggestions).toEqual([])
    })
  })

  describe('annotation values definitions in type', () => {
    it('should give annotation Types as 1st token', async () => {
      const pos = { line: 208, col: 4 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loan']
      const exclude = [...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should give annotation value as 3rd token', async () => {
      const pos = { line: 208, col: 11 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should give annotation type fields as 1rd token in 1 level nesting', async () => {
      const pos = { line: 209, col: 8 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['reason', 'loaner', 'propety']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should give annotation type field value as 3rd token in 1 level nesting', async () => {
      const pos = { line: 210, col: 17 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should give field type fields as 1rd token in 2 levels nesting', async () => {
      const pos = { line: 216, col: 12 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['car_owner', 'model', 'year']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should give field type field value as 3rd token in 2 levels nesting', async () => {
      const pos = { line: 216, col: 24 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should give field type fields as 1rd token in 3 levels nesting', async () => {
      const pos = { line: 217, col: 16 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['first_name', 'last_name', 'age']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should give field type field value as 3rd token in 3 levels nesting', async () => {
      const pos = { line: 211, col: 25 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('instance definition', () => {
    it('should types as 1st token', async () => {
      const pos = { line: 87, col: 0 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types, ...kw]
      const exclude = [...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should instance names as 2nd token', async () => {
      const pos = { line: 87, col: 8 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...instances]
      const exclude = [...types, ...kw]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  describe('instance values', () => {
    it('should give fields in 1st token', async () => {
      const pos = { line: 88, col: 4 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only', 'risk']
      const exclude = ['car_owner', 'model', 'year', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give fields in 1st token - nested', async () => {
      const pos = { line: 95, col: 8 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['car_owner', 'model', 'year']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give eq as 2nd token', async () => {
      const pos = { line: 88, col: 11 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['=']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token', async () => {
      const pos = { line: 89, col: 13 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token - nested', async () => {
      const pos = { line: 95, col: 20 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['{}']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should give value as 3rd token - nested more then once', async () => {
      const pos = { line: 96, col: 25 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return restriction values', async () => {
      const pos = { line: 104, col: 11 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['"ticket"', '"accident"', '"to much fun"', '"car"', '"plane"']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return list brackets', async () => {
      const pos = { line: 139, col: 16 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['[]']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return list inside value', async () => {
      const pos = { line: 139, col: 24 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })

  it('should return list brackets for new element in list of list', async () => {
    const pos = { line: 140, col: 37 }
    const line = await getLine(workspace, naclFileName, pos)
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
    const include = ['[]']
    const exclude = [...types, ...kw, ...instances]
    expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
  })

  describe('references', () => {
    it('should suggest nothing on an empty first token', async () => {
      const pos = { line: 145, col: 16 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['""']
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
    it('should suggest adapters on a non empty first token', async () => {
      const pos = { line: 145, col: 17 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter', async () => {
      const pos = { line: 145, col: 19 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs.', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all instance fields', async () => {
      const pos = { line: 145, col: 45 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = ['car_owner', 'model', 'year', ...types, ...kw, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all instance fields with 1 level nesting', async () => {
      const pos = { line: 148, col: 53 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['car_owner', 'model', 'year']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all instance fields with 2 level nesting', async () => {
      const pos = { line: 148, col: 63 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['first_name', 'last_name', 'age']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest fields when base is an object type', async () => {
      const pos = { line: 151, col: 30 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest annotations when base is an object type with 1 level nesting', async () => {
      const pos = { line: 151, col: 37 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing on empty first token in string without template', async () => {
      const pos = { line: 154, col: 17 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template', async () => {
      const pos = { line: 154, col: 19 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template', async () => {
      const pos = { line: 154, col: 22 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs.', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template', async () => {
      const pos = { line: 154, col: 33 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only', 'risk']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it("should suggest all field's annotations inside string template", async () => {
      const pos = { line: 154, col: 41 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing on empty first token in string with prefix without template', async () => {
      const pos = { line: 157, col: 21 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template with prefix', async () => {
      const pos = { line: 157, col: 23 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template with prefix', async () => {
      const pos = { line: 157, col: 26 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs.', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template with prefix', async () => {
      const pos = { line: 157, col: 37 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only', 'risk']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it("should suggest all field's annotations inside string template with prefix", async () => {
      const pos = { line: 157, col: 45 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest nothing on empty first token in string with empty prefix without template', async () => {
      const pos = { line: 160, col: 21 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template with empty prefix', async () => {
      const pos = { line: 160, col: 23 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template with empty prefix', async () => {
      const pos = { line: 160, col: 26 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs.', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template with empty prefix', async () => {
      const pos = { line: 160, col: 37 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only', 'risk']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it("should suggest all field's annotations inside string template with empty prefix", async () => {
      const pos = { line: 160, col: 45 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    // /
    // /

    it('should suggest nothing on empty first token in string with complex prefix without template', async () => {
      const pos = { line: 163, col: 21 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = [...kw, ...types, ...instances, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all adapters on empty first token in template with complex prefix', async () => {
      const pos = { line: 163, col: 23 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...adapterRef]
      const exclude = [...kw, ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all types on first token with adapter in template with complex prefix', async () => {
      const pos = { line: 163, col: 26 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [...types].map(n => n.replace('vs.', ''))
      const exclude = [...kw, ...adapterRef]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest all fields inside string template with complex prefix', async () => {
      const pos = { line: 163, col: 37 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['loaner', 'reason', 'propety', 'weekends_only', 'risk']
      const exclude = [...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it("should suggest all field's annotations inside string template with complex prefix", async () => {
      const pos = { line: 163, col: 45 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['label']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should suggest a complex annotation fields', async () => {
      const pos = { line: 166, col: 41 }
      const line = await getLine(workspace, naclFileName, pos)
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = ['first_name', 'last_name']
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return nothing on non-existing base element', async () => {
      const pos = { line: 145, col: 31 }
      const line = (await getLine(workspace, naclFileName, pos)).replace('vs_weekend_car', 'nothing')
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include: string[] = []
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })

    it('should return instance annotations', async () => {
      const pos = { line: 198, col: 40 }
      const line = (await getLine(workspace, naclFileName, pos)).replace('vs_weekend_car', 'nothing')
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const suggestions = await provideWorkspaceCompletionItems(workspace, ctx, line, pos)
      const include = [CORE_ANNOTATIONS.PARENT]
      const exclude = ['loaner', 'reason', 'propety', 'weekends_only', ...types, ...instances]
      expect(checkSuggestions(suggestions, include, exclude)).toBe(true)
    })
  })
})
