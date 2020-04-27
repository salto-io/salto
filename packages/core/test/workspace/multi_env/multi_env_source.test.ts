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
import { createMockNaclFileSource } from '../../common/nacl_file_source'
import { multiEnvSource } from '../../../src/workspace/nacl_files/mutil_env/multi_env_source'
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
const commonNaclFiles = {
  'common.nacl': [commonObject],
  'partial.nacl': [commonObject],
}
const commonSourceRange = {
  start: { col: 0, line: 0, byte: 0 },
  end: { col: 0, line: 0, byte: 0 },
  filename: 'common.nacl',
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
    context: commonSourceRange,
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
  filename: 'env.nacl',
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
    context: envSourceRange,
  }],
})
const envNaclFiles = {
  'env.nacl': [envObject],
  'partial.nacl': [envObject],
}
const inactiveElemID = new ElemID('salto', 'inactive')
const inactiveObject = new ObjectType({
  elemID: inactiveElemID,
  fields: {
    field: new Field(inactiveElemID, 'field', BuiltinTypes.STRING),
  },
})
const inactiveNaclFiles = {
  'inenv.nacl': [inactiveObject],
  'partial.nacl': [inactiveObject],
}
const inactiveSourceRange = {
  start: { col: 0, line: 0, byte: 0 },
  end: { col: 0, line: 0, byte: 0 },
  filename: 'inenv.nacl',
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
    context: inactiveSourceRange,
  }],
})
const commonSource = createMockNaclFileSource(
  [commonObject, commonFragment],
  commonNaclFiles,
  commonErrors,
  [commonSourceRange]
)
const envSource = createMockNaclFileSource(
  [envObject, envFragment],
  envNaclFiles,
  envErrors,
  [envSourceRange]
)
const inactiveSource = createMockNaclFileSource(
  [inactiveObject, inactiveFragment],
  inactiveNaclFiles,
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
  describe('getNaclFile', () => {
    it('should return a Nacl file from an env', async () => {
      const relPath = 'env.nacl'
      const fullPath = path.join(activePrefix, relPath)
      const naclFile = await source.getNaclFile(fullPath)
      expect(naclFile).toBeDefined()
      expect(naclFile?.filename).toEqual(fullPath)
      expect(await source.getNaclFile(relPath)).not.toBeDefined()
    })
    it('should return a Nacl file from the common env', async () => {
      const relPath = 'common.nacl'
      const fullPath = path.join(commonPrefix, relPath)
      const naclFile = await source.getNaclFile(fullPath)
      expect(naclFile).toBeDefined()
      expect(naclFile?.filename).toEqual(fullPath)
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
      await source.updateNaclFiles(changes)
      expect(envSource.updateNaclFiles).toHaveBeenCalled()
      expect(commonSource.updateNaclFiles).toHaveBeenCalled()
      expect(inactiveSource.updateNaclFiles).not.toHaveBeenCalled()
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
  describe('listNaclFiles', () => {
    it('shoud list all Nacl files', async () => {
      const naclFiles = await source.listNaclFiles()
      expect(naclFiles).toHaveLength(4)
      expectToContainAllItems(naclFiles, [
        ..._.keys(commonNaclFiles),
        ..._.keys(envNaclFiles).map(p => path.join(activePrefix, p)),
      ])
    })
  })
  describe('setNaclFiles', () => {
    it('should forward the setNaclFile command to the active source', async () => {
      const naclFile = {
        filename: path.join(activePrefix, 'env.nacl'),
        buffer: '',
      }
      await source.setNaclFiles(naclFile)
      expect(envSource.setNaclFiles).toHaveBeenCalled()
    })

    it('should forward the setNaclFile command to the common source', async () => {
      const naclFile = {
        filename: path.join(commonPrefix, 'common.nacl'),
        buffer: '',
      }
      await source.setNaclFiles(naclFile)
      expect(commonSource.setNaclFiles).toHaveBeenCalled()
    })
  })
  describe('removeNaclFiles', () => {
    it('should forward the removeNaclFiles command to the active source', async () => {
      await source.removeNaclFiles(path.join(activePrefix, 'env.nacl'))
      expect(envSource.removeNaclFiles).toHaveBeenCalled()
    })

    it('should forward the removeNaclFiles command to the common source', async () => {
      await source.removeNaclFiles(path.join(commonPrefix, 'common.nacl'))
      expect(envSource.removeNaclFiles).toHaveBeenCalled()
    })
  })
  describe('getSourceMap', () => {
    it('should forward the getSourceMap command to the active source', async () => {
      await source.getSourceMap(path.join(activePrefix, 'env.nacl'))
      expect(envSource.getSourceMap).toHaveBeenCalled()
    })

    it('should forward the getSourceMap command to the common source', async () => {
      await source.getSourceMap(path.join(commonPrefix, 'common.nacl'))
      expect(commonSource.getSourceMap).toHaveBeenCalled()
    })
  })
  describe('getSourceRanges', () => {
    it('should return source ranges from the active sources only', async () => {
      const ranges = await source.getSourceRanges(objectElemID)
      const filenames = ranges.map(r => r.filename)
      expect(filenames).toHaveLength(2)

      expectToContainAllItems(filenames, [
        path.join(activePrefix, 'env.nacl'),
        path.join(commonPrefix, 'common.nacl'),
      ])
    })
  })
  describe('getErrors', () => {
    it('should return errors from the active sources only', async () => {
      const errors = await source.getErrors()
      const filenames = errors.parse.map(e => e.subject.filename)
      expect(filenames).toHaveLength(2)
      expectToContainAllItems(filenames, [
        path.join(activePrefix, 'env.nacl'),
        path.join(commonPrefix, 'common.nacl'),
      ])
    })
  })
  describe('getElements', () => {
    it('should forward the getElements command to the active source', async () => {
      await source.getSourceMap(path.join(activePrefix, 'env.nacl'))
      expect(envSource.getSourceMap).toHaveBeenCalled()
    })

    it('should forward the getElements command to the common source', async () => {
      await source.getElements(path.join(commonPrefix, 'common.nacl'))
      expect(commonSource.getElements).toHaveBeenCalled()
    })
  })
})
