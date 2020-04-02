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
  Element, ObjectType, ElemID, CORE_ANNOTATIONS, Field, BuiltinTypes, InstanceElement, ListType,
  isListType,
  Values,
} from '@salto-io/adapter-api'
import {
  findElement,
} from '@salto-io/adapter-utils'
import { ConfigSource } from '../../src/workspace/config_source'
import { adapterCreators } from '../../src/core/adapters'
import { blueprintsSource } from '../../src/workspace/blueprints/blueprints_source'
import State from '../../src/workspace/state'
import mockState from '../common/state'
import { createMockBlueprintSource } from '../common/blueprint_source'
import { DirectoryStore } from '../../src/workspace/dir_store'
import {
  Workspace, initWorkspace, WORKSPACE_CONFIG, workspaceConfigType, preferencesWorkspaceConfigType,
  PREFERENCE_CONFIG,
  loadWorkspace,
  COMMON_ENV_PREFIX,
  CREDENTIALS_CONFIG,
} from '../../src/workspace/workspace'
import { DetailedChange } from '../../src/core/plan'

import * as dump from '../../src/parser/dump'

import { mockDirStore, mockParseCache } from '../common/blueprint_store'

const changedBP = {
  filename: 'file.bp',
  buffer: `type salesforce.lead {
    salesforce.text new_base {}
  }`,
}
const emptyBP = {
  filename: 'willbempty.bp',
  buffer: ' ',
}
const newBP = {
  filename: 'new.bp',
  buffer: 'type salesforce.new {}',
}
const services = ['salesforce']

const mockConfigSource = (conf?: Values): ConfigSource => ({
  get: jest.fn().mockImplementation(name => (
    (name === WORKSPACE_CONFIG)
      ? new InstanceElement(WORKSPACE_CONFIG, workspaceConfigType, {
        uid: '',
        name: 'test',
        envs: [{ name: 'default', services },
          { name: 'inactive', services: [...services, 'hubspot'] }],
        ...conf,
      })
      : new InstanceElement(PREFERENCE_CONFIG, preferencesWorkspaceConfigType, {
        currentEnv: 'default',
      })
  )),
  set: jest.fn(),
})
const createWorkspace = async (dirStore?: DirectoryStore, state?: State,
  configSource?: ConfigSource): Promise<Workspace> =>
  loadWorkspace(configSource || mockConfigSource(),
    {
      [COMMON_ENV_PREFIX]: {
        blueprints: blueprintsSource(dirStore || mockDirStore(), mockParseCache()),
      },
      default: {
        blueprints: createMockBlueprintSource([]),
        state: state || mockState(),
      },
    })

const getElemMap = (elements: ReadonlyArray<Element>): Record<string, Element> =>
  _.keyBy(elements, elem => elem.elemID.getFullName())

jest.mock('../../src/workspace/dir_store')
describe('workspace', () => {
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
      const erroredWorkspace = await createWorkspace(mockDirStore(['dup.bp']))

      const errors = await erroredWorkspace.errors()
      expect(errors.hasErrors()).toBeTruthy()
      const err = 'Expected ws, comment or word token but found: } instead.'
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
      const erroredWorkspace = await createWorkspace(mockDirStore(['error.bp']))

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
      expect(firstSourceFragment.sourceRange.filename).toBe('file.bp')
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

  describe('removeBlueprints', () => {
    const dirStore = mockDirStore()
    let workspace: Workspace
    const removedPaths = ['file.bp', 'willbempty.bp']
    let elemMap: Record<string, Element>

    beforeAll(async () => {
      workspace = await createWorkspace(dirStore)
      await workspace.removeBlueprints(...removedPaths)
      elemMap = getElemMap(await workspace.elements())
    })

    it('should update elements to not include fields from removed blueprints', () => {
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(_.keys(lead.fields)).toHaveLength(1)
    })

    it('should remove from store', () => {
      const mockStoreDelete = dirStore.delete as jest.Mock
      expect(mockStoreDelete.mock.calls.map(c => c[0])).toEqual(removedPaths)
    })
  })

  describe('setBlueprints', () => {
    const bpStore = mockDirStore()
    let workspace: Workspace
    let elemMap: Record<string, Element>

    beforeAll(async () => {
      workspace = await createWorkspace(bpStore)
      await workspace.setBlueprints(changedBP, newBP, emptyBP)
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

    it('should create blueprints that were added', async () => {
      const mockSetBpStore = bpStore.set as jest.Mock
      expect(mockSetBpStore).toHaveBeenCalledWith(newBP)
    })

    it('should change the content of blueprints that were updated', async () => {
      const mockSetBpStore = bpStore.set as jest.Mock
      expect(mockSetBpStore).toHaveBeenCalledWith(changedBP)
    })
  })

  describe('updateBlueprints', () => {
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
      await workspace.updateBlueprints(changes)
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
    it('should update existing parsed blueprints content', () => {
      const setBp = dirStore.set as jest.Mock
      expect(setBp.mock.calls[0][0].buffer).toMatch(/base_field\s+{\s+_default = "foo"/s)
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

      await workspace.updateBlueprints([change1, change2])
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
      const workspace = await initWorkspace('ws-name', 'uid', 'default', confSource, {})
      expect(confSource.set).toHaveBeenCalled()
      expect((confSource.set as jest.Mock).mock.calls[0][1]).toEqual(
        new InstanceElement(WORKSPACE_CONFIG, workspaceConfigType,
          { name: 'ws-name', uid: 'uid', envs: [{ name: 'default' }] })
      )
      expect((confSource.set as jest.Mock).mock.calls[1][1]).toEqual(
        new InstanceElement(PREFERENCE_CONFIG, preferencesWorkspaceConfigType,
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
      ws.state().getUpdateDate = jest.fn().mockImplementation(
        () => Promise.resolve(modificationDate)
      )
      const recency = await ws.getStateRecency()
      expect(recency.status).toBe('Valid')
      expect(recency.date).toBe(modificationDate)
    })
    it('should return old when the state is old', async () => {
      const ws = await createWorkspace(undefined, undefined, mockConfigSource(
        { staleStateThresholdMinutes: durationAfterLastModificationMinutes - 1 }
      ))
      ws.state().getUpdateDate = jest.fn().mockImplementation(
        () => Promise.resolve(modificationDate)
      )
      const recency = await ws.getStateRecency()
      expect(recency.status).toBe('Old')
      expect(recency.date).toBe(modificationDate)
    })
    it('should return nonexistent when the state does not exist', async () => {
      const ws = await createWorkspace()
      ws.state().getUpdateDate = jest.fn().mockImplementation(() => Promise.resolve(null))
      const recency = await ws.getStateRecency()
      expect(recency.status).toBe('Nonexistent')
      expect(recency.date).toBe(null)
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

    it('shouldnt persist', () => {
      workspace.setCurrentEnv('inactive', false)
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
    let confSource: ConfigSource
    let workspace: Workspace
    const newCreds = new InstanceElement(services[0], adapterCreators[services[0]].credentialsType,
      { user: 'username', password: 'pass' })

    beforeEach(async () => {
      confSource = mockConfigSource()
      workspace = await createWorkspace(undefined, undefined, confSource)
      await workspace.updateServiceCredentials(services[0], newCreds)
    })

    it('should persist', () => {
      expect(confSource.set).toHaveBeenCalledTimes(1)
      const instance = (confSource.set as jest.Mock).mock.calls[0][1] as InstanceElement
      expect(instance).toEqual(newCreds)
      const path = (confSource.set as jest.Mock).mock.calls[0][0] as string
      expect(path).toEqual(`default/${CREDENTIALS_CONFIG}/${services[0]}`)
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
      expect(path).toEqual(services[0])
    })
  })
})
