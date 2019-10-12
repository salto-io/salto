import * as fs from 'async-file'
import * as path from 'path'

import { ObjectType, Field, BuiltinTypes, ElemID } from 'adapter-api'

import { createChangeDiff } from '../src/format'

describe('Test extension format', () => {
  const baseID = new ElemID('salto', 'base')
  const before = new ObjectType(
    {
      elemID: baseID,
      fields: {
        before: new Field(baseID, 'before', BuiltinTypes.STRING),
      },
    }
  )
  const after = new ObjectType(
    {
      elemID: baseID,
      fields: {
        after: new Field(baseID, 'after', BuiltinTypes.STRING),
      },
    }
  )
  const baseDiffDir = path.resolve(`${__dirname}/../../test/diffs`)
  let addDiff: string
  let removalDiff: string
  let modDiff: string

  beforeAll(async () => {
    addDiff = await fs.readFile(path.resolve(`${baseDiffDir}/addition.diff`), 'utf8')
    removalDiff = await fs.readFile(path.resolve(`${baseDiffDir}/removal.diff`), 'utf8')
    modDiff = await fs.readFile(path.resolve(`${baseDiffDir}/modification.diff`), 'utf8')
  })

  it('should create unified diff for an addition of an element', async () => {
    const diff = await createChangeDiff(0, undefined, after)
    expect(diff).toEqual(addDiff)
  })
  it('should create unified diff for a removal of an element', async () => {
    const diff = await createChangeDiff(0, before, undefined)
    expect(diff).toEqual(removalDiff)
  })
  it('should create unified diff for a modification of an element', async () => {
    const diff = await createChangeDiff(0, before, after)
    expect(diff).toEqual(modDiff)
  })
})
