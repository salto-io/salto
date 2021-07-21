/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element, ElemID, BuiltinTypes, ObjectType, DetailedChange, Change, getChangeElement, StaticFile } from '@salto-io/adapter-api'
import _ from 'lodash'
import * as utils from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { createElementSelectors } from '../../../src/workspace/element_selector'
import { createMockNaclFileSource } from '../../common/nacl_file_source'
import { multiEnvSource, ENVS_PREFIX } from '../../../src/workspace/nacl_files/multi_env/multi_env_source'
import * as routers from '../../../src/workspace/nacl_files/multi_env/routers'
import { Errors } from '../../../src/workspace/errors'
import { ValidationError } from '../../../src/validator'
import { MergeError } from '../../../src/merger'
import { expectToContainAllItems } from '../../common/helpers'
import { InMemoryRemoteMap } from '../../../src/workspace/remote_map'
import { mockStaticFilesSource } from '../../utils'
import { MissingStaticFile } from '../../../src/workspace/static_files'

const { awu } = collections.asynciterable
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  applyInstanceDefaults: jest.fn().mockImplementation(e => e),
}))

const sortElemArray = (arr: Element[]): Element[] => _.sortBy(arr, e => e.elemID.getFullName())
const objectElemID = new ElemID('salto', 'object')
const commonFragment = new ObjectType({
  elemID: objectElemID,
  fields: {
    commonField: {
      refType: utils.createRefToElmWithValue(BuiltinTypes.STRING),
    },
  },
})
const envFragment = new ObjectType({
  elemID: objectElemID,
  fields: {
    envField: {
      refType: utils.createRefToElmWithValue(BuiltinTypes.STRING),
    },
  },
})
const inactiveFragment = new ObjectType({
  elemID: objectElemID,
  fields: {
    inactiveField: {
      refType: utils.createRefToElmWithValue(BuiltinTypes.STRING),
    },
  },
})
const commonElemID = new ElemID('salto', 'common')
const commonObject = new ObjectType({
  elemID: commonElemID,
  fields: {
    field: {
      refType: utils.createRefToElmWithValue(BuiltinTypes.STRING),
    },
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
    subject: commonSourceRange,
    message: 'common error',
    context: commonSourceRange,
  }],
})

const envElemID = new ElemID('salto', 'env')
const envObject = new ObjectType({
  elemID: envElemID,
  fields: {
    field: {
      refType: utils.createRefToElmWithValue(BuiltinTypes.STRING),
    },
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
    field: {
      refType: utils.createRefToElmWithValue(BuiltinTypes.STRING),
    },
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
    subject: inactiveSourceRange,
    message: 'inactive error',
    context: inactiveSourceRange,
  }],
})
const emptySource = createMockNaclFileSource(
  [],
  {},
  commonErrors,
  []
)
const commonSrcStaticFileSource = mockStaticFilesSource()
const commonSource = createMockNaclFileSource(
  [commonObject, commonFragment],
  commonNaclFiles,
  commonErrors,
  [commonSourceRange],
  { changes: [], cacheValid: true },
  commonSrcStaticFileSource
)

const envSrcStaticFileSource = mockStaticFilesSource()
const envSource = createMockNaclFileSource(
  [envObject, envFragment],
  envNaclFiles,
  envErrors,
  [envSourceRange],
  { changes: [], cacheValid: true },
  envSrcStaticFileSource
)
const inactiveSource = createMockNaclFileSource(
  [inactiveObject, inactiveFragment],
  inactiveNaclFiles,
  inactiveErrors,
  [inactiveSourceRange]
)

const activePrefix = 'active'
const inactivePrefix = 'inactive'
const commonPrefix = ''
const sources = {
  [commonPrefix]: commonSource,
  [activePrefix]: envSource,
  [inactivePrefix]: inactiveSource,
}
const source = multiEnvSource(
  sources,
  activePrefix,
  commonPrefix,
  () => Promise.resolve(new InMemoryRemoteMap()),
  true
)


describe('multi env source', () => {
  beforeAll(async () => {
    await source.load({})
  })
  describe('getNaclFile', () => {
    it('should return a Nacl file from an env', async () => {
      const relPath = 'env.nacl'
      const fullPath = path.join(ENVS_PREFIX, activePrefix, relPath)
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
            before: commonObject.fields.field,
          },
          id: commonObject.fields.field.elemID,
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

    it('should change inner state upon update with addition', async () => {
      const change = { action: 'add', data: { after: commonObject } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource([commonFragment])
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource(
        [envFragment, envObject], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const secondarySourceName = 'env2'
      const mockSecondaryNaclFileSource = createMockNaclFileSource([])
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
          [secondarySourceName]: mockSecondaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const detailedChange = { ...change, id: commonElemID, path: ['test'] } as DetailedChange
      const elementChanges = (await multiEnvSourceWithMockSources
        .updateNaclFiles([detailedChange]))
      expect(elementChanges[primarySourceName].changes).toEqual([change])
      const mergedSaltoObject = new ObjectType({
        elemID: objectElemID, fields: { ...commonFragment.fields, ...envFragment.fields },
      })
      expect(sortElemArray(await awu(await multiEnvSourceWithMockSources.getAll()).toArray()))
        .toEqual(sortElemArray([mergedSaltoObject, envObject, commonObject]))
    })
    it('should change inner state upon update with removal', async () => {
      const change = { action: 'remove', data: { before: commonFragment } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource(
        [commonFragment], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource([envFragment, envObject])
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const mergedSaltoObject = new ObjectType({
        elemID: objectElemID, fields: { ...commonFragment.fields, ...envFragment.fields },
      })
      const detailedChange = {
        action: 'modify',
        data: { before: mergedSaltoObject, after: envFragment },
        path: ['bla'],
        id: objectElemID,
      } as DetailedChange
      const elementChanges = (await multiEnvSourceWithMockSources
        .updateNaclFiles([detailedChange]))
      expect(Object.keys(elementChanges).length).toEqual(1)
      expect(elementChanges[primarySourceName].changes).toEqual([_.omit(detailedChange, ['path', 'id'])])
      expect(sortElemArray(await awu(await multiEnvSourceWithMockSources.getAll()).toArray()))
        .toEqual(sortElemArray([envObject, envFragment]))
    })
    it('should change inner state upon update with modification with multiple changes', async () => {
      const newEnvFragment = new ObjectType({
        elemID: objectElemID,
        fields: {
          ...envFragment.fields,
          field1: {
            refType: utils.createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
          },
        },
      })
      const removal = { action: 'remove', data: { before: commonFragment } } as Change<ObjectType>
      const addition = { action: 'add', data: { after: commonObject } } as Change<ObjectType>
      const envObjectRemoval = { action: 'remove', data: { before: envObject } } as Change<ObjectType>
      const modificaton = { action: 'modify', data: { before: envFragment, after: newEnvFragment } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource(
        [commonFragment], {}, undefined, undefined, { changes: [removal, addition],
          cacheValid: true }
      )
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource(
        [envFragment, envObject], {}, undefined, undefined, {
          changes: [envObjectRemoval, modificaton],
          cacheValid: true,
        }
      )
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const mergedSaltoObject = currentElements.find(e => e.elemID.isEqual(objectElemID))
      const detailedChanges = [
        {
          action: 'remove',
          data: { before: envObject },
          path: ['bla1'],
          id: envElemID,
        },
        {
          action: 'modify',
          data: { before: mergedSaltoObject, after: newEnvFragment },
          path: ['bla'],
          id: objectElemID,
        },
        {
          action: 'add',
          data: { after: commonObject },
          path: ['bla1'],
          id: commonElemID,
        },
      ] as DetailedChange[]
      const elementChanges = (
        await multiEnvSourceWithMockSources.updateNaclFiles(detailedChanges)
      )
      const elements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(
        _.sortBy(elementChanges[primarySourceName]
          .changes, c => getChangeElement(c).elemID.getFullName())
      ).toEqual(_.sortBy(detailedChanges, c => getChangeElement(c).elemID.getFullName())
        .map(dc => _.omit(dc, ['path', 'id'])))
      expect(sortElemArray(elements)).toEqual(sortElemArray([commonObject, newEnvFragment]))
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
      const elements = await awu(await source.list()).toArray()
      expect(await awu(elements).toArray()).toHaveLength(3)
      await expectToContainAllItems(elements, [commonElemID, envElemID, objectElemID])
      expect(elements).not.toContain(inactiveElemID)
    })
  })
  describe('isEmpty', () => {
    it('should return true when there are no sources', async () => {
      const srcs = {}
      const src = multiEnvSource(
        srcs,
        activePrefix,
        commonPrefix,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await src.load({})
      expect(await src.isEmpty()).toBeTruthy()
    })
    it('should return true when some sources have files', async () => {
      const srcs = {
        [commonPrefix]: commonSource,
        [activePrefix]: emptySource,
        [inactivePrefix]: inactiveSource,
      }
      const src = multiEnvSource(
        srcs,
        activePrefix,
        commonPrefix,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await src.load({})
      expect(await src.isEmpty()).toBeFalsy()
    })
    it('should look at elements from all active sources and not inactive sources', async () => {
      const srcs = {
        [commonPrefix]: emptySource,
        [inactivePrefix]: inactiveSource,
      }
      const src = multiEnvSource(
        srcs,
        activePrefix,
        commonPrefix,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await src.load({})
      expect(await src.isEmpty()).toBeTruthy()
    })
  })
  describe('get', () => {
    it('should return the merged element', async () => {
      const elem = (await source.get(objectElemID)) as ObjectType
      expect(Object.keys(elem.fields).sort()).toEqual([
        'commonField',
        'envField',
      ])
    })
    it('should not return the elements from inactive envs', async () => {
      expect(await source.get(inactiveElemID)).not.toBeDefined()
    })
  })
  describe('getElementSource', () => {
    it('should return an element source according to env even if state is set', async () => {
      const primarySource = await source.getElementsSource()
      const primarySourceByEnvName = await source.getElementsSource(activePrefix)
      const secondarySourceByEnvName = await source.getElementsSource(inactivePrefix)
      expect(primarySource).toEqual(primarySourceByEnvName)
      expect(primarySource).not.toEqual(secondarySourceByEnvName)
    })
  })
  describe('getAll', () => {
    it('should return all merged elements', async () => {
      const elements = await awu(await source.getAll()).toArray()
      expect(elements).toHaveLength(3)
      await expectToContainAllItems(
        awu(elements).map(e => e.elemID),
        [commonElemID, envElemID, objectElemID]
      )
      expect(elements).not.toContain(inactiveObject)
      const obj = elements.find(e => _.isEqual(e.elemID, objectElemID)) as ObjectType
      expect(Object.keys(obj.fields).sort()).toEqual([
        'commonField',
        'envField',
      ])
    })
    it('should return all elements for not the primary env', async () => {
      const elements = await source.getAll('inactive')
      await expectToContainAllItems(
        awu(elements).map(e => e.elemID),
        [commonElemID, inactiveElemID, objectElemID]
      )
      expect(elements).not.toContain(envObject)
    })
  })
  describe('getTotalSize', () => {
    it('should return the total size of all the sources', async () => {
      expect(await source.getTotalSize()).toEqual(15)
    })
  })
  describe('listNaclFiles', () => {
    it('shoud list all Nacl files', async () => {
      const naclFiles = await source.listNaclFiles()
      expect(naclFiles).toHaveLength(4)
      await expectToContainAllItems(naclFiles, [
        ..._.keys(commonNaclFiles),
        ..._.keys(envNaclFiles).map(p => path.join(ENVS_PREFIX, activePrefix, p)),
      ])
    })
  })
  describe('setNaclFiles', () => {
    it('should forward the setNaclFile command to the active source', async () => {
      const naclFile = {
        filename: path.join(ENVS_PREFIX, activePrefix, 'env.nacl'),
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

    it('should not change inner state upon set with no changes', async () => {
      const change = { action: 'add', data: { after: inactiveFragment } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource(
        [commonFragment], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource(
        [envFragment, envObject], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const inactiveSourceName = 'env2'
      const mockInacvtiveNaclFileSource = createMockNaclFileSource(
        [inactiveObject], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
          [inactiveSourceName]: mockInacvtiveNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const elementChanges = (await multiEnvSourceWithMockSources.setNaclFiles(
        { filename: path.join(ENVS_PREFIX, inactiveSourceName, 'env.nacl'), buffer: 'test' }
      ))
      expect(elementChanges).not.toHaveProperty(primarySourceName)
      const elements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(elements).toHaveLength(2)
    })
    it('should change inner state upon set with addition', async () => {
      const change = { action: 'add', data: { after: commonObject } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource(
        [commonFragment], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource([envFragment, envObject])
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const elementChanges = (await multiEnvSourceWithMockSources.setNaclFiles(
        { filename: 'test', buffer: 'test' }
      ))[primarySourceName].changes
      expect(elementChanges).toEqual([change])
      const mergedSaltoObject = new ObjectType({
        elemID: objectElemID, fields: { ...commonFragment.fields, ...envFragment.fields },
      })
      expect(sortElemArray(await awu(await multiEnvSourceWithMockSources.getAll()).toArray()))
        .toEqual(sortElemArray([mergedSaltoObject, envObject, commonObject]))
    })
    it('should change inner state upon set with removal', async () => {
      const change = { action: 'remove', data: { before: envObject } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource([commonFragment])
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource(
        [envFragment, envObject], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const elementChanges = (await multiEnvSourceWithMockSources.setNaclFiles(
        { filename: path.join(ENVS_PREFIX, primarySourceName, 'env.nacl'), buffer: 'test' }
      ))
      expect(elementChanges[primarySourceName].changes).toEqual([change])
      const mergedSaltoObject = new ObjectType({
        elemID: objectElemID, fields: { ...commonFragment.fields, ...envFragment.fields },
      })
      expect(await awu(await multiEnvSourceWithMockSources.getAll())
        .toArray()).toEqual([mergedSaltoObject])
    })
    it('should change inner state upon set with modification', async () => {
      const newEnvObject = new ObjectType({
        elemID: envElemID,
        fields: {
          ...envObject.fields,
          field1: {
            refType: utils.createRefToElmWithValue(BuiltinTypes.BOOLEAN),
          },
        },
      })
      const change = {
        action: 'modify',
        data: { before: envObject, after: newEnvObject },
      } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource([commonFragment])
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource(
        [envFragment, envObject], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const elementChanges = (await multiEnvSourceWithMockSources.setNaclFiles(
        { filename: path.join(ENVS_PREFIX, primarySourceName, 'env.nacl'), buffer: 'test' }
      ))
      expect(elementChanges[primarySourceName].changes).toEqual([change])
      const mergedSaltoObject = new ObjectType({
        elemID: objectElemID, fields: { ...commonFragment.fields, ...envFragment.fields },
      })
      expect(sortElemArray(await awu(await multiEnvSourceWithMockSources.getAll()).toArray()))
        .toEqual(sortElemArray([mergedSaltoObject, newEnvObject]))
    })
    it('should not change inner state upon set that ends up with the same state', async () => {
      const removal = { action: 'remove', data: { before: envObject } } as Change<ObjectType>
      const addition = { action: 'add', data: { after: envObject } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource(
        [commonFragment], {}, undefined, undefined, { changes: [addition], cacheValid: true }
      )
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource(
        [envFragment, envObject], {}, undefined, undefined, { changes: [removal], cacheValid: true }
      )
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const elementChanges = (await multiEnvSourceWithMockSources.setNaclFiles(
        { filename: path.join(ENVS_PREFIX, primarySourceName, 'env.nacl'), buffer: 'test' },
        { filename: 'test', buffer: 'test' },
      ))
      expect(elementChanges[primarySourceName].changes).toEqual([])
      expect(sortElemArray(await awu(await multiEnvSourceWithMockSources.getAll()).toArray()))
        .toEqual(sortElemArray(currentElements))
    })
  })
  describe('removeNaclFiles', () => {
    it('should forward the removeNaclFiles command to the active source', async () => {
      await source.removeNaclFiles(path.join(ENVS_PREFIX, activePrefix, 'env.nacl'))
      expect(envSource.removeNaclFiles).toHaveBeenCalled()
    })

    it('should forward the removeNaclFiles command to the common source', async () => {
      await source.removeNaclFiles(path.join(commonPrefix, 'common.nacl'))
      expect(envSource.removeNaclFiles).toHaveBeenCalled()
    })

    it('should change inner state upon remove of a file', async () => {
      const change = { action: 'remove', data: { before: commonFragment } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource(
        [commonFragment], {}, undefined, undefined, { changes: [change], cacheValid: true }
      )
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource([envObject])
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const elementChanges = (await multiEnvSourceWithMockSources
        .removeNaclFiles('test.nacl'))
      expect(elementChanges[primarySourceName].changes).toEqual([change])
      expect(await awu(await multiEnvSourceWithMockSources.getAll()).toArray()).toEqual([envObject])
    })
    it('should change inner state upon remove of multiple files', async () => {
      const removalCommon = { action: 'remove', data: { before: commonObject } } as Change<ObjectType>
      const removalPrimary = { action: 'remove', data: { before: envObject } } as Change<ObjectType>
      const commonSourceName = ''
      const mockCommonNaclFileSource = createMockNaclFileSource(
        [commonObject], {}, undefined, undefined, { changes: [removalCommon], cacheValid: true }
      )
      const primarySourceName = 'env1'
      const mockPrimaryNaclFileSource = createMockNaclFileSource(
        [envObject], {}, undefined, undefined, { changes: [removalPrimary], cacheValid: true }
      )
      const multiEnvSourceWithMockSources = multiEnvSource(
        {
          [commonSourceName]: mockCommonNaclFileSource,
          [primarySourceName]: mockPrimaryNaclFileSource,
        },
        primarySourceName,
        commonSourceName,
        () => Promise.resolve(new InMemoryRemoteMap()),
        true
      )
      await multiEnvSourceWithMockSources.load({})
      // NOTE: the getAll call initialize the init state
      const currentElements = await awu(await multiEnvSourceWithMockSources.getAll()).toArray()
      expect(currentElements).toHaveLength(2)
      const elementChanges = (await multiEnvSourceWithMockSources.removeNaclFiles(
        'test.nacl', path.join(ENVS_PREFIX, primarySourceName, 'env.nacl')
      ))
      expect(elementChanges[primarySourceName].changes).toEqual([removalPrimary, removalCommon])
      expect(await awu(await multiEnvSourceWithMockSources.getAll()).toArray()).toEqual([])
    })
  })
  describe('getSourceMap', () => {
    it('should forward the getSourceMap command to the active source', async () => {
      await source.getSourceMap(path.join(ENVS_PREFIX, activePrefix, 'env.nacl'))
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

      await expectToContainAllItems(filenames, [
        path.join(ENVS_PREFIX, activePrefix, 'env.nacl'),
        path.join(commonPrefix, 'common.nacl'),
      ])
    })
  })
  describe('getErrors', () => {
    it('should return errors from the active sources only', async () => {
      const errors = await source.getErrors()
      const filenames = errors.parse.map(e => e.subject.filename)
      expect(filenames).toHaveLength(2)
      await expectToContainAllItems(filenames, [
        path.join(ENVS_PREFIX, activePrefix, 'env.nacl'),
        path.join(commonPrefix, 'common.nacl'),
      ])
    })
  })
  describe('getParsedNaclFile', () => {
    it('should forward the getElements command to the active source', async () => {
      await source.getSourceMap(path.join(ENVS_PREFIX, activePrefix, 'env.nacl'))
      expect(envSource.getSourceMap).toHaveBeenCalled()
    })

    it('should forward the getElements command to the common source', async () => {
      await source.getParsedNaclFile(path.join(commonPrefix, 'common.nacl'))
      expect(commonSource.getParsedNaclFile).toHaveBeenCalled()
    })
  })
  describe('applyInstanceDefaults', () => {
    it('should call applyInstanceDefaults', () => {
      expect(utils.applyInstanceDefaults).toHaveBeenCalled()
    })
  })
  describe('copyTo', () => {
    it('should route a copy to the proper env sources when specified', async () => {
      const selectors = createElementSelectors(['salto.*']).validSelectors
      jest.spyOn(routers, 'routeCopyTo').mockImplementationOnce(
        () => Promise.resolve({ primarySource: [], commonSource: [], secondarySources: {} })
      )
      await source.copyTo(await awu(await source
        .getElementIdsBySelectors(selectors)).toArray(), ['inactive'])
      expect(routers.routeCopyTo).toHaveBeenCalledWith(
        [envElemID, objectElemID], envSource, { inactive: inactiveSource }
      )
    })
    it('should route a copy to all env sources when not specified', async () => {
      const selectors = createElementSelectors(['salto.*']).validSelectors
      jest.spyOn(routers, 'routeCopyTo').mockImplementationOnce(
        () => Promise.resolve({ primarySource: [], commonSource: [], secondarySources: {} })
      )
      await source.copyTo(await awu(await source.getElementIdsBySelectors(selectors)).toArray())
      expect(routers.routeCopyTo).toHaveBeenCalledWith(
        [envElemID, objectElemID], envSource, { inactive: inactiveSource }
      )
    })
  })
  describe('getElementIdsBySelectors', () => {
    describe('commonOnly=false', () => {
      it('should extract the proper ids with overlaps when compact=false', async () => {
        const selectors = createElementSelectors(['salto.*', 'salto.*.field.*']).validSelectors
        const res = await awu(await source.getElementIdsBySelectors(selectors)).toArray()
        expect(res.map(id => id.getFullName()).sort()).toEqual([
          envElemID,
          envElemID.createNestedID('field', 'field'),
          objectElemID,
          objectElemID.createNestedID('field', 'envField'),
        ].map(id => id.getFullName()))
      })
      it('should extract the proper ids without overlaps when compact=true', async () => {
        const selectors = createElementSelectors(['salto.*', 'salto.*.field.*']).validSelectors
        const res = await awu(
          await source.getElementIdsBySelectors(selectors, false, true)
        ).toArray()
        expect(res.map(id => id.getFullName()).sort()).toEqual([
          envElemID,
          objectElemID,
        ].map(id => id.getFullName()))
      })
    })
    describe('commonOnly=true', () => {
      it('should extract the proper ids with overlaps when compact=false', async () => {
        const selectors = createElementSelectors(['salto.*', 'salto.*.field.*']).validSelectors
        const res = await awu(await source.getElementIdsBySelectors(selectors, true)).toArray()
        expect(res.map(id => id.getFullName()).sort()).toEqual([
          commonObject.elemID,
          commonObject.elemID.createNestedID('field', 'field'),
          objectElemID,
          objectElemID.createNestedID('field', 'commonField'),
        ].map(id => id.getFullName()))
      })
      it('should extract the proper ids without overlaps when compact=true', async () => {
        const selectors = createElementSelectors(['salto.*', 'salto.*.field.*']).validSelectors
        const res = await awu(
          await source.getElementIdsBySelectors(selectors, true, true)
        ).toArray()
        expect(res.map(id => id.getFullName()).sort()).toEqual([
          commonObject.elemID,
          objectElemID,
        ].map(id => id.getFullName()))
      })
    })
  })
  describe('promote', () => {
    it('should route promote the proper ids', async () => {
      const selectors = createElementSelectors(['salto.*', 'salto.*.field.*']).validSelectors
      jest.spyOn(routers, 'routePromote').mockImplementationOnce(
        () => Promise.resolve({ primarySource: [], commonSource: [], secondarySources: {} })
      )
      await source.promote(
        await awu(await source.getElementIdsBySelectors(selectors, false, true)).toArray()
      )
      expect(routers.routePromote).toHaveBeenCalledWith(
        [envElemID, objectElemID], envSource, commonSource, { inactive: inactiveSource }
      )
    })
  })
  describe('demote', () => {
    it('should route demote the proper ids', async () => {
      const selectors = createElementSelectors(['salto.*', 'salto.*.field.*']).validSelectors
      jest.spyOn(routers, 'routeDemote').mockImplementationOnce(
        () => Promise.resolve({ primarySource: [], commonSource: [], secondarySources: {} })
      )
      await source.demote(await awu(
        await source.getElementIdsBySelectors(selectors, true, true)
      ).toArray())
      expect(routers.routeDemote).toHaveBeenCalledWith(
        [commonObject.elemID, objectElemID], envSource, commonSource, { inactive: inactiveSource }
      )
    })
  })
  describe('demoteAll', () => {
    it('should route demote all the proper ids', async () => {
      jest.spyOn(commonSource, 'list').mockImplementationOnce(() => Promise.resolve(awu([envElemID, objectElemID])))
      jest.spyOn(routers, 'routeDemote').mockImplementationOnce(
        () => Promise.resolve({ primarySource: [], commonSource: [], secondarySources: {} })
      )
      await source.demoteAll()
      expect(routers.routeDemote).toHaveBeenCalledWith(
        [envElemID, objectElemID], envSource, commonSource, { inactive: inactiveSource }
      )
    })
  })

  describe('non persistent multiEnvSource', () => {
    it('should not allow flush when the ws is non-persistent', async () => {
      const nonPSource = multiEnvSource(
        sources,
        activePrefix,
        commonPrefix,
        () => Promise.resolve(new InMemoryRemoteMap()),
        false
      )
      await expect(() => nonPSource.flush()).rejects.toThrow()
    })
  })

  describe('getStaticFileByHash', () => {
    const staticFile = new StaticFile({
      content: Buffer.from(''),
      filepath: 'aaa.txt',
      encoding: 'utf-8',
      hash: 'aaa',
    })
    it('should return the file it is present in the common source and the hashes match', async () => {
      commonSrcStaticFileSource.getStaticFile = jest.fn().mockResolvedValueOnce(staticFile)
      envSrcStaticFileSource.getStaticFile = jest.fn().mockResolvedValueOnce(new MissingStaticFile(''))
      const src = multiEnvSource(
        sources,
        activePrefix,
        commonPrefix,
        () => Promise.resolve(new InMemoryRemoteMap()),
        false
      )
      expect(await src.getStaticFile(
        staticFile.filepath, staticFile.encoding
      )).toEqual(staticFile)
    })
    it('should return the file it is present in the env source and the hashes match', async () => {
      commonSrcStaticFileSource.getStaticFile = jest.fn().mockResolvedValueOnce(new MissingStaticFile(''))
      envSrcStaticFileSource.getStaticFile = jest.fn().mockResolvedValueOnce(staticFile)
      const src = multiEnvSource(
        sources,
        activePrefix,
        commonPrefix,
        () => Promise.resolve(new InMemoryRemoteMap()),
        false
      )
      expect(await src.getStaticFile(
        staticFile.filepath, staticFile.encoding
      )).toEqual(staticFile)
    })
  })
})
