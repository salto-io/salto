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
import _ from 'lodash'
import wu from 'wu'
import {
  Element, ObjectType, ElemID, CORE_ANNOTATIONS, Field,
  BuiltinTypes, InstanceElement, ListType, isListType, Values,
} from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { ConfigSource } from '../../src/workspace/config_source'
import { adapterCreators } from '../../src/core/adapters'
import { naclFilesSource, NaclFilesSource } from '../../src/workspace/nacl_files/nacl_files_source'
import State from '../../src/workspace/state'
import mockState from '../common/state'
import { createMockNaclFileSource } from '../common/nacl_file_source'
import { mockStaticFileSource } from './static_files/merger.test'
import { DirectoryStore } from '../../src/workspace/dir_store'
import {
  Workspace,
  initWorkspace,
  loadWorkspace,
  NoWorkspaceConfig,
  ADAPTERS_CONFIGS_PATH,
  EnvironmentSource,
  DeleteCurrentEnvError,
  UnknownEnvError,
} from '../../src/workspace/workspace'
import { DetailedChange } from '../../src/core/plan'

import { StaticFilesSource } from '../../src/workspace/static_files/source'

import * as dump from '../../src/parser/dump'

import { mockDirStore, mockParseCache } from '../common/nacl_file_store'
import {
  WORKSPACE_CONFIG_NAME, workspaceConfigType, USER_CONFIG_NAME,
  workspaceUserConfigType,
} from '../../src/workspace/workspace_config_types'

const changedNaclFile = {
  filename: 'file.nacl',
  buffer: `type salesforce.lead {
    salesforce.text new_base {}
  }`,
}
const emptyNaclFile = {
  filename: 'willbempty.nacl',
  buffer: ' ',
}
const newNaclFile = {
  filename: 'new.nacl',
  buffer: 'type salesforce.new {}',
}
const services = ['salesforce']

const wsConfInstance = (conf?: Values): InstanceElement =>
  new InstanceElement(WORKSPACE_CONFIG_NAME, workspaceConfigType, {
    uid: '',
    name: 'test',
    envs: [{ name: 'default', services },
      { name: 'inactive', services: [...services, 'hubspot'] }],
    ...conf,
  })
const mockConfigSource = (conf?: Values): ConfigSource => ({
  get: jest.fn().mockImplementation(name => (
    (name === WORKSPACE_CONFIG_NAME)
      ? wsConfInstance(conf)
      : new InstanceElement(USER_CONFIG_NAME, workspaceUserConfigType, {
        currentEnv: 'default',
      })
  )),
  set: jest.fn(),
  delete: jest.fn(),
})
const mockCredentialsSource = (): ConfigSource => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
})

const createWorkspace = async (
  dirStore?: DirectoryStore, state?: State,
  configSource?: ConfigSource, credentials?: ConfigSource,
  staticFilesSource?: StaticFilesSource,
  elementSources?: Record<string, EnvironmentSource>,
): Promise<Workspace> =>
  loadWorkspace(configSource || mockConfigSource(), credentials || mockCredentialsSource(),
    {
      commonSourceName: '',
      sources: elementSources || {
        '': {
          naclFiles: naclFilesSource(
            dirStore || mockDirStore(), mockParseCache(),
            staticFilesSource || mockStaticFileSource(),
          ),
        },
        default: {
          naclFiles: createMockNaclFileSource([]),
          state: state || mockState(['salesforce']),
        },
        sec: {
          naclFiles: createMockNaclFileSource([]),
          state: state || mockState(['hubspot']),
        },
      },
    })

const getElemMap = (elements: ReadonlyArray<Element>): Record<string, Element> =>
  _.keyBy(elements, elem => elem.elemID.getFullName())

jest.mock('../../src/workspace/dir_store')
describe('workspace', () => {
  describe('loadWorkspace', () => {
    it('should fail if no workspace config', async () => {
      const noWorkspaceConfig = {
        get: jest.fn().mockResolvedValue(undefined),
        set: jest.fn(),
        delete: jest.fn(),
      }
      await expect(createWorkspace(undefined, undefined, noWorkspaceConfig)).rejects
        .toThrow(NoWorkspaceConfig)
    })
    it('should work if user config is missing', async () => {
      const noUserConfig = {
        get: jest.fn().mockImplementation(name => (
          (name === WORKSPACE_CONFIG_NAME) ? wsConfInstance() : undefined
        )),
        set: jest.fn(),
        delete: jest.fn(),
      }
      expect(await createWorkspace(undefined, undefined, noUserConfig)).toBeDefined()
    })
  })
  describe('loaded elements', () => {
    let workspace: Workspace
    let elemMap: Record<string, Element>
    beforeAll(async () => {
      workspace = await createWorkspace()
      elemMap = getElemMap(await workspace.elements())
    })
    it('should contain types from all files', () => {
      expect(elemMap).toHaveProperty(['salesforce.lead'])
      expect(elemMap).toHaveProperty(['multi.loc'])
    })
    it('should be merged', () => {
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(_.keys(lead.fields)).toHaveLength(5)
    })
  })

  describe('sourceMap', () => {
    let workspace: Workspace
    beforeAll(async () => {
      workspace = await createWorkspace()
    })

    it('should have definitions from all files', async () => {
      const sourceRanges = await workspace.getSourceRanges(ElemID.fromFullName('salesforce.lead'))
      expect(sourceRanges).toHaveLength(2)
    })
  })

  describe('errors', () => {
    it('should be empty when there are no errors', async () => {
      const workspace = await createWorkspace()
      expect((await workspace.errors()).hasErrors()).toBeFalsy()
      expect(await workspace.hasErrors()).toBeFalsy()
    })
    it('should contain parse errors', async () => {
      const erroredWorkspace = await createWorkspace(mockDirStore(['dup.nacl']))

      const errors = await erroredWorkspace.errors()
      expect(errors.hasErrors()).toBeTruthy()
      const err = 'Expected ws, comment or word token but found instead: }.'
      expect(errors.strings()[0]).toMatch(err)
      expect(errors.parse[0].detail).toMatch(err)

      expect(await erroredWorkspace.hasErrors()).toBeTruthy()
      const workspaceErrors = await Promise.all(
        wu(errors.all()).map(error => erroredWorkspace.transformError(error))
      )
      expect(workspaceErrors.length).toBeGreaterThanOrEqual(1)
      expect(workspaceErrors[0].sourceFragments).toHaveLength(1)
    })
    it('should contain merge errors', async () => {
      const erroredWorkspace = await createWorkspace(mockDirStore(['error.nacl']))

      const errors = await erroredWorkspace.errors()
      expect(errors.hasErrors()).toBeTruthy()
      const mergeError = /Cannot merge/
      expect(errors.strings()[0]).toMatch(mergeError)
      expect(errors.merge[0].error).toMatch(mergeError)

      expect(await erroredWorkspace.hasErrors()).toBeTruthy()
      const workspaceErrors = await Promise.all(
        wu(errors.all()).map(error => erroredWorkspace.transformError(error))
      )
      expect(workspaceErrors).toHaveLength(1)
      const wsErros = workspaceErrors[0]
      expect(wsErros.sourceFragments).toHaveLength(2)
      expect(wsErros.message).toMatch(mergeError)
      expect(wsErros.severity).toBe('Error')
      const firstSourceFragment = wsErros.sourceFragments[0]
      expect(firstSourceFragment.sourceRange.filename).toBe('file.nacl')
      expect(firstSourceFragment.sourceRange.start).toEqual({ byte: 24, col: 1, line: 3 })
      expect(firstSourceFragment.sourceRange.end).toEqual({ byte: 73, col: 2, line: 5 })
      expect(firstSourceFragment.fragment).toContain('salesforce.text base_field')
    })
  })

  describe('transformError', () => {
    describe('when no source is available', () => {
      it('should return empty source fragments', async () => {
        const ws = await createWorkspace()
        const wsError = await ws.transformError({ severity: 'Warning', message: '' })
        expect(wsError.sourceFragments).toHaveLength(0)
      })
    })
  })

  describe('removeNaclFiles', () => {
    const dirStore = mockDirStore()
    let workspace: Workspace
    const removedPaths = ['file.nacl', 'willbempty.nacl']
    let elemMap: Record<string, Element>

    beforeAll(async () => {
      workspace = await createWorkspace(dirStore)
      await workspace.removeNaclFiles(...removedPaths)
      elemMap = getElemMap(await workspace.elements())
    })

    it('should update elements to not include fields from removed Nacl files', () => {
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(_.keys(lead.fields)).toHaveLength(1)
    })

    it('should remove from store', () => {
      const mockStoreDelete = dirStore.delete as jest.Mock
      expect(mockStoreDelete.mock.calls.map(c => c[0])).toEqual(removedPaths)
    })
  })

  describe('setNaclFiles', () => {
    const naclFileStore = mockDirStore()
    let workspace: Workspace
    let elemMap: Record<string, Element>

    beforeAll(async () => {
      workspace = await createWorkspace(naclFileStore)
      await workspace.setNaclFiles(changedNaclFile, newNaclFile, emptyNaclFile)
      elemMap = getElemMap(await workspace.elements())
    })

    it('should add new elements', () => {
      expect(elemMap).toHaveProperty(['salesforce.new'])
    })
    it('should update elements', () => {
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(lead.fields.new_base).toBeDefined()
      expect(lead.fields.base_field).not.toBeDefined()
    })

    it('should create Nacl files that were added', async () => {
      const mockSetNaclFileStore = naclFileStore.set as jest.Mock
      expect(mockSetNaclFileStore).toHaveBeenCalledWith(newNaclFile)
    })

    it('should change the content of Nacl files that were updated', async () => {
      const mockSetNaclFileStore = naclFileStore.set as jest.Mock
      expect(mockSetNaclFileStore).toHaveBeenCalledWith(changedNaclFile)
    })
  })

  describe('updateNaclFiles', () => {
    const newElemID = new ElemID('salesforce', 'new_elem')
    const newElem = new ObjectType({
      elemID: newElemID,
      path: ['test', 'new'],
    })
    const oldField = new Field(
      new ElemID('salesforce', 'lead'),
      'not_a_list_yet_field',
      BuiltinTypes.NUMBER,
      {},
    )
    const newField = oldField.clone()
    newField.type = new ListType(newField.type)
    const anotherNewField = new Field(
      new ElemID('salesforce', 'lead'),
      'lala',
      new ListType(BuiltinTypes.NUMBER),
      {},
    )

    const changes: DetailedChange[] = [
      { // modify value
        id: new ElemID('salesforce', 'lead', 'field', 'base_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'modify',
        data: { before: 'asd', after: 'foo' },
      },
      { // add element (top level)
        id: newElemID,
        action: 'add',
        data: { after: newElem },
      },
      { // add complex value (nested in parent scope)
        id: new ElemID('salesforce', 'lead', 'field', 'base_field', 'complex'),
        action: 'add',
        data: { after: { key: 'value' } },
      },
      { // remove value
        id: new ElemID('salesforce', 'lead', 'field', 'ext_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'remove',
        data: { before: 'foo' },
      },
      { // Add value to empty scope
        id: new ElemID('salesforce', 'lead', 'field', 'empty', 'test'),
        action: 'add',
        data: { after: 'some value' },
      },
      { // Add value to one liner scope
        id: new ElemID('one', 'liner', 'attr', 'label'),
        action: 'add',
        data: { after: 'label' },
      },
      { // Remove element from multiple locations
        id: new ElemID('multi', 'loc'),
        action: 'remove',
        data: { before: new ObjectType({
          elemID: new ElemID('multi', 'loc'),
          annotations: {
            a: 1,
            b: 1,
          },
        }) },
      },
      { // Modify value in list
        id: new ElemID('salesforce', 'lead', 'field', 'list_field', CORE_ANNOTATIONS.DEFAULT, '3'),
        action: 'modify',
        data: { before: 4, after: 5 },
      },
      { // Modify field isListValue
        id: newField.elemID,
        action: 'modify',
        data: { before: oldField, after: newField },
      },
      {
        path: ['other', 'bar'],
        id: anotherNewField.elemID,
        action: 'add',
        data: { after: anotherNewField },

      },
      {
        path: ['other', 'battr'],
        id: new ElemID('salesforce', 'lead', 'attr', 'bobo'),
        action: 'add',
        data: { after: 'baba' },

      },
      {
        path: ['other', 'boo'],
        id: new ElemID('salesforce', 'lead', 'attr', 'nono'),
        action: 'add',
        data: { after: 'nono' },
      },
      {
        path: ['other', 'boo'],
        id: new ElemID('salesforce', 'lead', 'attr', 'momo'),
        action: 'add',
        data: { after: 'momo' },
      },
      {
        path: ['other', 'foo', 'bar'],
        id: new ElemID('salesforce', 'lead', 'field', 'ext_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'add',
        data: { after: 'blublu' },
      },
      { // Add to an exiting path
        path: ['file'],
        id: new ElemID('salesforce', 'lead', 'attr', 'dodo'),
        action: 'add',
        data: { after: 'dodo' },
      },
      { // new annotation type to a type with no annotation types block
        path: ['file'],
        id: new ElemID('salesforce', 'lead', 'annotation', 'newAnnoType1'),
        action: 'add',
        data: { after: BuiltinTypes.STRING },
      },
      { // new annotation type to a type with no annotation types block
        path: ['file'],
        id: new ElemID('salesforce', 'lead', 'annotation', 'newAnnoType2'),
        action: 'add',
        data: { after: BuiltinTypes.NUMBER },
      },
      { // new annotation type to a type with annotation types block
        path: ['file'],
        id: new ElemID('salesforce', 'WithAnnotationsBlock', 'annotation', 'secondAnnotation'),
        action: 'add',
        data: { after: BuiltinTypes.NUMBER },
      },
    ]

    let lead: ObjectType
    let elemMap: Record<string, Element>
    let workspace: Workspace
    const dirStore = mockDirStore()

    beforeAll(async () => {
      workspace = await createWorkspace(dirStore)
      await workspace.updateNaclFiles(changes)
      elemMap = getElemMap(await workspace.elements())
      lead = elemMap['salesforce.lead'] as ObjectType
    })

    it('should not cause parse errors', async () => {
      expect(await workspace.hasErrors()).toBeFalsy()
      expect((await workspace.errors()).hasErrors()).toBeFalsy()
    })
    it('should modify existing element', () => {
      expect(lead).toBeDefined()
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('foo')
    })
    it('should update existing parsed Nacl files content', () => {
      const setNaclFile = dirStore.set as jest.Mock
      expect(setNaclFile.mock.calls[0][0].buffer).toMatch(/base_field\s+{\s+_default = "foo"/s)
    })
    it('should add new element', () => {
      expect(elemMap[newElemID.getFullName()]).toBeDefined()
    })

    it('should add annotations under correct field', () => {
      expect(lead.fields.base_field.annotations).toHaveProperty('complex')
      expect(lead.fields.base_field.annotations.complex).toEqual({ key: 'value' })
    })

    it('should add value to empty scope', () => {
      expect(lead.fields.empty.annotations).toHaveProperty('test')
      expect(lead.fields.empty.annotations.test).toEqual('some value')
    })
    it('should add annotation types block when having new annotation type changes', () => {
      expect(lead.annotationTypes).toHaveProperty('newAnnoType1')
      expect(lead.annotationTypes.newAnnoType1).toEqual(BuiltinTypes.STRING)
      expect(lead.annotationTypes).toHaveProperty('newAnnoType2')
      expect(lead.annotationTypes.newAnnoType2).toEqual(BuiltinTypes.NUMBER)
    })
    it('should add annotation type to the existing annotations block', () => {
      const objWithAnnotationsBlock = elemMap['salesforce.WithAnnotationsBlock'] as ObjectType
      expect(objWithAnnotationsBlock.annotationTypes).toHaveProperty('firstAnnotation')
      expect(objWithAnnotationsBlock.annotationTypes.firstAnnotation).toEqual(BuiltinTypes.STRING)
      expect(objWithAnnotationsBlock.annotationTypes).toHaveProperty('secondAnnotation')
      expect(objWithAnnotationsBlock.annotationTypes.secondAnnotation).toEqual(BuiltinTypes.NUMBER)
    })
    it('should remove all definitions in remove', () => {
      expect(Object.keys(elemMap)).not.toContain('multi.loc')
    })

    it('should add one liner value', () => {
      const oneLiner = elemMap['one.liner'] as ObjectType
      expect(oneLiner.annotations).toHaveProperty('label')
      expect(oneLiner.annotations.label).toEqual('label')
    })
    it('should update value in list', () => {
      expect(lead.fields.list_field
        .annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual([1, 2, 3, 5, 5])
    })
    it('should change isList value in fields', () => {
      expect(isListType(lead.fields.not_a_list_yet_field.type)).toBeTruthy()
    })

    it('should not fail in case one of the changes fails', async () => {
      jest.spyOn(dump, 'dumpValues').mockImplementationOnce(() => { throw new Error('failed') })
      const change1: DetailedChange = {
        id: new ElemID('salesforce', 'lead', 'field', 'ext_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'modify',
        data: { before: 'foo', after: 'blabla' },
      }
      const change2: DetailedChange = {
        id: new ElemID('salesforce', 'lead', 'field', 'base_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'modify',
        data: { before: 'foo', after: 'blabla' },
      }

      await workspace.updateNaclFiles([change1, change2])
      lead = findElement(await workspace.elements(), new ElemID('salesforce', 'lead')) as ObjectType
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('blabla')
    })
  })

  describe('init', () => {
    const confSource = mockConfigSource({ name: 'ws-name' })
    afterEach(async () => {
      delete process.env.SALTO_HOME
    })
    it('should init workspace configuration', async () => {
      const workspace = await initWorkspace('ws-name', 'uid', 'default', confSource,
        mockCredentialsSource(), { commonSourceName: '', sources: {} })
      expect(confSource.set).toHaveBeenCalled()
      expect((confSource.set as jest.Mock).mock.calls[0][1]).toEqual(
        new InstanceElement(WORKSPACE_CONFIG_NAME, workspaceConfigType,
          { name: 'ws-name', uid: 'uid', envs: [{ name: 'default' }] })
      )
      expect((confSource.set as jest.Mock).mock.calls[1][1]).toEqual(
        new InstanceElement(USER_CONFIG_NAME, workspaceUserConfigType,
          { currentEnv: 'default' })
      )
      expect(workspace.name).toEqual('ws-name')
    })
  })

  describe('getStateRecency', () => {
    let now: number
    let modificationDate: Date
    const durationAfterLastModificationMinutes = 7
    const durationAfterLastModificationMs = 1000 * 60 * durationAfterLastModificationMinutes
    beforeEach(async () => {
      now = Date.now()
      jest.spyOn(Date, 'now').mockImplementation(() => now)
      modificationDate = new Date(now - durationAfterLastModificationMs)
    })
    it('should return valid when the state is valid', async () => {
      const ws = await createWorkspace(undefined, undefined, mockConfigSource(
        { staleStateThresholdMinutes: durationAfterLastModificationMinutes + 1 }
      ))
      ws.state().getServicesUpdateDates = jest.fn().mockImplementation(
        () => Promise.resolve({ salesforce: modificationDate })
      )
      const recency = await ws.getStateRecency('salesforce')
      expect(recency.status).toBe('Valid')
      expect(recency.date).toBe(modificationDate)
    })
    it('should return old when the state is old', async () => {
      const ws = await createWorkspace(undefined, undefined, mockConfigSource(
        { staleStateThresholdMinutes: durationAfterLastModificationMinutes - 1 }
      ))
      ws.state().getServicesUpdateDates = jest.fn().mockImplementation(
        () => Promise.resolve({ salesforce: modificationDate })
      )
      const recency = await ws.getStateRecency('salesforce')
      expect(recency.status).toBe('Old')
      expect(recency.date).toBe(modificationDate)
    })
    it('should return nonexistent when the state does not exist', async () => {
      const ws = await createWorkspace()
      ws.state().getServicesUpdateDates = jest.fn().mockImplementation(() => Promise.resolve({}))
      const recency = await ws.getStateRecency('salesforce')
      expect(recency.status).toBe('Nonexistent')
      expect(recency.date).toBe(undefined)
    })
  })

  describe('flush', () => {
    it('should flush all data sources', async () => {
      const mockFlush = jest.fn()
      const flushable = { flush: mockFlush }
      const workspace = await createWorkspace(flushable as unknown as DirectoryStore,
        flushable as unknown as State)
      await workspace.flush()
      expect(mockFlush).toHaveBeenCalledTimes(2)
    })
  })

  describe('setCurrentEnv', () => {
    let confSource: ConfigSource
    let workspace: Workspace

    beforeEach(async () => {
      confSource = mockConfigSource()
      workspace = await createWorkspace(undefined, undefined, confSource)
    })

    it('should change workspace state', async () => {
      await workspace.setCurrentEnv('inactive')
      expect(workspace.services()).toEqual([...services, 'hubspot'])
    })

    it('should persist', async () => {
      await workspace.setCurrentEnv('inactive')
      expect(confSource.set).toHaveBeenCalledTimes(1)
    })

    it('shouldnt persist', async () => {
      await workspace.setCurrentEnv('inactive', false)
      expect(confSource.set).toHaveBeenCalledTimes(0)
    })
  })

  describe('addEnvironment', () => {
    let confSource: ConfigSource
    let workspace: Workspace

    beforeEach(async () => {
      confSource = mockConfigSource()
      workspace = await createWorkspace(undefined, undefined, confSource)
      await workspace.addEnvironment('new')
    })

    it('should change workspace state', async () => {
      expect(workspace.envs().includes('new')).toBeTruthy()
    })

    it('should persist', () => {
      expect(confSource.set).toHaveBeenCalledTimes(1)
      const instance = (confSource.set as jest.Mock).mock.calls[0][1] as InstanceElement
      const envs = instance.value.envs.map((e: {name: string}) => e.name)
      expect(envs.includes('new')).toBeTruthy()
    })
  })

  describe('deleteEnvironment', () => {
    describe('should delete environment', () => {
      let confSource: ConfigSource
      let credSource: ConfigSource
      let workspace: Workspace
      let state: State
      let naclFiles: NaclFilesSource
      const envName = 'inactive'

      beforeAll(async () => {
        confSource = mockConfigSource()
        credSource = mockCredentialsSource()
        state = mockState()
        naclFiles = createMockNaclFileSource([])
        workspace = await createWorkspace(undefined, undefined, confSource, credSource,
          undefined, { inactive: { naclFiles, state } })
        await workspace.deleteEnvironment(envName)
      })

      it('should not be included in the workspace envs', async () => {
        expect(workspace.envs().includes(envName)).toBeFalsy()
      })

      it('should persist', () => {
        expect(confSource.set).toHaveBeenCalledTimes(1)
        const instance = (confSource.set as jest.Mock).mock.calls[0][1] as InstanceElement
        const envs = instance.value.envs.map((e: {name: string}) => e.name)
        expect(envs.includes(envName)).toBeFalsy()
      })

      it('should delete files', () => {
        expect(credSource.delete).toHaveBeenCalledTimes(1)
        expect(state.clear).toHaveBeenCalledTimes(1)
        expect(naclFiles.clear).toHaveBeenCalledTimes(1)
      })
    })

    describe('should fail to delete environment', () => {
      let workspace: Workspace
      beforeEach(async () => {
        workspace = await createWorkspace()
      })

      it('should not be able to delete current environment', async () => {
        await expect(workspace.deleteEnvironment('default')).rejects.toThrow(DeleteCurrentEnvError)
      })

      it('should not be able to delete unknown environment', async () => {
        await expect(workspace.deleteEnvironment('unknown')).rejects.toThrow(UnknownEnvError)
      })
    })
  })

  describe('addService', () => {
    let confSource: ConfigSource
    let workspace: Workspace

    beforeEach(async () => {
      confSource = mockConfigSource()
      workspace = await createWorkspace(undefined, undefined, confSource)
      await workspace.addService('new')
    })

    it('should change workspace state', async () => {
      expect(workspace.services().includes('new')).toBeTruthy()
    })

    it('should persist', () => {
      expect(confSource.set).toHaveBeenCalledTimes(1)
      const instance = (confSource.set as jest.Mock).mock.calls[0][1] as InstanceElement
      expect((instance.value.envs as {name: string}[]).find(e => e.name === 'default'))
        .toBeDefined()
    })
  })

  describe('updateServiceCredentials', () => {
    let credsSource: ConfigSource
    let workspace: Workspace
    const newCreds = new InstanceElement(services[0], adapterCreators[services[0]].credentialsType,
      { user: 'username', password: 'pass' })

    beforeEach(async () => {
      credsSource = mockCredentialsSource()
      workspace = await createWorkspace(undefined, undefined, undefined, credsSource)
      await workspace.updateServiceCredentials(services[0], newCreds)
    })

    it('should persist', () => {
      expect(credsSource.set).toHaveBeenCalledTimes(1)
      const instance = (credsSource.set as jest.Mock).mock.calls[0][1] as InstanceElement
      expect(instance).toEqual(newCreds)
      const path = (credsSource.set as jest.Mock).mock.calls[0][0] as string
      expect(path).toEqual(`default/${services[0]}`)
    })
  })

  describe('updateServiceConfig', () => {
    let confSource: ConfigSource
    let workspace: Workspace
    const newConf = new InstanceElement(services[0],
      adapterCreators[services[0]].configType as ObjectType, { conf1: 'val1' })

    beforeEach(async () => {
      confSource = mockConfigSource()
      workspace = await createWorkspace(undefined, undefined, confSource)
      await workspace.updateServiceConfig(services[0], newConf)
    })

    it('should persist', () => {
      expect(confSource.set).toHaveBeenCalledTimes(1)
      const instance = (confSource.set as jest.Mock).mock.calls[0][1] as InstanceElement
      expect(instance).toEqual(newConf)
      const path = (confSource.set as jest.Mock).mock.calls[0][0] as string
      expect(path).toEqual(`${ADAPTERS_CONFIGS_PATH}/${services[0]}`)
    })
  })

  describe('servicesCredentials', () => {
    let credsSource: ConfigSource
    let workspace: Workspace

    beforeEach(async () => {
      credsSource = {
        get: jest.fn().mockResolvedValue(
          new InstanceElement(services[0], adapterCreators[services[0]].credentialsType,
            { usename: 'default', password: 'default', currentEnv: 'default' })
        ),
        set: jest.fn(),
        delete: jest.fn(),
      }
      workspace = await createWorkspace(undefined, undefined, undefined, credsSource)
    })

    it('should get creds', async () => {
      await workspace.servicesCredentials()
      expect(credsSource.get).toHaveBeenCalledTimes(1)
    })

    it('should get creds partials', async () => {
      await workspace.servicesCredentials(services)
      expect(credsSource.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetchedServices', () => {
    let workspace: Workspace
    beforeAll(async () => {
      workspace = await createWorkspace()
    })

    it('should return the services in the current state when env is not provided', async () => {
      expect(await workspace.fetchedServices()).toEqual(['salesforce'])
    })

    it('should return the services in the provided env name', async () => {
      expect(await workspace.fetchedServices('default')).toEqual(['salesforce'])
      expect(await workspace.fetchedServices('sec')).toEqual(['hubspot'])
    })

    it('should return an empty array for nonexistent env name', async () => {
      expect(await workspace.fetchedServices('nope')).toEqual([])
    })

    it('should return an empty array for an env with no state', async () => {
      expect(await workspace.fetchedServices('')).toEqual([])
    })
  })
})
