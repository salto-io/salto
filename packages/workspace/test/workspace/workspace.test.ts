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
import _ from 'lodash'
import wu from 'wu'
import {
  Element, ObjectType, ElemID, Field, DetailedChange, BuiltinTypes, InstanceElement, ListType,
  Values, CORE_ANNOTATIONS, isInstanceElement, isType, isField, PrimitiveTypes,
  isObjectType, ContainerType, Change, AdditionChange, getChangeElement, PrimitiveType, Value,
} from '@salto-io/adapter-api'
import { findElement, applyDetailedChanges, createRefToElmWithValue } from '@salto-io/adapter-utils'
// eslint-disable-next-line no-restricted-imports
import { METADATA_TYPE, INTERNAL_ID_ANNOTATION } from '@salto-io/salesforce-adapter/dist/src/constants'
import { collections } from '@salto-io/lowerdash'
import { ValidationError } from '../../src/validator'
import { WorkspaceConfigSource } from '../../src/workspace/workspace_config_source'
import { ConfigSource } from '../../src/workspace/config_source'
import { naclFilesSource, NaclFilesSource } from '../../src/workspace/nacl_files'
import { State, buildInMemState } from '../../src/workspace/state'
import { createMockNaclFileSource } from '../common/nacl_file_source'
import { mockStaticFilesSource, persistentMockCreateRemoteMap } from '../utils'
import { DirectoryStore } from '../../src/workspace/dir_store'
import { Workspace, initWorkspace, loadWorkspace, EnvironmentSource,
  COMMON_ENV_PREFIX } from '../../src/workspace/workspace'
import { DeleteCurrentEnvError,
  UnknownEnvError, EnvDuplicationError, ServiceDuplicationError } from '../../src/workspace/errors'
import { StaticFilesSource } from '../../src/workspace/static_files'
import * as dump from '../../src/parser/dump'
import { mockDirStore } from '../common/nacl_file_store'
import { EnvConfig } from '../../src/workspace/config/workspace_config_types'
import { resolve } from '../../src/expressions'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { InMemoryRemoteMap, RemoteMapCreator, RemoteMap, CreateRemoteMapParams } from '../../src/workspace/remote_map'

const { awu } = collections.asynciterable

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
  elements: createInMemoryElementSource(elements),
  pathIndex: new InMemoryRemoteMap(),
  servicesUpdateDate: new InMemoryRemoteMap(),
  saltoMetadata: new InMemoryRemoteMap([{ key: 'version', value: '0.0.1' }]),
}))

const createWorkspace = async (
  dirStore?: DirectoryStore<string>,
  state?: State,
  configSource?: WorkspaceConfigSource,
  credentials?: ConfigSource,
  staticFilesSource?: StaticFilesSource,
  elementSources?: Record<string, EnvironmentSource>,
  remoteMapCreator?: RemoteMapCreator
): Promise<Workspace> => {
  const mapCreator = remoteMapCreator ?? persistentMockCreateRemoteMap()
  const actualStaticFilesSource = staticFilesSource || mockStaticFilesSource()
  return loadWorkspace(
    configSource || mockWorkspaceConfigSource(),
    credentials || mockCredentialsSource(),
    {
      commonSourceName: '',
      sources: elementSources || {
        '': {
          naclFiles: await naclFilesSource(
            '',
            dirStore || mockDirStore(),
            actualStaticFilesSource,
            mapCreator,
          ),
        },
        default: {
          naclFiles: createMockNaclFileSource([]),
          state: state ?? createState([]),
        },
      },
    },
    mapCreator,
  )
}

const getElemMap = async (
  elements: ElementsSource
): Promise<Record<string, Element>> => Object.fromEntries(
  await awu(await elements.getAll())
    .map(e => [e.elemID.getFullName(), e])
    .toArray()
)

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
    let state: State
    beforeAll(async () => {
      state = createState([
        new ObjectType({
          elemID: new ElemID('salesforce', 'hidden'),
          annotations: { _hidden: true },
        }),
        new ObjectType({
          elemID: new ElemID('salesforce', 'AccountIntelligenceSettings'),
          annotations: {
            hiddenStrAnno: 'some value',
          },
          annotationRefsOrTypes: {
            hiddenStrAnno: BuiltinTypes.HIDDEN_STRING,
          },
        }),
        new ObjectType({
          elemID: new ElemID('salesforce', 'NotExistsInWorkspace'),
        }),
      ])
      workspace = await createWorkspace(undefined, state)
    })
    describe('with hidden values and types', () => {
      beforeAll(async () => {
        elemMap = await getElemMap(await workspace.elements())
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
        elemMap = await getElemMap(await workspace.elements(false))
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
    describe('getValue', () => {
      it('unknown elemId should return undefined', async () => {
        expect(await workspace.getValue(new ElemID('notExists'))).toBeUndefined()
      })

      it('workspace element should return the element', async () => {
        expect(isObjectType(await workspace.getValue(new ElemID('salesforce', 'lead')))).toBeTruthy()
      })

      it('state element should return the element', async () => {
        expect(isObjectType(await workspace.getValue(new ElemID('salesforce', 'hidden')))).toBeTruthy()
      })

      it('element with hidden annotation should return the element', async () => {
        const element = await workspace.getValue(new ElemID('salesforce', 'AccountIntelligenceSettings'))
        expect(element?.annotations?.hiddenStrAnno).toBe('some value')
      })

      it('deleted workspace element should return undefined', async () => {
        expect(await workspace.getValue(new ElemID('salesforce', 'NotExistsInWorkspace'))).toBeUndefined()
      })

      it('should return annotation value', async () => {
        expect(await workspace.getValue(new ElemID('salesforce', 'AccountIntelligenceSettings', 'attr', 'hiddenStrAnno'))).toBe('some value')
      })

      it('element field should return the element', async () => {
        expect(isField(await workspace.getValue(new ElemID('salesforce', 'lead', 'field', 'base_field')))).toBeTruthy()
      })
    })
    describe('elements of non primary env', () => {
      it('should create a new workspace state correctly', async () => {
        const primaryEnvElemID = new ElemID('salesforce', 'primaryObj')
        const secondaryEnvElemID = new ElemID('salesforce', 'secondaryObj')
        const primaryEnvObj = new ObjectType({ elemID: primaryEnvElemID })
        const secondaryEnvObj = new ObjectType({ elemID: secondaryEnvElemID })
        const newWorkspace = await createWorkspace(
          undefined, undefined, undefined, undefined, undefined, {
            '': {
              naclFiles: createMockNaclFileSource([]),
            },
            default: {
              naclFiles: createMockNaclFileSource([primaryEnvObj]),
              state: createState([primaryEnvObj]),
            },
            inactive: {
              naclFiles: createMockNaclFileSource([secondaryEnvObj]),
              state: createState([secondaryEnvObj]),
            },
          },
        )
        const currentEnvElements = await awu(await (await newWorkspace.elements()).getAll())
          .toArray()
        expect(currentEnvElements.find(e => e.elemID.isEqual(primaryEnvElemID))).toBeDefined()
        expect(currentEnvElements.find(e => e.elemID.isEqual(secondaryEnvElemID))).not.toBeDefined()
        const inactiveEnvElements = await awu(await (await newWorkspace.elements(undefined, 'inactive'))
          .getAll()).toArray()
        expect(inactiveEnvElements.find(e => e.elemID.isEqual(primaryEnvElemID))).not.toBeDefined()
        expect(inactiveEnvElements.find(e => e.elemID.isEqual(secondaryEnvElemID))).toBeDefined()
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

  describe('getSearchableNames', () => {
    let workspace: Workspace
    const TOTAL_NUM_ELEMENETS = 54

    it('Should return names of top level elemnts and fields', async () => {
      workspace = await createWorkspace()
      const searchableNames = await workspace.getSearchableNames()
      expect(searchableNames.length).toEqual(TOTAL_NUM_ELEMENETS)
    })

    it('Should remove object and fields from list if removed', async () => {
      workspace = await createWorkspace()
      const accountIntSett = await workspace.getValue(new ElemID('salesforce', 'AccountIntelligenceSettings')) as ObjectType
      const searchableNames = await workspace.getSearchableNames()
      expect(searchableNames.includes(accountIntSett.elemID.getFullName())).toBeTruthy()
      await workspace.updateNaclFiles([{
        id: accountIntSett.elemID,
        action: 'remove',
        data: { before: accountIntSett },
      }])
      const numOfFields = Object.values(accountIntSett.fields).length
      const searchableNamesAfter = await workspace.getSearchableNames()
      expect(searchableNamesAfter.length).toEqual(TOTAL_NUM_ELEMENETS - (numOfFields + 1))
      expect(searchableNamesAfter.includes(accountIntSett.elemID.getFullName())).toBeFalsy()
      Object.values(accountIntSett.fields).forEach(field => {
        expect(searchableNamesAfter.includes(field.elemID.getFullName())).toBeFalsy()
      })
    })

    it('Should add object and fields to list if added', async () => {
      workspace = await createWorkspace()
      const newElemID = new ElemID('salesforce', 'new')
      const newObject = new ObjectType({
        elemID: newElemID,
        fields: { aaa: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) } },
      })
      await workspace.updateNaclFiles([{
        id: newElemID,
        action: 'add',
        data: { after: newObject },
      }])
      const searchableNamesAfter = await workspace.getSearchableNames()
      expect(searchableNamesAfter.length).toEqual(TOTAL_NUM_ELEMENETS + 2)
    })
  })

  describe('errors', () => {
    it('should be empty when there are no errors', async () => {
      const workspace = await createWorkspace()
      expect((await workspace.errors()).hasErrors()).toBeFalsy()
      expect(await workspace.hasErrors()).toBeFalsy()
    })
    it('should contain parse errors', async () => {
      const erroredWorkspace = await createWorkspace(mockDirStore(['dup.nacl', 'reference_error.nacl']))

      const errors = await erroredWorkspace.errors()
      expect(errors.hasErrors()).toBeTruthy()
      const err = 'Expected block labels, found { instead.'
      expect(errors.strings()[0]).toMatch(err)
      expect(errors.parse[0].message).toMatch(err)

      expect(await erroredWorkspace.hasErrors()).toBeTruthy()
      const workspaceErrors = await Promise.all(
        wu(errors.all()).map(error => erroredWorkspace.transformError(error))
      )
      expect(workspaceErrors.length).toBeGreaterThanOrEqual(1)
      expect(workspaceErrors[0].sourceFragments).toHaveLength(1)
    })
    it('should contain validation errors', async () => {
      const erroredWorkspace = await createWorkspace(mockDirStore(['dup.nacl', 'error.nacl']))

      const errors = await erroredWorkspace.errors()
      expect(errors.hasErrors()).toBeTruthy()
      expect(errors.strings()).toEqual(['unresolved reference some.type.instance.notExists'])
      expect(errors.validation[0].message).toBe('Error validating "some.type.instance.instance.a": unresolved reference some.type.instance.notExists')

      expect(await erroredWorkspace.hasErrors()).toBeTruthy()
      const workspaceErrors = await Promise.all(
        wu(errors.all()).map(error => erroredWorkspace.transformError(error))
      )
      expect(workspaceErrors.length).toBeGreaterThanOrEqual(1)
      expect(workspaceErrors[0].sourceFragments).toHaveLength(1)
    })
    it('should contain merge errors', async () => {
      const erroredWorkspace = await createWorkspace(mockDirStore(['error.nacl', 'reference_error.nacl']))

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
      const obj = new ObjectType({
        elemID: new ElemID('salto', 't'),
        fields: {
          field: {
            annotations: {
              [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
            },
            refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
          },
        },
      })
      const inst = new InstanceElement(
        'inst',
        obj,
        {
          field: 1,
        }
      )
      const state = createState([obj, inst])
      const workspace = await createWorkspace(
        mockDirStore([], false, {
          'x.nacl': `type salto.t {
            number field {
              ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
            }
          }
          salto.t inst {
            field = 1
          }`,
        }),
        state,
      )
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
    let dirStore: DirectoryStore<string>
    let workspace: Workspace
    const removedPaths = ['file.nacl', 'willbempty.nacl']

    beforeEach(async () => {
      dirStore = mockDirStore()
      workspace = await createWorkspace(dirStore)
      await workspace.elements()
    })

    it('should update elements to not include fields from removed Nacl files', async () => {
      await workspace.removeNaclFiles(removedPaths)
      const elemMap = await getElemMap(await workspace.elements())
      expect(Object.keys(elemMap).sort())
        .toEqual(['salesforce.RenamedType1', 'salesforce.lead', 'multi.loc'].sort())
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(Object.keys(lead.fields)).toContain('ext_field')
    })

    it('should modify element to not include fields from removed Nacl files', async () => {
      const changes = (await workspace.removeNaclFiles(['subdir/file.nacl']))
      const elemMap = await getElemMap(await workspace.elements())
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(Object.keys(lead.fields)).not.toContain('ext_field')
      expect(changes.map(getChangeElement).map(c => c.elemID.getFullName()).sort())
        .toEqual(['salesforce.lead', 'multi.loc'].sort())
    })

    it('should remove from store', async () => {
      await workspace.removeNaclFiles(removedPaths)
      const mockStoreDelete = dirStore.delete as jest.Mock
      expect(mockStoreDelete.mock.calls.map(c => c[0])).toEqual(removedPaths)
    })

    it('should also work if we do not call elements in advance', async () => {
      const newWorkspace = await createWorkspace(mockDirStore())
      await newWorkspace.removeNaclFiles(removedPaths)
      const elemMap = await getElemMap(await newWorkspace.elements())
      expect(Object.keys(elemMap).sort())
        .toEqual(['salesforce.RenamedType1', 'salesforce.lead', 'multi.loc'].sort())
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(Object.keys(lead.fields)).toContain('ext_field')
    })
  })

  describe('setNaclFiles', () => {
    const naclFileStore = mockDirStore()
    let workspace: Workspace
    let elemMap: Record<string, Element>
    let changes: Change<Element>[]
    const newAddedObject = new ObjectType({ elemID: new ElemID('salesforce', 'new') })
    const salesforceLeadElemID = new ElemID('salesforce', 'lead')
    const salesforceText = new ObjectType({ elemID: new ElemID('salesforce', 'text') })
    const salesforceLeadObject = new ObjectType({
      elemID: salesforceLeadElemID,
      fields: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        new_base: { refType: createRefToElmWithValue(salesforceText) },
        // eslint-disable-next-line @typescript-eslint/camelcase
        ext_field: { refType: createRefToElmWithValue(salesforceText), annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'foo' } },
      },
    })
    const multiLocElemID = new ElemID('multi', 'loc')
    const mutliLocObject = new ObjectType({ elemID: multiLocElemID, annotations: { b: 1 } })

    beforeAll(async () => {
      workspace = await createWorkspace(naclFileStore)
      await workspace.elements()
      changes = (
        await workspace.setNaclFiles([changedNaclFile, newNaclFile, emptyNaclFile])
      )
      await workspace.setNaclFiles([changedNaclFile, newNaclFile, emptyNaclFile])
      elemMap = await getElemMap(await workspace.elements())
    })

    it('should update elements', () => {
      const refMap: Record<string, Element> = {
        'multi.loc': mutliLocObject,
        'salesforce.lead': salesforceLeadObject,
        'salesforce.new': newAddedObject,
        'salesforce.RenamedType1': new ObjectType({ elemID: new ElemID('salesforce', 'RenamedType1') }),
      }
      expect(Object.keys(refMap).sort()).toEqual(Object.keys(elemMap).sort())
      Object.keys(refMap).forEach(
        key => expect(elemMap[key].isEqual(refMap[key])).toBeTruthy()
      )
    })

    it('should create Nacl files that were added', async () => {
      const mockSetNaclFileStore = naclFileStore.set as jest.Mock
      expect(mockSetNaclFileStore).toHaveBeenCalledWith(newNaclFile)
    })

    it('should change the content of Nacl files that were updated', async () => {
      const mockSetNaclFileStore = naclFileStore.set as jest.Mock
      expect(mockSetNaclFileStore).toHaveBeenCalledWith(changedNaclFile)
    })

    it('should return the correct changes', async () => {
      expect(changes).toHaveLength(25)
      expect((changes.find(c => c.action === 'add') as AdditionChange<Element>).data.after)
        .toEqual(newAddedObject)
      const multiLocChange = changes.find(c => getChangeElement(c).elemID.isEqual(multiLocElemID))
      expect(multiLocChange).toEqual({
        action: 'modify',
        data: {
          before: new ObjectType({ elemID: multiLocElemID, annotations: { a: 1, b: 1 } }),
          after: mutliLocObject,
        },
      })
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
    beforeAll(async () => {
      newField.refType = createRefToElmWithValue(new ListType(await newField.getType()))
    })
    const anotherNewField = new Field(
      fieldsParent,
      'lala',
      new ListType(BuiltinTypes.BOOLEAN),
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
      elemID: new ElemID('salesforce', 'QueueSobject'),
      annotations: {
        [CORE_ANNOTATIONS.HIDDEN]: true,
        [METADATA_TYPE]: 'QueueSobject',
      },
      path: ['salesforce', 'Types', 'Subtypes', 'QueueSobject'],
    })

    const objFieldWithHiddenAnnotationType = new ObjectType({
      elemID: new ElemID('salesforce', 'SomeObj'),
      fields: { aaa: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) } },
      annotations: {
        hiddenStrAnno: 'some value',
      },
      annotationRefsOrTypes: {
        hiddenStrAnno: BuiltinTypes.HIDDEN_STRING,
        visibleStrAnno: BuiltinTypes.STRING,
      },
      path: ['salesforce', 'Types', 'Subtypes', 'SomeObj'],
    })

    queueSobjectHiddenSubType.fields.str = new Field(
      queueSobjectHiddenSubType,
      'str',
      BuiltinTypes.STRING,
    )


    const accountInsightsSettingsType = new ObjectType({
      elemID: new ElemID('salesforce', 'AccountInsightsSettings'),
      annotations: {
        [METADATA_TYPE]: 'AccountInsightsSettings',
        [INTERNAL_ID_ANNOTATION]: 'aaa',
      },
      annotationRefsOrTypes: {
        [INTERNAL_ID_ANNOTATION]: BuiltinTypes.HIDDEN_STRING,
      },
      path: ['salesforce', 'Types', 'AccountInsightsSettings'],
    })

    const queueHiddenType = new ObjectType({
      elemID: new ElemID('salesforce', 'Queue'),
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
        queueSobjectWithHiddenType: new Field(
          queueSobjectHiddenSubType,
          'queueSobjectWithHiddenType',
          queueSobjectHiddenSubType,
          {},
        ),
        numHidden: new Field(
          queueSobjectHiddenSubType,
          'numHidden',
          BuiltinTypes.NUMBER,
          {
            [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          },
        ),
        boolNotHidden: new Field(
          queueSobjectHiddenSubType,
          'boolNotHidden',
          BuiltinTypes.BOOLEAN,
        ),
        objWithHiddenAnno: new Field(
          queueSobjectHiddenSubType,
          'objWithHiddenAnno',
          objFieldWithHiddenAnnotationType,
          {
            hiddenStrAnno: 'bbb',
          }
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
        queueSobjectWithHiddenType: {
          str: 'text2',
        },
        numHidden: 123,
        boolNotHidden: false,
        objWithHiddenAnno: { aaa: 23 },
      },
      ['Records', 'Queue', 'queueInstance'],
    )

    const queueHiddenInstance = new InstanceElement(
      'queueHiddenInstance',
      queueHiddenType,
      {
        queueSobjectHidden: {
          str: 'hidden',
        },
        queueSobjectWithHiddenType: {
          str: 'hidden2',
        },
        numHidden: 123,
        boolNotHidden: false,
        objWithHiddenAnno: { aaa: 23 },
      },
      ['Records', 'Queue', 'queueInstance'],
      {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      }
    )

    const differentCaseQueue = new InstanceElement(
      'QueueInstance',
      queueHiddenType,
      queueInstance.value,
      ['Records', 'Queue', 'QueueInstance'],
    )

    const objectWithNestedHidden = new ObjectType({
      elemID: new ElemID('salesforce', 'ObjWithNestedHidden'),
    })

    const renamedTypes = {
      before: new ObjectType({ elemID: new ElemID('salesforce', 'RenamedType1') }),
      after: new ObjectType({ elemID: new ElemID('salesforce', 'RenamedType2'), path: ['renamed_type'] }),
    }

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
      { // add field
        id: new ElemID('salesforce', 'lead', 'field', 'new_field'),
        action: 'add',
        data: { after: new Field(
          fieldsParent,
          'new_field',
          BuiltinTypes.NUMBER,
        ) },
      },
      { // add hidden field
        id: new ElemID('salesforce', 'ObjWithNestedHidden', 'field', 'new_field'),
        action: 'add',
        data: { after: new Field(
          objectWithNestedHidden,
          'new_field',
          BuiltinTypes.NUMBER,
          { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
        ) },
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
        data: { after: createRefToElmWithValue(BuiltinTypes.STRING) },
      },
      { // new annotation type to a type with no annotation types block
        path: ['file'],
        id: new ElemID('salesforce', 'lead', 'annotation', 'newAnnoType2'),
        action: 'add',
        data: { after: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      },
      { // new hidden annotation type
        path: ['file'],
        id: new ElemID('salesforce', 'lead', 'annotation', 'newHiddenAnno'),
        action: 'add',
        data: { after: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING) },
      },
      { // new annotation type to a type with annotation types block
        path: ['file'],
        id: new ElemID('salesforce', 'WithAnnotationsBlock', 'annotation', 'secondAnnotation'),
        action: 'add',
        data: { after: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      },
      { // new annotation type to a type with no annotation types block without path
        id: new ElemID('salesforce', 'WithoutAnnotationsBlock', 'annotation', 'newAnnoType1'),
        action: 'add',
        data: { after: createRefToElmWithValue(BuiltinTypes.STRING) },
      },
      { // new annotation type to a type with no annotation types block without path
        id: new ElemID('salesforce', 'WithoutAnnotationsBlock', 'annotation', 'newAnnoType2'),
        action: 'add',
        data: { after: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      },
      { // new annotation value with new hidden annotation type
        id: new ElemID('salesforce', 'lead', 'attr', 'newHiddenAnno'),
        action: 'add',
        data: { after: 'foo' },
      },
      { // new annotation value to existing non-hidden annotation type
        id: new ElemID('salesforce', 'lead', 'attr', 'visibleAnno'),
        action: 'add',
        data: { after: 'foo' },
      },
      { // new Hidden type (should be removed)
        id: new ElemID('salesforce', 'Queue'),
        action: 'add',
        data: {
          after: queueHiddenType,
        },
      },
      { // new Hidden instance
        id: new ElemID('salesforce', 'Queue', 'instance', 'queueHiddenInstance'),
        action: 'add',
        data: {
          after: queueHiddenInstance,
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
      { // change in a hidden annotation
        id: new ElemID('salesforce', 'ObjWithHidden', 'attr', 'internalId'),
        action: 'add',
        data: { after: 'internal ID' },
      },
      { // new instance
        id: new ElemID('salesforce', 'Queue', 'instance', 'queueInstance'),
        action: 'add',
        data: {
          after: queueInstance,
        },
      },
      { // new instance with a similar name
        id: differentCaseQueue.elemID,
        action: 'add',
        data: {
          after: differentCaseQueue,
        },
      },
      { // Hidden field change to visible
        id: new ElemID('salesforce', 'ObjWithHidden', 'field', 'hide', CORE_ANNOTATIONS.HIDDEN),
        action: 'modify',
        data: { before: true, after: false },
      },
      { // Hidden value field change to visible
        id: new ElemID('salesforce', 'ObjWithHidden', 'field', 'hide_val', CORE_ANNOTATIONS.HIDDEN_VALUE),
        action: 'modify',
        data: { before: true, after: false },
      },
      { // Hidden value annotation change to visible
        id: new ElemID('salesforce', 'HiddenToVisibleVal', 'attr', CORE_ANNOTATIONS.HIDDEN_VALUE),
        action: 'modify',
        data: { before: true, after: false },
      },
      { // Visible field change to hidden
        id: new ElemID('salesforce', 'ObjWithHidden', 'field', 'visible', CORE_ANNOTATIONS.HIDDEN_VALUE),
        action: 'add',
        data: { after: true },
      },
      { // Change to field value as it becomes visible
        id: new ElemID('salesforce', 'ObjWithHidden', 'instance', 'instWithHidden', 'hide'),
        action: 'add',
        data: { after: 'changed' },
      },
      { // Change to field value as it becomes visible
        id: new ElemID('salesforce', 'ObjWithHidden', 'instance', 'instWithHidden', 'hide_val'),
        action: 'add',
        data: { after: 'changed2' },
      },
      { // Change to nested field value as it becomes visible
        id: new ElemID('salesforce', 'ObjWithDoublyNestedHidden', 'instance', 'instWithDoublyNestedHidden', 'doubleNest', 'nested', 'hide'),
        action: 'add',
        data: { after: 'changed d' },
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
      { // Change where only part of the value is visible
        id: new ElemID('salesforce', 'ObjWithNestedHidden', 'instance', 'instWithNestedHidden', 'new_field'),
        action: 'add',
        data: { after: 424 },
      },
      { // Change inside a hidden complex field
        id: new ElemID('salesforce', 'ObjWithComplexHidden', 'instance', 'instWithComplexHidden', 'nested', 'other'),
        action: 'modify',
        data: { before: 3, after: 4 },
      },
      { // Change inside a complex field (visible)
        id: new ElemID('salesforce', 'ObjWithNestedHidden', 'instance', 'instWithNestedHidden', 'nested_visible', 'visible'),
        action: 'modify',
        data: { before: 111, after: 43 },
      },
      { // Change inside a complex field (hidden)
        id: new ElemID('salesforce', 'ObjWithNestedHidden', 'instance', 'instWithNestedHidden', 'nested_visible', 'hide'),
        action: 'add',
        data: { after: 'abc' },
      },
      { // Change inside an annotation with hidden value
        id: new ElemID('salesforce', 'NestedHiddenVal', 'attr', 'hidden_val_anno'),
        action: 'add',
        data: { after: {
          something: 's',
          somethingElse: 34,
        } },
      },
      { // Change inside an annotation that became visible
        id: new ElemID('salesforce', 'NestedHiddenVal', 'attr', 'hidden_to_visible_anno'),
        action: 'add',
        data: { after: {
          something: 't',
          somethingElse: 35,
        } },
      },
      { // Add and remove a top level element in the same file
        id: renamedTypes.before.elemID,
        action: 'remove',
        data: { before: renamedTypes.before },
      },
      {
        id: renamedTypes.after.elemID,
        action: 'add',
        data: { after: renamedTypes.after },
      },
      {
        id: new ElemID('salesforce', 'WithoutAnnotationsBlock', 'attr', 'bla'),
        action: 'add',
        data: { after: 5 },
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
    let instWithDoublyNestedHidden: InstanceElement

    let lead: ObjectType
    let elemMap: Record<string, Element>
    let elemMapWithHidden: Record<string, Element>
    let workspace: Workspace
    const dirStore = mockDirStore()

    beforeAll(async () => {
      const helperWorkspace = await createWorkspace(dirStore, createState([]))
      // We assume the state is synced with the workspace elements before we make changes
      // We also assume the state elements are updated before we call updateNaclFiles so that hidden
      // values can be taken from the state
      // The call to resolve is the only safe way to clone elements while keeping all
      // the inner references between elements correct, we then apply all the changes to the copied
      // elements and set them along with the hidden types as the state elements
      const stateElements = await awu(
        await resolve(
          await awu(await (await helperWorkspace.elements()).getAll()).toArray(),
          await helperWorkspace.elements()
        )
      ).toArray()
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
      const state = createState([
        ...Object.values(BuiltinTypes),
        ...stateElements,
        accountInsightsSettingsType,
        queueHiddenType,
        queueHiddenInstance,
        queueSobjectHiddenSubType,
        // objectWithNestedHidden
      ])

      workspace = await createWorkspace(dirStore, state)

      clonedChanges = _.cloneDeep(changes)
      await workspace.updateNaclFiles(clonedChanges)
      elemMap = await getElemMap(await workspace.elements(false))
      elemMapWithHidden = await getElemMap(await workspace.elements())
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
      instWithDoublyNestedHidden = elemMap[
        'salesforce.ObjWithDoublyNestedHidden.instance.instWithDoublyNestedHidden'
      ] as InstanceElement
    })

    it('should not cause parse errors', async () => {
      expect((await workspace.errors()).parse).toHaveLength(0)
    })
    it('should modify existing element', () => {
      expect(lead).toBeDefined()
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('foo')
      expect(lead.fields.new_field).toBeDefined()
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
      expect(lead.annotationRefTypes).toHaveProperty('newAnnoType1')
      expect(lead.annotationRefTypes.newAnnoType1.elemID).toEqual(BuiltinTypes.STRING.elemID)
      expect(lead.annotationRefTypes).toHaveProperty('newAnnoType2')
      expect(lead.annotationRefTypes.newAnnoType2.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
      expect(lead.annotationRefTypes).toHaveProperty('newHiddenAnno')
      expect(lead.annotationRefTypes.newHiddenAnno.elemID)
        .toEqual(BuiltinTypes.HIDDEN_STRING.elemID)
    })
    it('should add visible values', () => {
      expect(lead.annotations).toHaveProperty('visibleAnno')
      expect(instWithNestedHidden.value.nested_visible.visible).toEqual(43)
      const nestedHiddenVal = elemMap['salesforce.NestedHiddenVal'] as ObjectType
      expect(nestedHiddenVal.annotations.hidden_to_visible_anno.something).toEqual('t')
    })
    it('should not add hidden annotation value on new annotation type', () => {
      expect(lead.annotations).not.toHaveProperty('newHiddenAnno')
    })
    it('should not add hidden annotation value on existing annotation type', () => {
      const objWithHidden = elemMap['salesforce.ObjWithHidden'] as ObjectType
      expect(objWithHidden.annotations).not.toHaveProperty('internalId')
      const nestedHiddenVal = elemMap['salesforce.NestedHiddenVal'] as ObjectType
      expect(nestedHiddenVal.annotationRefTypes).toHaveProperty('hidden_val_anno')
      expect(nestedHiddenVal.annotations).not.toHaveProperty('hidden_val_anno')
    })
    it('should include hidden annotation value when fetching with hidden', () => {
      const leadWithHidden = elemMapWithHidden['salesforce.lead'] as ObjectType
      expect(leadWithHidden.annotations).toHaveProperty('newHiddenAnno')
      const objWithHidden = elemMapWithHidden['salesforce.ObjWithHidden'] as ObjectType
      expect(objWithHidden.annotations).toHaveProperty('internalId')
      const nestedHiddenVal = elemMapWithHidden['salesforce.NestedHiddenVal'] as ObjectType
      expect(nestedHiddenVal.annotations).toHaveProperty('hidden_val_anno')
    })

    it('should change instance type if type was modified', () => {
      const changedType = elemMapWithHidden['salesforce.WithoutAnnotationsBlock'] as ObjectType
      const changedInstance = elemMapWithHidden['salesforce.WithoutAnnotationsBlock.instance.instWithoutAnnotationsBlock'] as InstanceElement
      expect(changedInstance.refType.elemID.isEqual(changedType.elemID)).toBeTruthy()
    })

    it('should change inner type inside containers types if type was changed', async () => {
      const changedType = elemMapWithHidden['salesforce.WithoutAnnotationsBlock'] as ObjectType
      const changedInstance = elemMapWithHidden['salesforce.WithoutAnnotationsBlockListNested'] as ObjectType
      expect((await changedInstance.fields.noAnno
        .getType(await workspace.elements()) as ContainerType)
        .refInnerType.elemID.isEqual(changedType.elemID)).toBeTruthy()
    })
    it('should add annotation type to the existing annotations block with path hint', () => {
      const objWithAnnotationsBlock = elemMap['salesforce.WithAnnotationsBlock'] as ObjectType
      expect(objWithAnnotationsBlock.annotationRefTypes).toHaveProperty('firstAnnotation')
      expect(objWithAnnotationsBlock.annotationRefTypes.firstAnnotation.elemID)
        .toEqual(BuiltinTypes.STRING.elemID)
      expect(objWithAnnotationsBlock.annotationRefTypes).toHaveProperty('secondAnnotation')
      expect(objWithAnnotationsBlock.annotationRefTypes.secondAnnotation.elemID)
        .toEqual(BuiltinTypes.NUMBER.elemID)
    })
    it('should add annotation type to the existing annotations block without path hint', () => {
      const objWithoutAnnoBlock = elemMap['salesforce.WithoutAnnotationsBlock'] as ObjectType
      expect(objWithoutAnnoBlock.annotationRefTypes).toHaveProperty('newAnnoType1')
      expect(objWithoutAnnoBlock.annotationRefTypes.newAnnoType1.elemID)
        .toEqual(BuiltinTypes.STRING.elemID)
      expect(objWithoutAnnoBlock.annotationRefTypes).toHaveProperty('newAnnoType2')
      expect(objWithoutAnnoBlock.annotationRefTypes.newAnnoType2.elemID)
        .toEqual(BuiltinTypes.NUMBER.elemID)
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
      expect(lead.fields.not_a_list_yet_field.refType.elemID.getFullName()).toContain('List<')
      // expect(isListType(lead.fields.not_a_list_yet_field.getType())).toBeTruthy()
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

    it('should add the type that change from hidden to not hidden, excluding hidden annotations', () => {
      expect(typeBecameNotHidden).toBeDefined()
      expect(typeBecameNotHidden.annotations).toEqual(_.omit(
        accountInsightsSettingsType.annotations, 'internalId',
      ))
    })

    it('should remove the type that became to be hidden', () => {
      expect(typeBecameHidden).toBeUndefined()
    })

    it('should keep the hidden annotation hidden', () => {
      expect(typeBecameNotHidden.annotations[INTERNAL_ID_ANNOTATION]).toBeUndefined()
    })

    it('should add new instance without hidden fields values', () => {
      expect(newInstance).toBeDefined()
      expect(newInstance).not.toEqual(queueInstance)

      // Hidden fields values should be undefined
      expect(newInstance.value.numHidden).toBeUndefined()

      // Not hidden fields values should be defined
      expect(newInstance.value.queueSobjectHidden).toBeDefined() // field is hidden but value isn't
      expect(newInstance.value.queueSobjectWithHiddenType).toBeDefined()
      expect(newInstance.value.boolNotHidden).toEqual(false)
      expect(newInstance.value.objWithHiddenAnno).toEqual({ aaa: 23 })
    })

    it('should add different cased elements to the same file', () => {
      expect(dirStore.set).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'Records/Queue/QueueInstance.nacl',
        buffer: expect.stringMatching(/.*salesforce.Queue QueueInstance.*salesforce.Queue queueInstance.*/s),
      }))
    })

    it('should not add changes in hidden values', () => {
      expect(instWithComplexHidden.value).not.toHaveProperty('nested')
      expect(instWithNestedHidden.value.nested_visible).not.toHaveProperty('hide')
      expect(instWithNestedHidden.value).not.toHaveProperty('new_field')
    })

    it('should remove values of fields that became hidden_value', () => {
      expect(instWithHidden.value).not.toHaveProperty('visible')
      expect(instWithNestedHidden.value.nested).not.toHaveProperty('visible')
      expect(instWithDoublyNestedHidden.value.singleNest).not.toHaveProperty('visible')
      expect(instWithDoublyNestedHidden.value.doubleNest.nested).not.toHaveProperty('visible')
    })

    it('should add values that became visible', () => {
      expect(instWithHidden.value.hide).toEqual('changed')
      expect(instWithHidden.value.hide_val).toEqual('changed2')
      expect(instWithNestedHidden.value.nested.hide).toEqual('a')
      expect(instWithDoublyNestedHidden.value.doubleNest.nested.hide).toEqual('changed d')
    })

    it('should update file correctly when elements are removed and added in the same file', () => {
      expect(elemMap).not.toHaveProperty(renamedTypes.before.elemID.getFullName())
      const addedElement = elemMap[renamedTypes.after.elemID.getFullName()]
      expect(addedElement).toMatchObject(_.omit(renamedTypes.after, 'path'))
      expect(dirStore.set).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'renamed_type.nacl',
        buffer: expect.stringMatching(/^\s*type salesforce.RenamedType2 {\s*}\s*$/),
      }))
    })

    it('should get a single hidden element correctly', async () => {
      const leadWithHidden = await workspace.getValue(new ElemID('salesforce', 'lead')) as ObjectType
      expect(leadWithHidden).toBeDefined()
      expect(leadWithHidden.annotations).toHaveProperty('newHiddenAnno')
    })

    it('should return undefined if element does not exist', async () => {
      const leadWithHidden = await workspace.getValue(new ElemID('dummy', 'notExist')) as ObjectType
      expect(leadWithHidden).not.toBeDefined()
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
      lead = findElement(
        await awu(await (await workspace.elements()).getAll()).toArray(),
        new ElemID('salesforce', 'lead')
      ) as ObjectType
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('blabla')
    })

    it('should hide hidden instance elements', () => {
      expect(elemMap['salesforce.Queue.instance.queueHiddenInstance']).toBeUndefined()
    })
  })

  describe('init', () => {
    const workspaceConf = mockWorkspaceConfigSource({ name: 'ws-name' })
    afterEach(async () => {
      delete process.env.SALTO_HOME
    })
    it('should init workspace configuration', async () => {
      const workspace = await initWorkspace(
        'ws-name',
        'uid',
        'default',
        workspaceConf,
        mockCredentialsSource(),
        {
          commonSourceName: '',
          sources: {
            default: {
              naclFiles: createMockNaclFileSource([]),
              state: createState([]),
            },
            '': {
              naclFiles: createMockNaclFileSource([]),
              state: createState([]),
            },
          },
        },
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
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
    const mapFlushCounter: Record<string, number> = {}
    const mapCreator = persistentMockCreateRemoteMap()
    const mapCreatorWrapper = async (
      params: CreateRemoteMapParams<Value>
    ): Promise<RemoteMap<Value>> => {
      const m = await mapCreator(params)
      return {
        ...m,
        flush: async () => {
          await m.flush()
          mapFlushCounter[params.namespace] = (mapFlushCounter[params.namespace] ?? 0) + 1
        },
      } as unknown as RemoteMap<Value>
    }
    it('should flush all data sources', async () => {
      const mockFlush = jest.fn()
      const flushable = {
        flush: mockFlush,
        list: jest.fn().mockResolvedValue([]),
        getAll: jest.fn().mockResolvedValue([]),
      }
      const workspace = await createWorkspace(flushable as unknown as DirectoryStore<string>,
        flushable as unknown as State, undefined, undefined, undefined,
        undefined, mapCreatorWrapper as RemoteMapCreator)
      await workspace.flush()
      expect(mockFlush).toHaveBeenCalledTimes(2)
      expect(mapFlushCounter['workspace-default-merged']).toEqual(1)
      expect(mapFlushCounter['workspace-default-errors']).toEqual(1)
      expect(mapFlushCounter['workspace-default-searchableNamesIndex']).toEqual(1)
      expect(mapFlushCounter['workspace-default-validationErrors']).toEqual(1)
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
          '': { naclFiles: createMockNaclFileSource([]) },
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
      const defaultElemIDs = await awu(await (await workspace.elements()).getAll())
        .map(e => e.elemID.getFullName()).toArray()
      expect(defaultElemIDs).toHaveLength(0)
      await workspace.setCurrentEnv('inactive')
      const inactiveElemIDs = await awu(await (await workspace.elements()).getAll())
        .map(e => e.elemID.getFullName()).toArray()
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
        workspace = await createWorkspace(
          undefined,
          undefined,
          workspaceConf,
          credSource,
          undefined,
          {
            inactive: { naclFiles, state },
            '': { naclFiles: createMockNaclFileSource([]) },
            default: { naclFiles: createMockNaclFileSource([]), state: createState([]) },
          }
        )
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
            undefined, { [envName]: { naclFiles, state }, '': { naclFiles: createMockNaclFileSource([]) } })
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
            undefined, {
              [envName]: { naclFiles, state },
              '': { naclFiles: createMockNaclFileSource([]) },
              default: { naclFiles: createMockNaclFileSource([]), state: createState([]) },
            })
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

  describe('references', () => {
    const defFile = `
      type salesforce.lead {

      }
    `

    const usedAsInstType = `
      salesforce.lead inst {
        key = "value"
      }
    `

    const usedAsField = `
      type salesforce.leader {
        salesforce.lead lead {
          
        }
      }
    `

    const usedAsInnerFieldType = `
    type salesforce.leaders {
      "List<salesforce.lead>" lead {
      }
    }
  `

    const usedAsReference = `
      type salesforce.stam {
        annotations {
          string key {
          }
        }
        key = salesforce.lead
      }
    `

    const usedAsNestedReference = `
      type salesforce.stam2 {
        annotations {
          string key {
          }
        }
        key = salesforce.lead.attr.key
      }
    `

    const usedInUnmerged = `
      type salesforce.unmerged {
        annotations {
          string key {
          }
        }
        whatami = salesforce.lead.attr.key
      }
    `
    const files = {
      'defFile.nacl': defFile,
      'usedAsInstType.nacl': usedAsInstType,
      'usedAsField.nacl': usedAsField,
      'usedAsInnerFieldType.nacl': usedAsInnerFieldType,
      'usedAsReference.nacl': usedAsReference,
      'usedAsNestedReference.nacl': usedAsNestedReference,
      'unmerged.nacl': usedInUnmerged,
    }

    describe('getElementReferencedFiles', () => {
      let workspace: Workspace
      let referencedFiles: string[]
      const naclFileStore = mockDirStore(undefined, undefined, files)

      beforeAll(async () => {
        workspace = await createWorkspace(naclFileStore)
        referencedFiles = await workspace
          .getElementReferencedFiles(ElemID.fromFullName('salesforce.lead'))
      })

      it('should find files in which the id is used as an instance type', () => {
        expect(referencedFiles).toContain('usedAsInstType.nacl')
      })

      it('should find files in which the id is used as an field type', () => {
        expect(referencedFiles).toContain('usedAsField.nacl')
      })

      it('should find files in which the id is used as an inner field type', () => {
        expect(referencedFiles).toContain('usedAsInnerFieldType.nacl')
      })

      it('should find files in which the id is used as reference', () => {
        expect(referencedFiles).toContain('usedAsReference.nacl')
      })

      it('should find files in which the id is used as nested reference', () => {
        expect(referencedFiles).toContain('usedAsNestedReference.nacl')
      })

      it('should find nested attr referenced', async () => {
        const attrRefFiles = await workspace
          .getElementReferencedFiles(ElemID.fromFullName('salesforce.lead.attr.key'))
        expect(attrRefFiles).toContain('usedAsNestedReference.nacl')
      })

      it('should find referenced in values of with no matching field in the type', async () => {
        const attrRefFiles = await workspace
          .getElementReferencedFiles(ElemID.fromFullName('salesforce.lead.attr.key'))
        expect(attrRefFiles).toContain('unmerged.nacl')
      })
    })
  })

  describe('hasElementsInEnv', () => {
    let workspace: Workspace
    beforeEach(async () => {
      const staticFilesSource = mockStaticFilesSource()
      const remoteMapCreator = persistentMockCreateRemoteMap()
      workspace = await createWorkspace(
        undefined,
        undefined,
        {
          getWorkspaceConfig: jest.fn().mockImplementation(() => ({
            envs: [
              { name: 'default', services: ['test'] },
              { name: 'full', services: ['test'] },
            ],
            uid: '',
            name: 'test',
            currentEnv: 'full',
          })),
          setWorkspaceConfig: jest.fn(),
          getAdapter: jest.fn(),
          setAdapter: jest.fn(),
        },
        undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              '',
              mockDirStore(),
              staticFilesSource,
              remoteMapCreator,
            ),
          },
          empty: {
            naclFiles: createMockNaclFileSource([]),
            state: createState([]),
          },
          full: {
            naclFiles: createMockNaclFileSource([new ObjectType({ elemID: new ElemID('test', 'type') })]),
            state: createState([]),
          },
        }
      )
    })
    it('should return false for empty env', async () => {
      await expect(workspace.hasElementsInEnv('empty')).resolves.toBeFalsy()
    })
    it('should return true for non empty env', async () => {
      await expect(workspace.hasElementsInEnv('full')).resolves.toBeTruthy()
    })
    it('should return false for environments that do no exist', async () => {
      await expect(workspace.hasElementsInEnv('noSuchEnv')).resolves.toBeFalsy()
    })
  })

  describe('envOfFile', () => {
    let workspace: Workspace
    beforeEach(async () => {
      const staticFilesSource = mockStaticFilesSource()
      const remoteMapCreator = persistentMockCreateRemoteMap()
      workspace = await createWorkspace(
        undefined, undefined, undefined, undefined, undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              '',
              mockDirStore(),
              staticFilesSource,
              remoteMapCreator,
            ),
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
      )
    })
    it('should return the correct env if the file belongs to the current env', () => {
      expect(workspace.envOfFile('envs/default/test.nacl')).toEqual('default')
    })
    it('should return the correct env if the file belongs to the common env', () => {
      expect(workspace.envOfFile('test.nacl')).toEqual(COMMON_ENV_PREFIX)
    })
    it('should return the correct env if the file belongs to an inactive env', () => {
      expect(workspace.envOfFile('envs/inactive/test.nacl')).toEqual('inactive')
    })
  })

  describe('iterative validation errors', () => {
    const primFile = `
        type salto.prim is number {

        }
      `

    const baseFile = `
        type salto.base {
          string str {

          }
          salto.prim num {

          }
        }
      `

    const objFile = `
        type salto.obj {
          salto.base baseField {

          }
        }
      `

    const instFile = `
        salto.obj objInst {
          baseField = {
            str = "STR"
            num = 12
          }
        }
      `

    const inst2updateFile = `
      salto.obj objInstToupdate {
        baseField = {
          num = 12
          str = "STR"
        }
      }
    `

    const refFile = `
        salto.base baseInst {
          str = salto.obj.instance.objInst.baseField.str
        }
      `

    const refFile2 = `
        salto.base baseInst2 {
          str = salto.base.instance.baseInst.str
        }
      `

    const startsAsErr = `
        salto.base willBeFixed {
          str = "STR",
          num = "This will be string"
        }
      `

    const willRemainErr = `
        salto.base willRemain {
          str = "STR",
          num = false
        }
      `

    const files = {
      primFile,
      baseFile,
      objFile,
      instFile,
      refFile,
      refFile2,
      inst2updateFile,
      startsAsErr,
      willRemainErr,
    }


    let workspace: Workspace
    const naclFileStore = mockDirStore(undefined, undefined, files)
    const primElemID = new ElemID('salto', 'prim')
    const changes = [
      {
        id: new ElemID('salto', 'obj', 'instance', 'objInst', 'baseField', 'str'),
        action: 'remove',
        data: { before: 'STR' },
      },
      {
        id: new ElemID('salto', 'obj', 'instance', 'objInstToupdate', 'baseField', 'str'),
        action: 'modify',
        data: { before: 'STR', after: 12 },
      },
      {
        id: primElemID,
        action: 'modify',
        data: {
          before: new PrimitiveType({ elemID: primElemID, primitive: PrimitiveTypes.NUMBER }),
          after: new PrimitiveType({ elemID: primElemID, primitive: PrimitiveTypes.STRING }),
        },
      },

    ] as DetailedChange[]

    let validationErrs: ReadonlyArray<ValidationError>

    beforeAll(async () => {
      workspace = await createWorkspace(naclFileStore)
      // Verify that the two errors we are starting with (that should be deleted in the update
      // since the update resolves them ) are present. This check will help debug situations in
      // which the entier flow is broken and errors are not created at all...
      expect((await workspace.errors()).validation).toHaveLength(2)
      await workspace.updateNaclFiles(changes)
      validationErrs = (await workspace.errors()).validation
    })

    it('create validation errors in the updated elements', () => {
      const objInstToupdateErr = validationErrs.find(
        err => err.elemID.getFullName() === 'salto.obj.instance.objInstToupdate.baseField.str'
      )

      expect(objInstToupdateErr).toBeDefined()
      expect(objInstToupdateErr?.message).toContain('Invalid value type for string')
    })
    it('create validation errors where the updated elements are used as value type', () => {
      const usedAsTypeErr = validationErrs.find(
        err => err.elemID.getFullName() === 'salto.obj.instance.objInst.baseField.num'
      )

      expect(usedAsTypeErr).toBeDefined()
      expect(usedAsTypeErr?.message).toContain('Invalid value type for salto.prim')
    })
    it('create validation errors where the updated elements are used as references', () => {
      const usedAsReference = validationErrs.find(
        err => err.elemID.getFullName() === 'salto.base.instance.baseInst.str'
      )

      expect(usedAsReference).toBeDefined()
      expect(usedAsReference?.message).toContain('unresolved reference')
    })
    it('create validation errors in chained references', () => {
      const usedAsChainedReference = validationErrs.find(
        err => err.elemID.getFullName() === 'salto.base.instance.baseInst2.str'
      )

      expect(usedAsChainedReference).toBeDefined()
      expect(usedAsChainedReference?.message).toContain('unresolved reference')
    })

    it('should not modify errors which were not effected by this update', () => {
      const usedAsChainedReference = validationErrs.find(
        err => err.elemID.getFullName() === 'salto.base.instance.willRemain.num'
      )

      expect(usedAsChainedReference).toBeDefined()
    })

    it('should remove errors that were resolved in the update', () => {
      const usedAsChainedReference = validationErrs.find(
        err => err.elemID.getFullName() === 'salto.base.instance.willBeFixed.num'
      )

      expect(usedAsChainedReference).not.toBeDefined()
    })
  })
})

describe('getElementNaclFiles', () => {
  let workspace: Workspace
  const firstFile = `
    type salesforce.text is string {}
    type salesforce.lead {
      salesforce.text singleDef {

      }
      salesforce.text multiDef {

      }
    }
  `
  const secondFile = `
    type salesforce.lead {
      salesforce.text multiDef {

      }
    }
  `

  const redHeringFile = `
    type salesforce.hearing {
      salesforce.text multiDef {

      }
    }
  `
  const naclFileStore = mockDirStore(undefined, undefined, {
    'firstFile.nacl': firstFile,
    'secondFile.nacl': secondFile,
    'redHeringFile.nacl': redHeringFile,
  })

  beforeAll(async () => {
    workspace = await createWorkspace(naclFileStore)
  })
  it('should find all files for a top level id', async () => {
    const id = ElemID.fromFullName('salesforce.lead')
    const res = await workspace.getElementNaclFiles(id)
    expect(res).toContain('secondFile.nacl')
    expect(res).toContain('firstFile.nacl')
  })

  it('should find all files with a nested level id that apears in multiple files', async () => {
    const id = ElemID.fromFullName('salesforce.lead.field.multiDef')
    const res = await workspace.getElementNaclFiles(id)
    expect(res).toContain('secondFile.nacl')
    expect(res).toContain('firstFile.nacl')
  })

  it('should find only files with the nested id', async () => {
    const id = ElemID.fromFullName('salesforce.lead.field.singleDef')
    const res = await workspace.getElementNaclFiles(id)
    expect(res).toContain('firstFile.nacl')
    expect(res).not.toContain('secondFile.nacl')
  })
})
