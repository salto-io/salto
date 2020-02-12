/*
*                      Copyright 2020 Salto Labs Ltd.
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
import * as path from 'path'
import { Diff2Html } from 'diff2html'

import { ObjectType, Field, BuiltinTypes, ElemID } from '@salto-io/adapter-api'
import { file } from '@salto-io/core'

import { getPlan } from '@salto-io/core/dist/src/core/plan'
import { createPlanDiff, UnifiedDiff, renderDiffView } from '../src/format'

describe('Test extension format', () => {
  const addBaseID = new ElemID('salto', 'add')
  const removeBaseID = new ElemID('salto', 'remove')
  const modifyBaseID = new ElemID('salto', 'modify')
  const before = [
    new ObjectType(
      {
        elemID: removeBaseID,
        fields: {
          unchanged: new Field(removeBaseID, 'unchanged', BuiltinTypes.STRING),
          before: new Field(removeBaseID, 'before', BuiltinTypes.STRING),
        },
      }
    ),
    new ObjectType(
      {
        elemID: modifyBaseID,
        fields: {
          unchanged: new Field(removeBaseID, 'unchanged', BuiltinTypes.STRING),
          before: new Field(modifyBaseID, 'before', BuiltinTypes.STRING),
        },
      }
    ),
  ]
  const beforeShuffled = [
    new ObjectType(
      {
        elemID: removeBaseID,
        fields: {
          unchanged: new Field(removeBaseID, 'unchanged', BuiltinTypes.STRING),
          before: new Field(removeBaseID, 'before', BuiltinTypes.STRING),
        },
      }
    ),
    new ObjectType(
      {
        elemID: modifyBaseID,
        fields: {
          before: new Field(modifyBaseID, 'before', BuiltinTypes.STRING),
          unchanged: new Field(removeBaseID, 'unchanged', BuiltinTypes.STRING),
        },
      }
    ),
  ]
  const after = [
    new ObjectType(
      {
        elemID: addBaseID,
        fields: {
          unchanged: new Field(removeBaseID, 'unchanged', BuiltinTypes.STRING),
          before: new Field(addBaseID, 'before', BuiltinTypes.STRING),
        },
      }
    ),
    new ObjectType(
      {
        elemID: modifyBaseID,
        fields: {
          unchanged: new Field(removeBaseID, 'unchanged', BuiltinTypes.STRING),
          before: new Field(modifyBaseID, 'after', BuiltinTypes.STRING),
        },
      }
    ),
  ]


  const diffFile = path.resolve(`${__dirname}/../../test/diffs/all.diff`)
  const cssHref = '~/.vscode/extensions/salto/test.css'
  let expectedDif: UnifiedDiff
  let diff: UnifiedDiff
  let shuffledDiff: UnifiedDiff
  let html: string
  beforeAll(async () => {
    expectedDif = await file.readTextFile(diffFile)
    diff = await createPlanDiff((await getPlan(before, after)).itemsByEvalOrder())
    shuffledDiff = await createPlanDiff((await getPlan(beforeShuffled, after)).itemsByEvalOrder())
    html = renderDiffView(diff, [cssHref])
  })
  describe('create diff', () => {
    it('should create plan diff', () => {
      expect(diff).toEqual(expectedDif)
    })

    it('should not be effected by fields and values order', () => {
      expect(shuffledDiff).toEqual(expectedDif)
    })
  })


  describe('render html', () => {
    it('should render the diff as pretty html', () => {
      const htmlDiff = Diff2Html.getPrettyHtml(diff, { inputFormat: 'diff' })
      expect(html).toMatch(htmlDiff)
    })
    it('should convert the hrefs', () => {
      expect(html).toMatch(cssHref)
    })
  })
})
