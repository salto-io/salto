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
import path from 'path'
import { ElemID, Field, BuiltinTypes, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { createMockBlueprintSource } from '../../common/blueprint_source'
import { multiEnvSource } from '../../../src/workspace/blueprints/mutil_env/multi_env_source'
import { Errors } from '../../../src/workspace/errors'
import { ValidationError } from '../../../src/core/validator'
import { MergeError } from '../../../src/core/merger/internal/common'
import { expectToContainAllItems } from '../../common/helpers'
import { DetailedChange } from '../../../src/core/plan'

const objectElemID = new ElemID('salto', 'object')
const commonField = new Field(objectElemID, 'commonField', BuiltinTypes.STRING)
const envField = new Field(objectElemID, 'envField', BuiltinTypes.STRING)
const inactiveField = new Field(objectElemID, 'inactiveField', BuiltinTypes.STRING)
const commonFragment = new ObjectType({
  elemID: objectElemID,
  fields: {
    commonField,
  },
})
const envFragment = new ObjectType({
  elemID: objectElemID,
  fields: {
    envField,
  },
})

const inactiveFragment = new ObjectType({
  elemID: objectElemID,
  fields: {
    inactiveField,
  },
})
const commonElemID = new ElemID('salto', 'common')
const commonObject = new ObjectType({
  elemID: commonElemID,
  fields: {
    field: new Field(commonElemID, 'field', BuiltinTypes.STRING),
  },
})
const commonBlueprints = {
  'common.bp': [commonObject],
  'partial.bp': [commonObject],
}
const commonSourceRange = {
  start: { col: 0, line: 0, byte: 0 },
  end: { col: 0, line: 0, byte: 0 },
  filename: 'common.bp',
}
const commonErrors = new Errors({
  validation: [] as ValidationError[],
  merge: [] as MergeError[],
  parse: [{
    severity: 'Error',
    summary: 'common error',
    detail: 'common error',
    subject: commonSourceRange,
    message: 'common error',
  }],
})

const envElemID = new ElemID('salto', 'env')
const envObject = new ObjectType({
  elemID: envElemID,
  fields: {
    field: new Field(envElemID, 'field', BuiltinTypes.STRING),
  },
})
const envSourceRange = {
  start: { col: 0, line: 0, byte: 0 },
  end: { col: 0, line: 0, byte: 0 },
  filename: 'env.bp',
}
const envErrors = new Errors({
  validation: [] as ValidationError[],
  merge: [] as MergeError[],
  parse: [{
    severity: 'Error',
    summary: 'env error',
    detail: 'env error',
    subject: envSourceRange,
    message: 'env error',
  }],
})
const envBlueprints = {
  'env.bp': [envObject],
  'partial.bp': [envObject],
}
const inactiveElemID = new ElemID('salto', 'inactive')
const inactiveObject = new ObjectType({
  elemID: inactiveElemID,
  fields: {
    field: new Field(inactiveElemID, 'field', BuiltinTypes.STRING),
  },
})
const inactiveBlueprints = {
  'inenv.bp': [inactiveObject],
  'partial.bp': [inactiveObject],
}
const inactiveSourceRange = {
  start: { col: 0, line: 0, byte: 0 },
  end: { col: 0, line: 0, byte: 0 },
  filename: 'inenv.bp',
}
const inactiveErrors = new Errors({
  validation: [] as ValidationError[],
  merge: [] as MergeError[],
  parse: [{
    severity: 'Error',
    summary: 'inactive error',
    detail: 'inactive error',
    subject: inactiveSourceRange,
    message: 'inactive error',
  }],
})
const commonSource = createMockBlueprintSource(
  [commonObject, commonFragment],
  commonBlueprints,
  commonErrors,
  [commonSourceRange]
)
const envSource = createMockBlueprintSource(
  [envObject, envFragment],
  envBlueprints,
  envErrors,
  [envSourceRange]
)
const inactiveSource = createMockBlueprintSource(
  [inactiveObject, inactiveFragment],
  inactiveBlueprints,
  inactiveErrors,
  [inactiveSourceRange]
)

const activePrefix = 'envs/active'
const inactivePrefix = 'envs/inactive'
const commonPrefix = ''
const sources = {
  [commonPrefix]: commonSource,
  [activePrefix]: envSource,
  [inactivePrefix]: inactiveSource,
}
const source = multiEnvSource(sources, activePrefix, commonPrefix)

describe('multi env source', () => {
  describe('getBlueprint', () => {
    it('should return a blueprint from an env', async () => {
      const relPath = 'env.bp'
      const fullPath = path.join(activePrefix, relPath)
      const bp = await source.getBlueprint(fullPath)
      expect(bp).toBeDefined()
      expect(bp?.filename).toEqual(fullPath)
      expect(await source.getBlueprint(relPath)).not.toBeDefined()
    })
    it('should return a blueprint from the common env', async () => {
      const relPath = 'common.bp'
      const fullPath = path.join(commonPrefix, relPath)
      const bp = await source.getBlueprint(fullPath)
      expect(bp).toBeDefined()
      expect(bp?.filename).toEqual(fullPath)
    })
  })
  describe('update', () => {
    it('should route an update to the proper sub source', async () => {
      const changes: DetailedChange[] = [
        {
          action: 'remove',
          data: {
            before: commonObject,
          },
          id: commonElemID,
        },
        {
          action: 'remove',
          data: {
            before: envObject,
          },
          id: envElemID,
        },
      ]
      await source.update(changes)
      expect(envSource.update).toHaveBeenCalled()
      expect(commonSource.update).toHaveBeenCalled()
      expect(inactiveSource.update).not.toHaveBeenCalled()
    })
  })
  describe('flush', () => {
    it('should flush all sub sources', async () => {
      await source.flush()
      expect(commonSource.flush).toHaveBeenCalled()
      expect(envSource.flush).toHaveBeenCalled()
      expect(inactiveSource.flush).toHaveBeenCalled()
    })
  })
  describe('list', () => {
    it('should list elements from all active sources and not inactive sources', async () => {
      const elements = await source.list()
      expect(elements).toHaveLength(3)
      expectToContainAllItems(elements, [commonElemID, envElemID, objectElemID])
      expect(elements).not.toContain(inactiveElemID)
    })
  })
  describe('get', () => {
    it('should return the merged element', async () => {
      const elem = (await source.get(objectElemID)) as ObjectType
      expect(elem.fields).toEqual({
        commonField,
        envField,
      })
    })
    it('should not return the elements from inactive envs', async () => {
      expect(await source.get(inactiveElemID)).not.toBeDefined()
    })
  })
  describe('getAll', () => {
    it('should return all merged elements', async () => {
      const elements = await source.getAll()
      expect(elements).toHaveLength(3)
      expectToContainAllItems(
        elements.map(e => e.elemID),
        [commonElemID, envElemID, objectElemID]
      )
      expect(elements).not.toContain(inactiveObject)
      const obj = elements.find(e => _.isEqual(e.elemID, objectElemID)) as ObjectType
      expect(obj.fields).toEqual({
        commonField,
        envField,
      })
    })
  })
  describe('listBlueprints', () => {
    it('shoud list all blueprints', async () => {
      const bps = await source.listBlueprints()
      expect(bps).toHaveLength(4)
      expectToContainAllItems(bps, [
        ..._.keys(commonBlueprints),
        ..._.keys(envBlueprints).map(p => path.join(activePrefix, p)),
      ])
    })
  })
  describe('setBlueprints', () => {
    it('should forward the setBlueprint command to the active source', async () => {
      const bp = {
        filename: path.join(activePrefix, 'env.bp'),
        buffer: '',
      }
      await source.setBlueprints(bp)
      expect(envSource.setBlueprints).toHaveBeenCalled()
    })

    it('should forward the setBlueprint command to the common source', async () => {
      const bp = {
        filename: path.join(commonPrefix, 'common.bp'),
        buffer: '',
      }
      await source.setBlueprints(bp)
      expect(commonSource.setBlueprints).toHaveBeenCalled()
    })
  })
  describe('removeBlueprints', () => {
    it('should forward the removeBlueprints command to the active source', async () => {
      await source.removeBlueprints(path.join(activePrefix, 'env.bp'))
      expect(envSource.removeBlueprints).toHaveBeenCalled()
    })

    it('should forward the removeBlueprints command to the common source', async () => {
      await source.removeBlueprints(path.join(commonPrefix, 'common.bp'))
      expect(envSource.removeBlueprints).toHaveBeenCalled()
    })
  })
  describe('getSourceMap', () => {
    it('should forward the getSourceMap command to the active source', async () => {
      await source.getSourceMap(path.join(activePrefix, 'env.bp'))
      expect(envSource.getSourceMap).toHaveBeenCalled()
    })

    it('should forward the getSourceMap command to the common source', async () => {
      await source.getSourceMap(path.join(commonPrefix, 'common.bp'))
      expect(commonSource.getSourceMap).toHaveBeenCalled()
    })
  })
  describe('getSourceRanges', () => {
    it('should return source ranges from the active sources only', async () => {
      const ranges = await source.getSourceRanges(objectElemID)
      const filenames = ranges.map(r => r.filename)
      expect(filenames).toHaveLength(2)

      expectToContainAllItems(filenames, [
        path.join(activePrefix, 'env.bp'),
        path.join(commonPrefix, 'common.bp'),
      ])
    })
  })
  describe('getErrors', () => {
    it('should return errors from the active sources only', async () => {
      const errors = await source.getErrors()
      const filenames = errors.parse.map(e => e.subject.filename)
      expect(filenames).toHaveLength(2)
      expectToContainAllItems(filenames, [
        path.join(activePrefix, 'env.bp'),
        path.join(commonPrefix, 'common.bp'),
      ])
    })
  })
  describe('getElements', () => {
    it('should forward the getElements command to the active source', async () => {
      await source.getSourceMap(path.join(activePrefix, 'env.bp'))
      expect(envSource.getSourceMap).toHaveBeenCalled()
    })

    it('should forward the getElements command to the common source', async () => {
      await source.getElements(path.join(commonPrefix, 'common.bp'))
      expect(commonSource.getElements).toHaveBeenCalled()
    })
  })
})
