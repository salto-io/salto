import * as path from 'path'
import { Diff2Html } from 'diff2html'

import { ObjectType, Field, BuiltinTypes, ElemID } from 'adapter-api'
import { file } from 'salto'

import { getPlan } from 'salto/dist/src/core/plan'
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
    diff = await createPlanDiff((await getPlan({
      beforeElements: before,
      afterElements: after,
    })).itemsByEvalOrder())
    shuffledDiff = await createPlanDiff((await getPlan({
      beforeElements: beforeShuffled,
      afterElements: after,
    })).itemsByEvalOrder())
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
