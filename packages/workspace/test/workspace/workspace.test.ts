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
  Element, ObjectType, ElemID, Field, DetailedChange, BuiltinTypes, InstanceElement, ListType,
  Values, CORE_ANNOTATIONS, isListType, isInstanceElement, isType,
} from '@salto-io/adapter-api'
import {
  findElement, applyDetailedChanges,
} from '@salto-io/adapter-utils'
// eslint-disable-next-line no-restricted-imports
import {
  METADATA_TYPE,
} from '@salto-io/salesforce-adapter/dist/src/constants'
import { WorkspaceConfigSource } from '../../src/workspace/workspace_config_source'
import { ConfigSource } from '../../src/workspace/config_source'
import { naclFilesSource, NaclFilesSource } from '../../src/workspace/nacl_files'
import { State, buildInMemState } from '../../src/workspace/state'
import { createMockNaclFileSource } from '../common/nacl_file_source'
import { mockStaticFilesSource } from './static_files/common.test'
import { DirectoryStore } from '../../src/workspace/dir_store'
import { Workspace, initWorkspace, loadWorkspace, EnvironmentSource } from '../../src/workspace/workspace'
import { DeleteCurrentEnvError,
  UnknownEnvError, EnvDuplicationError, ServiceDuplicationError } from '../../src/workspace/errors'

import { StaticFilesSource } from '../../src/workspace/static_files'

import * as dump from '../../src/parser/dump'

import { mockDirStore, mockParseCache } from '../common/nacl_file_store'
import { EnvConfig } from '../../src/workspace/config/workspace_config_types'
import { PathIndex } from '../../src/workspace/path_index'
import { resolve } from '../../src/expressions'

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

const mockWorkspaceConfigSource = (conf?: Values): WorkspaceConfigSource => ({
  getWorkspaceConfig: jest.fn().mockImplementation(() => ({
    envs: [
      { name: 'default', services },
      { name: 'inactive', services: [...services, 'hubspot'] },
    ],
    uid: '',
    name: 'test',
    currentEnv: 'default',
    ...conf,
  })),
  setWorkspaceConfig: jest.fn(),
  getAdapter: jest.fn(),
  setAdapter: jest.fn(),
})
const mockCredentialsSource = (): ConfigSource => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  rename: jest.fn(),
})

const createState = (elements: Element[]): State => buildInMemState(async () => ({
  elements: _.keyBy(elements, elem => elem.elemID.getFullName()),
  pathIndex: new PathIndex(),
  servicesUpdateDate: {},
  saltoVersion: '0.0.1',
}))

const createWorkspace = async (
  dirStore?: DirectoryStore<string>, state?: State,
  configSource?: WorkspaceConfigSource, credentials?: ConfigSource,
  staticFilesSource?: StaticFilesSource,
  elementSources?: Record<string, EnvironmentSource>,
): Promise<Workspace> =>
  loadWorkspace(configSource || mockWorkspaceConfigSource(), credentials || mockCredentialsSource(),
    {
      commonSourceName: '',
      sources: elementSources || {
        '': {
          naclFiles: naclFilesSource(
            dirStore || mockDirStore(), mockParseCache(),
            staticFilesSource || mockStaticFilesSource(),
          ),
        },
        default: {
          naclFiles: createMockNaclFileSource([]),
          state: state ?? createState([]),
        },
      },
    })

const getElemMap = (elements: ReadonlyArray<Element>): Record<string, Element> =>
  _.keyBy(elements, elem => elem.elemID.getFullName())

describe('workspace', () => {
  describe('loadWorkspace', () => {
    it('should fail if envs is empty', async () => {
      const noWorkspaceConfig = {
        getWorkspaceConfig: jest.fn().mockImplementation(() => ({ envs: [] })),
        setWorkspaceConfig: jest.fn(),
        getAdapter: jest.fn(),
        setAdapter: jest.fn(),
      }
      await expect(createWorkspace(undefined, undefined, noWorkspaceConfig)).rejects
        .toThrow(new Error('Workspace with no environments is illegal'))
    })
  })
  describe('elements', () => {
    let workspace: Workspace
    let elemMap: Record<string, Element>
    beforeAll(async () => {
      const state = createState([
        new ObjectType({
          elemID: new ElemID('salesforce', 'hidden'),
          annotations: { _hidden: true },
        }),
      ])
      workspace = await createWorkspace(undefined, state)
    })
    describe('with hidden values and types', () => {
      beforeAll(async () => {
        elemMap = getElemMap(await workspace.elements())
      })
      it('should contain types from all files', () => {
        expect(elemMap).toHaveProperty(['salesforce.lead'])
        expect(elemMap).toHaveProperty(['multi.loc'])
        expect(elemMap).toHaveProperty(['salesforce.hidden'])
      })
      it('should be merged', () => {
        const lead = elemMap['salesforce.lead'] as ObjectType
        expect(_.keys(lead.fields)).toHaveLength(5)
      })
    })
    describe('loaded elements without hidden types', () => {
      beforeAll(async () => {
        elemMap = getElemMap(await workspace.elements(false))
      })
      it('should contain types from all files', () => {
        expect(elemMap).toHaveProperty(['salesforce.lead'])
        expect(elemMap).toHaveProperty(['multi.loc'])
        expect(elemMap).not.toHaveProperty(['salesforce.hidden'])
      })
      it('should be merged', () => {
        const lead = elemMap['salesforce.lead'] as ObjectType
        expect(_.keys(lead.fields)).toHaveLength(5)
      })
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
      const err = 'Expected {, word or " token but found instead: }.'
      expect(errors.strings()[0]).toMatch(err)
      expect(errors.parse[0].message).toMatch(err)

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
      expect(firstSourceFragment.sourceRange.start).toEqual({ byte: 26, col: 3, line: 3 })
      expect(firstSourceFragment.sourceRange.end).toEqual({ byte: 79, col: 4, line: 5 })
      expect(firstSourceFragment.fragment).toContain('salesforce.text base_field')
    })
    it('should have merge error when hidden values are added to nacl', async () => {
      const state = createState([])
      const workspace = await createWorkspace(
        mockDirStore([], false, {
          'x.nacl': `type salto.t {
            number field {
              ${CORE_ANNOTATIONS.HIDDEN} = true
            }
          }
          salto.t inst {
            field = 1
          }`,
        }),
        state,
      )
      state.override(resolve(await workspace.elements(false)))

      const wsErrors = await workspace.errors()
      expect(wsErrors.merge).toHaveLength(1)
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
    const fieldsParent = new ObjectType({ elemID: new ElemID('salesforce', 'lead') })
    const oldField = new Field(
      fieldsParent,
      'not_a_list_yet_field',
      BuiltinTypes.NUMBER,
      {},
    )
    const newField = oldField.clone()
    newField.type = new ListType(newField.type)
    const anotherNewField = new Field(
      fieldsParent,
      'lala',
      new ListType(BuiltinTypes.NUMBER),
      {},
    )
    const newMultiLineField = new Field(
      fieldsParent,
      'myFormula',
      BuiltinTypes.STRING,
      {
        myFormula: 'This\nis\nmultiline',
      },
    )

    const queueSobjectHiddenSubType = new ObjectType({
      elemID: new ElemID('salesforce', 'QueueSobject', 'type', ''),
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: true,
        [METADATA_TYPE]: 'QueueSobject',
      },
      path: ['salesforce', 'Types', 'Subtypes', 'QueueSobject'],
    })

    queueSobjectHiddenSubType.fields.str = new Field(
      queueSobjectHiddenSubType,
      'str',
      BuiltinTypes.STRING,
    )


    const accountInsightsSettingsType = new ObjectType({
      elemID: new ElemID('salesforce', 'AccountInsightsSettings', 'type'),
      annotations: {
        [METADATA_TYPE]: 'AccountInsightsSettings',
      },
      path: ['salesforce', 'Types', 'AccountInsightsSettings'],
    })

    const queueHiddenType = new ObjectType({
      elemID: new ElemID('salesforce', 'Queue', 'type', ''),
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: true,
        [METADATA_TYPE]: 'Queue',
      },
      fields: {
        queueSobjectHidden: new Field(
          queueSobjectHiddenSubType,
          'queueSobjectHidden',
          queueSobjectHiddenSubType,
          {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        queueSobjectNotHidden: new Field(
          queueSobjectHiddenSubType,
          'queueSobjectNotHidden',
          queueSobjectHiddenSubType,
          {},
        ),
        numHidden: new Field(
          queueSobjectHiddenSubType,
          'numHidden',
          BuiltinTypes.NUMBER,
          {
            [CORE_ANNOTATIONS.HIDDEN]: true,
          },
        ),
        boolNotHidden: new Field(
          queueSobjectHiddenSubType,
          'boolNotHidden',
          BuiltinTypes.BOOLEAN,
        ),
      },
      path: ['salesforce', 'Types', 'Queue'],
      isSettings: false,
    })

    const queueInstance = new InstanceElement(
      'queueInstance',
      queueHiddenType,
      {
        queueSobjectHidden: {
          str: 'text',
        },
        queueSobjectNotHidden: {
          str: 'text2',
        },
        numHidden: 123,
        boolNotHidden: false,
      },
      ['Records', 'Queue', 'queueInstance'],
    )

    const changes: DetailedChange[] = [
      {
        path: ['file'],
        id: newMultiLineField.elemID,
        action: 'add',
        data: {
          after: newMultiLineField,
        },
      },
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
      { // Change from primitive to object in a list
        id: new ElemID('salesforce', 'lead', 'field', 'list_field', CORE_ANNOTATIONS.DEFAULT, '4'),
        action: 'modify',
        data: { before: 5, after: { foo: 'bla' } },
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
      { // new annotation type to a type with no annotation types block without path
        id: new ElemID('salesforce', 'WithoutAnnotationsBlock', 'annotation', 'newAnnoType1'),
        action: 'add',
        data: { after: BuiltinTypes.STRING },
      },
      { // new annotation type to a type with no annotation types block without path
        id: new ElemID('salesforce', 'WithoutAnnotationsBlock', 'annotation', 'newAnnoType2'),
        action: 'add',
        data: { after: BuiltinTypes.NUMBER },
      },
      { // new Hidden type (should be removed)
        id: new ElemID('salesforce', 'Queue'),
        action: 'add',
        data: {
          after: queueHiddenType,
        },
      },
      { // new Hidden (sub) type (should be removed)
        id: new ElemID('salesforce', 'QueueSobject'),
        action: 'add',
        data: {
          after: queueSobjectHiddenSubType,
        },
      },
      { // when Hidden type change to be not hidden
        id: new ElemID('salesforce', 'AccountInsightsSettings', 'attr', '_hidden'),
        action: 'remove',
        data: {
          before: true,
        },
      },
      { // when type change to be hidden
        id: new ElemID('salesforce', 'AccountIntelligenceSettings', 'attr', '_hidden'),
        action: 'add',
        data: { after: true },
      },
      { // Change inside a hidden type
        id: new ElemID(
          'salesforce', 'AccountIntelligenceSettings', 'field', 'enableAccountLogos', '_required',
        ),
        action: 'add',
        data: { after: true },
      },
      { // new instance
        id: new ElemID('salesforce', 'Queue', 'instance', 'queueInstance'),
        action: 'add',
        data: {
          after: queueInstance,
        },
      },
      { // Hidden field change to visible
        id: new ElemID('salesforce', 'ObjWithHidden', 'field', 'hide', CORE_ANNOTATIONS.HIDDEN),
        action: 'modify',
        data: { before: true, after: false },
      },
      { // Visible field change to hidden
        id: new ElemID('salesforce', 'ObjWithHidden', 'field', 'visible', CORE_ANNOTATIONS.HIDDEN),
        action: 'add',
        data: { after: true },
      },
      { // Change to field value as it becomes visible
        id: new ElemID('salesforce', 'ObjWithHidden', 'instance', 'instWithHidden', 'hide'),
        action: 'add',
        data: { after: 'changed' },
      },
      { // Change to field value as it becomes hidden
        id: new ElemID('salesforce', 'ObjWithHidden', 'instance', 'instWithHidden', 'visible'),
        action: 'modify',
        data: { before: 142, after: 150 },
      },
      { // Change where only part of the value is visible
        id: new ElemID('salesforce', 'ObjWithNestedHidden', 'instance', 'instWithNestedHidden', 'nested'),
        action: 'add',
        data: { after: { visible: 1, hide: 'a', other: 2 } },
      },
      { // Change inside a hidden complex field
        id: new ElemID('salesforce', 'ObjWithComplexHidden', 'instance', 'instWithComplexHidden', 'nested', 'other'),
        action: 'modify',
        data: { before: 3, after: 4 },
      },
    ]

    let clonedChanges: DetailedChange[]

    // New elements
    let newHiddenType: ObjectType
    let newHiddenSubType: ObjectType
    let newNotHiddenType: ObjectType
    let newInstance: InstanceElement

    // Changed elements
    let typeBecameNotHidden: ObjectType
    let typeBecameHidden: ObjectType
    let instWithHidden: InstanceElement
    let instWithComplexHidden: InstanceElement
    let instWithNestedHidden: InstanceElement

    let lead: ObjectType
    let elemMap: Record<string, Element>
    let workspace: Workspace
    const dirStore = mockDirStore()

    beforeAll(async () => {
      const state = createState([])
      workspace = await createWorkspace(dirStore, state)
      // We assume the state is synced with the workspace elements before we make changes
      // We also assume the state elements are updated before we call updateNaclFiles so that hidden
      // values can be taken from the state
      // The call to resolve is the only safe way to clone elements while keeping all
      // the inner references between elements correct, we then apply all the changes to the copied
      // elements and set them along with the hidden types as the state elements
      const stateElements = resolve(await workspace.elements())
      const stateElementsById = _.keyBy(stateElements, elem => elem.elemID.getFullName())
      const changesByElem = _.groupBy(
        changes,
        change => change.id.createTopLevelParentID().parent.getFullName()
      )
      Object.entries(changesByElem).forEach(([elemId, elemChanges]) => {
        const elem = stateElementsById[elemId]
        if (isType(elem) || isInstanceElement(elem)) {
          applyDetailedChanges(elem, elemChanges)
        }
      })
      state.override(
        [...stateElements, accountInsightsSettingsType, queueHiddenType]
      )

      clonedChanges = _.cloneDeep(changes)
      await workspace.updateNaclFiles(clonedChanges)

      elemMap = getElemMap(await workspace.elements(false))
      lead = elemMap['salesforce.lead'] as ObjectType

      // New types (first time returned from service)
      newHiddenType = elemMap['salesforce.Queue'] as ObjectType
      newHiddenSubType = elemMap['salesforce.QueueSobject'] as ObjectType
      newNotHiddenType = elemMap['salesforce.new_elem'] as ObjectType

      // Changed types
      typeBecameNotHidden = elemMap['salesforce.AccountInsightsSettings'] as ObjectType
      typeBecameHidden = elemMap['salesforce.AccountIntelligenceSettings'] as ObjectType

      newInstance = elemMap['salesforce.Queue.instance.queueInstance'] as InstanceElement
      instWithHidden = elemMap[
        'salesforce.ObjWithHidden.instance.instWithHidden'
      ] as InstanceElement
      instWithComplexHidden = elemMap[
        'salesforce.ObjWithComplexHidden.instance.instWithComplexHidden'
      ] as InstanceElement
      instWithNestedHidden = elemMap[
        'salesforce.ObjWithNestedHidden.instance.instWithNestedHidden'
      ] as InstanceElement
    })

    it('should not cause parse errors', async () => {
      expect(await workspace.hasErrors()).toBeFalsy()
      expect((await workspace.errors()).hasErrors()).toBeFalsy()
    })
    it('should modify existing element', () => {
      expect(lead).toBeDefined()
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('foo')
    })

    it('should not modify the changes object', () => {
      expect(clonedChanges).toEqual(changes)
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
    it('should add annotation type to the existing annotations block with path hint', () => {
      const objWithAnnotationsBlock = elemMap['salesforce.WithAnnotationsBlock'] as ObjectType
      expect(objWithAnnotationsBlock.annotationTypes).toHaveProperty('firstAnnotation')
      expect(objWithAnnotationsBlock.annotationTypes.firstAnnotation).toEqual(BuiltinTypes.STRING)
      expect(objWithAnnotationsBlock.annotationTypes).toHaveProperty('secondAnnotation')
      expect(objWithAnnotationsBlock.annotationTypes.secondAnnotation).toEqual(BuiltinTypes.NUMBER)
    })
    it('should add annotation type to the existing annotations block without path hint', () => {
      const objWithoutAnnoBlock = elemMap['salesforce.WithoutAnnotationsBlock'] as ObjectType
      expect(objWithoutAnnoBlock.annotationTypes).toHaveProperty('newAnnoType1')
      expect(objWithoutAnnoBlock.annotationTypes.newAnnoType1).toEqual(BuiltinTypes.STRING)
      expect(objWithoutAnnoBlock.annotationTypes).toHaveProperty('newAnnoType2')
      expect(objWithoutAnnoBlock.annotationTypes.newAnnoType2).toEqual(BuiltinTypes.NUMBER)
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
        .annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual([1, 2, 3, 5, { foo: 'bla' }])
    })
    it('should change isList value in fields', () => {
      expect(isListType(lead.fields.not_a_list_yet_field.type)).toBeTruthy()
    })

    it('my formula was added correctly', () => {
      expect(lead.fields.myFormula.annotations.myFormula).toEqual('This\nis\nmultiline')
    })
    it('my formula is not indented', () => {
      const setNaclFile = dirStore.set as jest.Mock
      const myFormula = /'''\nThis\nis\nmultiline\n'''/
      expect(setNaclFile.mock.calls[0][0].buffer).toMatch(myFormula)
    })

    it('should remove new hidden types', () => {
      expect(newHiddenType).toBeUndefined()
      expect(newHiddenSubType).toBeUndefined()
    })

    it('should not remove new type', () => {
      expect(newNotHiddenType).toBeDefined()
    })

    it('should add the type that change from hidden to not hidden ', () => {
      expect(typeBecameNotHidden).toBeDefined()
      expect(typeBecameNotHidden).toEqual(accountInsightsSettingsType)
    })

    it('should remove the type that became to be hidden', () => {
      expect(typeBecameHidden).toBeUndefined()
    })

    it('should add new instance without hidden fields values', () => {
      expect(newInstance).toBeDefined()
      expect(newInstance).not.toEqual(queueInstance)

      // Hidden fields values should be undefined
      expect(newInstance.value.queueSobjectHidden).toBeUndefined()
      expect(newInstance.value.numHidden).toBeUndefined()

      // Not hidden fields values should be defined
      expect(newInstance.value.queueSobjectNotHidden).toBeDefined()
      expect(newInstance.value.boolNotHidden).toEqual(false)
    })

    it('should not add changes in hidden values', () => {
      expect(instWithComplexHidden.value).not.toHaveProperty('nested')
    })

    it('should remove values of fields that became hidden', () => {
      expect(instWithHidden.value).not.toHaveProperty('visible')
      expect(instWithNestedHidden.value.nested).not.toHaveProperty('visible')
    })

    it('should add values that became visible', () => {
      expect(instWithHidden.value.hide).toEqual('changed')
      expect(instWithNestedHidden.value.nested.hide).toEqual('a')
    })

    it('should not fail in case one of the changes fails', async () => {
      jest.spyOn(dump, 'dumpValues').mockImplementationOnce(() => { throw new Error('failed') })
      const change1: DetailedChange = {
        id: new ElemID('salesforce', 'lead', 'field', 'ext_field', CORE_ANNOTATIONS.DEFAULT),
        action: 'add',
        data: { after: 'blabla' },
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
    const workspaceConf = mockWorkspaceConfigSource({ name: 'ws-name' })
    afterEach(async () => {
      delete process.env.SALTO_HOME
    })
    it('should init workspace configuration', async () => {
      const workspace = await initWorkspace('ws-name', 'uid', 'default', workspaceConf,
        mockCredentialsSource(), { commonSourceName: '', sources: {} })
      expect((workspaceConf.setWorkspaceConfig as jest.Mock).mock.calls[0][0]).toEqual(
        { name: 'ws-name', uid: 'uid', envs: [{ name: 'default' }], currentEnv: 'default' }
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
      const ws = await createWorkspace(undefined, undefined, mockWorkspaceConfigSource(
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
      const ws = await createWorkspace(undefined, undefined, mockWorkspaceConfigSource(
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
      const workspace = await createWorkspace(flushable as unknown as DirectoryStore<string>,
        flushable as unknown as State)
      await workspace.flush()
      expect(mockFlush).toHaveBeenCalledTimes(2)
    })
  })

  describe('setCurrentEnv', () => {
    let workspaceConf: WorkspaceConfigSource
    let workspace: Workspace
    let credSource: ConfigSource
    let state: State
    let defNaclFiles: NaclFilesSource
    let inactiveNaclFiles: NaclFilesSource

    beforeEach(async () => {
      workspaceConf = mockWorkspaceConfigSource()
      credSource = mockCredentialsSource()
      state = createState([])
      defNaclFiles = createMockNaclFileSource([])
      inactiveNaclFiles = createMockNaclFileSource([
        new ObjectType({ elemID: new ElemID('salto', 'inactive') }),
      ])
      workspace = await createWorkspace(undefined, undefined, workspaceConf, credSource,
        undefined,
        {
          default: { naclFiles: defNaclFiles, state },
          inactive: { naclFiles: inactiveNaclFiles, state },
        })
    })

    it('should change workspace state', async () => {
      await workspace.setCurrentEnv('inactive')
      expect(workspace.services()).toEqual([...services, 'hubspot'])
    })

    it('should persist', async () => {
      await workspace.setCurrentEnv('inactive')
      expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(1)
    })

    it('shouldnt persist', async () => {
      await workspace.setCurrentEnv('inactive', false)
      expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(0)
    })

    it('should throw unknownEnvError', async () => {
      await expect(workspace.setCurrentEnv('unknown', false)).rejects.toEqual(new UnknownEnvError('unknown'))
    })

    it('should return the elements of the new current envs after set', async () => {
      const defaultElemIDs = (await workspace.elements()).map(e => e.elemID.getFullName())
      expect(defaultElemIDs).toHaveLength(0)
      await workspace.setCurrentEnv('inactive')
      const inactiveElemIDs = (await workspace.elements()).map(e => e.elemID.getFullName())
      expect(inactiveElemIDs).toHaveLength(1)
      expect(inactiveElemIDs).toEqual(['salto.inactive'])
    })
  })

  describe('addEnvironment', () => {
    let workspaceConf: WorkspaceConfigSource
    let workspace: Workspace

    beforeEach(async () => {
      workspaceConf = mockWorkspaceConfigSource()
      workspace = await createWorkspace(undefined, undefined, workspaceConf)
      await workspace.addEnvironment('new')
    })

    it('should change workspace state', async () => {
      expect(workspace.envs().includes('new')).toBeTruthy()
    })

    it('should persist', () => {
      expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(1)
      const envs = (
        workspaceConf.setWorkspaceConfig as jest.Mock
      ).mock.calls[0][0].envs as EnvConfig[]
      const envsNames = envs.map((e: {name: string}) => e.name)
      expect(envsNames.includes('new')).toBeTruthy()
    })
    it('should throw envDuplicationError', async () => {
      await expect(workspace.addEnvironment('new')).rejects.toEqual(new EnvDuplicationError('new'))
    })
  })

  describe('deleteEnvironment', () => {
    describe('should delete environment', () => {
      let workspaceConf: WorkspaceConfigSource
      let credSource: ConfigSource
      let workspace: Workspace
      let stateClear: jest.SpyInstance
      let naclFiles: NaclFilesSource
      const envName = 'inactive'

      beforeAll(async () => {
        workspaceConf = mockWorkspaceConfigSource()
        credSource = mockCredentialsSource()
        const state = createState([])
        stateClear = jest.spyOn(state, 'clear')
        naclFiles = createMockNaclFileSource([])
        workspace = await createWorkspace(undefined, undefined, workspaceConf, credSource,
          undefined, { inactive: { naclFiles, state } })
        await workspace.deleteEnvironment(envName)
      })

      it('should not be included in the workspace envs', async () => {
        expect(workspace.envs().includes(envName)).toBeFalsy()
      })

      it('should persist', () => {
        expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(1)
        const envs = (
          workspaceConf.setWorkspaceConfig as jest.Mock
        ).mock.calls[0][0].envs as EnvConfig[]
        const envsNames = envs.map((e: {name: string}) => e.name)
        expect(envsNames.includes(envName)).toBeFalsy()
      })

      it('should delete files', () => {
        expect(credSource.delete).toHaveBeenCalledTimes(1)
        expect(stateClear).toHaveBeenCalledTimes(1)
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

  describe('clear', () => {
    let workspaceConf: WorkspaceConfigSource
    let credSource: ConfigSource
    let workspace: Workspace
    let elementSources: Record<string, EnvironmentSource>

    beforeAll(async () => {
      workspaceConf = mockWorkspaceConfigSource()
      credSource = mockCredentialsSource()
      elementSources = {
        '': {
          naclFiles: createMockNaclFileSource([]),
        },
        default: {
          naclFiles: createMockNaclFileSource([]),
          state: createState([]),
        },
        inactive: {
          naclFiles: createMockNaclFileSource([]),
          state: createState([]),
        },
      }
      workspace = await createWorkspace(undefined, undefined, workspaceConf, credSource,
        undefined, elementSources)
    })
    it('should clear specified workspace components, but not the environments', async () => {
      const origEnvs = _.clone(workspace.envs())
      const stateClears = {
        default: jest.spyOn(elementSources.default.state as State, 'clear'),
        inactive: jest.spyOn(elementSources.inactive.state as State, 'clear'),
      }
      await workspace.clear({
        nacl: true,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
      })
      expect(workspace.envs()).toEqual(origEnvs)
      expect(elementSources[''].naclFiles.clear).toHaveBeenCalledWith({
        nacl: true,
        cache: true,
        staticResources: true,
        // ignored
        credentials: true,
        state: true,
      })
      expect(elementSources.default.naclFiles.clear).toHaveBeenCalledWith({
        nacl: true,
        cache: true,
        staticResources: true,
        // ignored
        credentials: true,
        state: true,
      })
      expect(elementSources.inactive.naclFiles.clear).toHaveBeenCalledWith({
        nacl: true,
        cache: true,
        staticResources: true,
        // ignored
        credentials: true,
        state: true,
      })
      expect(stateClears.default).toHaveBeenCalledTimes(1)
      expect(stateClears.inactive).toHaveBeenCalledTimes(1)
      expect(credSource.delete).toHaveBeenCalledTimes(2)
    })

    it('should fail if trying to clear static resources without all dependent components', async () => {
      await expect(workspace.clear({
        nacl: false,
        state: true,
        cache: true,
        staticResources: true,
        credentials: true,
      })).rejects.toThrow('Cannot clear static resources without clearing the state, cache and nacls')
    })
  })

  describe('renameEnvironment', () => {
    describe('should rename environment', () => {
      let workspaceConf: WorkspaceConfigSource
      let workspace: Workspace
      let credSource: ConfigSource
      let state: State
      let stateRename: jest.SpyInstance
      let naclFiles: NaclFilesSource

      beforeEach(async () => {
        workspaceConf = mockWorkspaceConfigSource()
        credSource = mockCredentialsSource()
        state = createState([])
        stateRename = jest.spyOn(state, 'rename')
        naclFiles = createMockNaclFileSource([])
      })

      const verifyRenameFiles = (): void => {
        expect(credSource.rename).toHaveBeenCalledTimes(1)
        expect(stateRename).toHaveBeenCalledTimes(1)
        expect(naclFiles.rename).toHaveBeenCalledTimes(1)
      }

      const verifyPersistWorkspaceConfig = (envName: string): void => {
        const envs = (
          workspaceConf.setWorkspaceConfig as jest.Mock
        ).mock.calls[0][0].envs as EnvConfig[]
        const envsNames = envs.map((e: {name: string}) => e.name)
        expect(envsNames.includes(envName)).toBeTruthy()
      }

      describe('should rename current environment', () => {
        const envName = 'default'
        const newEnvName = 'new-default'
        beforeEach(async () => {
          workspace = await createWorkspace(undefined, undefined, workspaceConf, credSource,
            undefined, { [envName]: { naclFiles, state } })
          await workspace.renameEnvironment(envName, newEnvName)
        })
        it('should change workspace state', async () => {
          expect(workspace.envs().includes(newEnvName)).toBeTruthy()
        })

        it('should persist both workspace config and workspace user config', async () => {
          expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(1)
          verifyPersistWorkspaceConfig(newEnvName)
          const workspaceUserConfig = (workspaceConf.setWorkspaceConfig as jest.Mock)
            .mock.calls[0][0].currentEnv
          expect(workspaceUserConfig).toEqual(newEnvName)
        })

        it('should rename files', async () => {
          verifyRenameFiles()
        })
      })

      describe('should rename inactive environment', () => {
        const envName = 'inactive'
        const newEnvName = 'new-inactive'
        beforeEach(async () => {
          workspace = await createWorkspace(undefined, undefined, workspaceConf, credSource,
            undefined, { [envName]: { naclFiles, state } })
          await workspace.renameEnvironment(envName, newEnvName)
        })
        it('should change workspace state', async () => {
          expect(workspace.envs().includes(newEnvName)).toBeTruthy()
        })

        it('should persist workspace config', async () => {
          expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(1)
          verifyPersistWorkspaceConfig(newEnvName)
        })

        it('should rename files', async () => {
          verifyRenameFiles()
        })
      })
    })

    describe('should fail to rename environment', () => {
      let workspace: Workspace
      beforeEach(async () => {
        workspace = await createWorkspace()
      })

      it('should not be able to delete unknown environment', async () => {
        await expect(workspace.renameEnvironment('unknown', 'new-unknown'))
          .rejects.toThrow(UnknownEnvError)
      })

      it('should not be able to rename to existing environment name', async () => {
        await expect(workspace.renameEnvironment('default', 'default'))
          .rejects.toThrow(EnvDuplicationError)
      })
    })
  })

  describe('addService', () => {
    let workspaceConf: WorkspaceConfigSource
    let workspace: Workspace

    beforeEach(async () => {
      workspaceConf = mockWorkspaceConfigSource()
      workspace = await createWorkspace(undefined, undefined, workspaceConf)
      await workspace.addService('new')
    })

    it('should change workspace state', async () => {
      expect(workspace.services().includes('new')).toBeTruthy()
    })

    it('should throw service duplication error', async () => {
      await expect(workspace.addService('new')).rejects.toThrow(ServiceDuplicationError)
    })

    it('should persist', () => {
      expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(1)
      const envs = (
        workspaceConf.setWorkspaceConfig as jest.Mock
      ).mock.calls[0][0].envs as EnvConfig[]
      expect((envs as {name: string}[]).find(e => e.name === 'default'))
        .toBeDefined()
    })
  })

  describe('updateServiceCredentials', () => {
    let credsSource: ConfigSource
    let workspace: Workspace
    const newCreds = new InstanceElement(
      services[0],
      new ObjectType({ elemID: new ElemID(services[0]) }),
      { user: 'username', password: 'pass' },
    )

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
    let workspaceConf: WorkspaceConfigSource
    let workspace: Workspace
    const newConf = new InstanceElement(services[0],
      new ObjectType({ elemID: new ElemID(services[0]) }), { conf1: 'val1' })

    beforeEach(async () => {
      workspaceConf = mockWorkspaceConfigSource()
      workspace = await createWorkspace(undefined, undefined, workspaceConf)
      await workspace.updateServiceConfig(services[0], newConf)
    })

    it('should persist', () => {
      expect(workspaceConf.setAdapter).toHaveBeenCalledTimes(1)
      const setAdapterParams = (
        workspaceConf.setAdapter as jest.Mock
      ).mock.calls[0]
      expect(setAdapterParams[0]).toEqual('salesforce')
      expect(setAdapterParams[1]).toEqual(newConf)
    })
  })

  describe('servicesCredentials', () => {
    let credsSource: ConfigSource
    let workspace: Workspace

    beforeEach(async () => {
      credsSource = {
        get: jest.fn().mockResolvedValue(
          new InstanceElement(services[0], new ObjectType({ elemID: new ElemID(services[0]) }),
            { usename: 'default', password: 'default', currentEnv: 'default' })
        ),
        set: jest.fn(),
        delete: jest.fn(),
        rename: jest.fn(),
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
})
