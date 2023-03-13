/*
*                      Copyright 2023 Salto Labs Ltd.
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
  isObjectType, ContainerType, Change, AdditionChange, getChangeData, PrimitiveType,
  Value, TypeReference, INSTANCE_ANNOTATIONS, ReferenceExpression, createRefToElmWithValue,
  SaltoError,
  StaticFile,
  isStaticFile,
} from '@salto-io/adapter-api'
import { findElement, applyDetailedChanges } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { InvalidValueValidationError, ValidationError } from '../../src/validator'
import { WorkspaceConfigSource } from '../../src/workspace/workspace_config_source'
import { ConfigSource } from '../../src/workspace/config_source'
import { naclFilesSource, NaclFilesSource, ChangeSet } from '../../src/workspace/nacl_files'
import { State, buildInMemState } from '../../src/workspace/state'
import { createMockNaclFileSource } from '../common/nacl_file_source'
import { mockStaticFilesSource, persistentMockCreateRemoteMap } from '../utils'
import { DirectoryStore } from '../../src/workspace/dir_store'
import { Workspace, initWorkspace, loadWorkspace, EnvironmentSource,
  COMMON_ENV_PREFIX, UnresolvedElemIDs, UpdateNaclFilesResult, isValidEnvName } from '../../src/workspace/workspace'
import { DeleteCurrentEnvError, UnknownEnvError, EnvDuplicationError,
  AccountDuplicationError, InvalidEnvNameError, Errors, MAX_ENV_NAME_LEN, UnknownAccountError, InvalidAccountNameError } from '../../src/workspace/errors'
import { StaticFilesSource, MissingStaticFile } from '../../src/workspace/static_files'
import * as dump from '../../src/parser/dump'
import { mockDirStore } from '../common/nacl_file_store'
import { EnvConfig } from '../../src/workspace/config/workspace_config_types'
import { resolve } from '../../src/expressions'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { InMemoryRemoteMap, RemoteMapCreator, RemoteMap, CreateRemoteMapParams } from '../../src/workspace/remote_map'
import { Path } from '../../src/workspace/path_index'
import { mockState } from '../common/state'
import * as multiEnvSrcLib from '../../src/workspace/nacl_files/multi_env/multi_env_source'
import { AdaptersConfigSource } from '../../src/workspace/adapters_config_source'
import { createElementSelector } from '../../src/workspace/element_selector'
import * as expressionsModule from '../../src/expressions'

const { awu } = collections.asynciterable

const METADATA_TYPE = 'metadataType'
const INTERNAL_ID_ANNOTATION = 'internalId'

const changedNaclFile = {
  filename: 'file.nacl',
  buffer: `type salesforce.lead {
    salesforce.text new_base {}
  }`,
}
const changedConfFile = {
  filename: 'salto.config/adapters/salesforce.nacl',
  buffer: `salesforce {
    a = 2
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

const mockWorkspaceConfigSource = (conf?: Values,
  secondaryEnv?: boolean): WorkspaceConfigSource => ({
  getWorkspaceConfig: jest.fn().mockImplementation(() => ({
    envs: [
      { name: 'default',
        accounts: services,
        accountToServiceName: Object.fromEntries(services.map(service => [service, service])) },
      ...(secondaryEnv ? [{ name: 'inactive',
        accounts: [...services, 'netsuite'],
        accountToServiceName: { netsuite: 'netsuite',
          ...Object.fromEntries(services.map(service => [service, service])) } }] : []),
    ],
    uid: '',
    name: 'test',
    currentEnv: 'default',
    ...conf,
  })),
  setWorkspaceConfig: jest.fn(),
})

const mockAdaptersConfigSource = (): MockInterface<AdaptersConfigSource> => ({
  getAdapter: mockFunction<AdaptersConfigSource['getAdapter']>(),
  setAdapter: mockFunction<AdaptersConfigSource['setAdapter']>(),
  getElementNaclFiles: mockFunction<AdaptersConfigSource['getElementNaclFiles']>(),
  getErrors: mockFunction<AdaptersConfigSource['getErrors']>().mockResolvedValue(new Errors({
    parse: [],
    validation: [],
    merge: [],
  })),
  getSourceRanges: mockFunction<AdaptersConfigSource['getSourceRanges']>().mockResolvedValue([]),
  getNaclFile: mockFunction<AdaptersConfigSource['getNaclFile']>(),
  setNaclFiles: mockFunction<AdaptersConfigSource['setNaclFiles']>(),
  flush: mockFunction<AdaptersConfigSource['flush']>(),
  getElements: mockFunction<AdaptersConfigSource['getElements']>(),
  getParsedNaclFile: mockFunction<AdaptersConfigSource['getParsedNaclFile']>(),
  getSourceMap: mockFunction<AdaptersConfigSource['getSourceMap']>(),
  listNaclFiles: mockFunction<AdaptersConfigSource['listNaclFiles']>(),
  isConfigFile: mockFunction<AdaptersConfigSource['isConfigFile']>(),
})

const mockCredentialsSource = (): ConfigSource => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  rename: jest.fn(),
})

const createState = (
  elements: Element[],
  persistent = true
): State => buildInMemState(async () => ({
  elements: createInMemoryElementSource(elements),
  pathIndex: new InMemoryRemoteMap<Path[]>(),
  referenceSources: new InMemoryRemoteMap(),
  accountsUpdateDate: new InMemoryRemoteMap(),
  changedBy: new InMemoryRemoteMap([{ key: 'name@@account', value: ['elemId'] }]),
  saltoMetadata: new InMemoryRemoteMap([{ key: 'version', value: '0.0.1' }]),
  staticFilesSource: mockStaticFilesSource(),
}), persistent)
const createWorkspace = async (
  dirStore?: DirectoryStore<string>,
  state?: State,
  configSource?: WorkspaceConfigSource,
  adaptersConfigSource?: AdaptersConfigSource,
  credentials?: ConfigSource,
  staticFilesSource?: StaticFilesSource,
  elementSources?: Record<string, EnvironmentSource>,
  remoteMapCreator?: RemoteMapCreator,
  persistent = true
): Promise<Workspace> => {
  const mapCreator = remoteMapCreator ?? persistentMockCreateRemoteMap()
  const actualStaticFilesSource = staticFilesSource || mockStaticFilesSource()
  return loadWorkspace(
    configSource || mockWorkspaceConfigSource(),
    adaptersConfigSource || mockAdaptersConfigSource(),
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
            persistent
          ),
        },
        default: {
          naclFiles: createMockNaclFileSource([]),
          state: state ?? createState([], persistent),
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
          undefined,
          undefined,
          mockWorkspaceConfigSource(undefined, true),
          undefined,
          undefined,
          undefined,
          {
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

      it('should show elements that were added to the nacl file in the current'
        + ' load on the sec env', async () => {
        const primaryEnvElemID = new ElemID('salesforce', 'primaryObj')
        const secondaryEnvElemID = new ElemID('salesforce', 'secondaryObj')
        const primaryEnvObj = new ObjectType({ elemID: primaryEnvElemID })
        const secondaryEnvObj = new ObjectType({ elemID: secondaryEnvElemID })
        const newWorkspace = await createWorkspace(
          undefined, undefined, mockWorkspaceConfigSource(undefined, true), undefined, undefined,
          undefined, {
            '': {
              naclFiles: createMockNaclFileSource([]),
            },
            default: {
              naclFiles: await naclFilesSource(
                'default',
                mockDirStore([], false, {
                  'prim.nacl': await dump.dumpElements([primaryEnvObj]),
                }),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
            inactive: {
              naclFiles: await naclFilesSource(
                'inactive',
                mockDirStore([], false, {
                  'prim.nacl': await dump.dumpElements([secondaryEnvObj]),
                }),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
          },
        )
        const currentEnvElements = await awu(await (await newWorkspace.elements()).getAll())
          .toArray()
        expect(currentEnvElements.find(e => e.elemID.isEqual(primaryEnvElemID))).toBeDefined()
        expect(currentEnvElements.find(e => e.elemID.isEqual(secondaryEnvElemID))).not.toBeDefined()
        const inactiveEnvElements = await awu(await (await newWorkspace.elements(false, 'inactive'))
          .getAll()).toArray()
        expect(inactiveEnvElements.find(e => e.elemID.isEqual(primaryEnvElemID))).not.toBeDefined()
        expect(inactiveEnvElements.find(e => e.elemID.isEqual(secondaryEnvElemID))).toBeDefined()
      })
    })
  })

  describe('getElementSourceOfPath', () => {
    let workspace: Workspace
    let adaptersConfig: MockInterface<AdaptersConfigSource>
    let mockNaclFilesSource: NaclFilesSource
    const configElemId = new ElemID('adapter', 'config')
    const envsElemId = new ElemID('adapter', 'envs')

    beforeEach(async () => {
      adaptersConfig = mockAdaptersConfigSource()
      adaptersConfig.getElements.mockReturnValue(createInMemoryElementSource([
        new ObjectType({ elemID: configElemId }),
      ]))
      mockNaclFilesSource = createMockNaclFileSource([new ObjectType({ elemID: envsElemId })])
      workspace = await createWorkspace(
        undefined,
        undefined,
        undefined,
        adaptersConfig,
        undefined,
        undefined,
        {
          '': {
            naclFiles: createMockNaclFileSource([]),
          },
          default: {
            naclFiles: mockNaclFilesSource,
            state: createState([]),
          },
        },
      )
    })

    it('when is config file should return the adapters config elements', async () => {
      adaptersConfig.isConfigFile.mockReturnValue(true)
      const ids = await awu(await (await workspace.getElementSourceOfPath('somePath')).list()).map(id => id.getFullName()).toArray()
      expect(ids).toEqual([configElemId.getFullName()])
    })

    it('when is not a config file should return the envs elements', async () => {
      adaptersConfig.isConfigFile.mockReturnValue(false)
      const ids = await awu(await (await workspace.getElementSourceOfPath('somePath')).list()).map(id => id.getFullName()).toArray()
      expect(ids).toEqual([envsElemId.getFullName()])
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
    const TOTAL_NUM_ELEMENETS = 62

    it('should return names of top level elements and fields', async () => {
      workspace = await createWorkspace()
      const searchableNames = await workspace.getSearchableNames()
      expect(searchableNames.length).toEqual(TOTAL_NUM_ELEMENETS)
    })

    it('should remove object and fields from list if removed', async () => {
      workspace = await createWorkspace()
      const accountIntSett = await workspace.getValue(new ElemID('salesforce', 'AccountIntelligenceSettings')) as ObjectType
      const searchableNames = await workspace.getSearchableNames()
      expect(searchableNames.includes(accountIntSett.elemID.getFullName())).toBeTruthy()
      const updateNaclFileResults = await workspace.updateNaclFiles([{
        id: accountIntSett.elemID,
        action: 'remove',
        data: { before: accountIntSett },
      }])
      const numOfFields = Object.values(accountIntSett.fields).length
      const searchableNamesAfter = await workspace.getSearchableNames()
      // One change in workspace, one in state.
      expect(updateNaclFileResults).toEqual({
        naclFilesChangesCount: 1,
        stateOnlyChangesCount: 1,
      })
      expect(searchableNamesAfter.length).toEqual(TOTAL_NUM_ELEMENETS - (numOfFields + 1))
      expect(searchableNamesAfter.includes(accountIntSett.elemID.getFullName())).toBeFalsy()
      Object.values(accountIntSett.fields).forEach(field => {
        expect(searchableNamesAfter.includes(field.elemID.getFullName())).toBeFalsy()
      })
    })

    it('should add object and fields to list if added', async () => {
      workspace = await createWorkspace()
      const newElemID = new ElemID('salesforce', 'new')
      const newObject = new ObjectType({
        elemID: newElemID,
        fields: { aaa: { refType: BuiltinTypes.NUMBER } },
      })
      const updateNaclFilesREsult = await workspace.updateNaclFiles([{
        id: newElemID,
        action: 'add',
        data: { after: newObject },
      }])
      expect(updateNaclFilesREsult).toEqual({
        naclFilesChangesCount: 1,
        stateOnlyChangesCount: 0,
      })
      const searchableNamesAfter = await workspace.getSearchableNames()
      expect(searchableNamesAfter.length).toEqual(TOTAL_NUM_ELEMENETS + 2)
    })
  })

  describe('getSearchableNamesOfEnv', () => {
    let workspace: Workspace

    it('should return names of top level elements and fields of desired sources', async () => {
      workspace = await createWorkspace(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          [COMMON_ENV_PREFIX]: {
            naclFiles: createMockNaclFileSource([
              new ObjectType({ elemID: new ElemID('salto', 'com') }),
            ]),
          },
          default: {
            naclFiles: createMockNaclFileSource([
              new ObjectType({
                elemID: new ElemID('salto', 'obj'),
                fields: {
                  field: {
                    refType: BuiltinTypes.NUMBER,
                  },
                },
              }),
            ]),
            state: createState([]),
          },
          inactive: {
            naclFiles: createMockNaclFileSource([]),
            state: createState([]),
          },
        },
      )
      const searchableNamesOfCommon = await workspace.getSearchableNamesOfEnv(COMMON_ENV_PREFIX)
      expect(searchableNamesOfCommon).toEqual(['salto.com'])
      const searchableNamesOfEnv = await workspace.getSearchableNamesOfEnv('default')
      expect(searchableNamesOfEnv).toEqual(['salto.obj', 'salto.obj.field.field'])
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
      expect(workspaceErrors[0].sourceLocations).toHaveLength(1)
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
      expect(workspaceErrors[0].sourceLocations).toHaveLength(1)
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
      expect(wsErros.sourceLocations).toHaveLength(2)
      expect(wsErros.message).toMatch(mergeError)
      expect(wsErros.severity).toBe('Error')
      const firstSourceLocation = wsErros.sourceLocations[0]
      expect(firstSourceLocation.sourceRange.filename).toBe('file.nacl')
      expect(firstSourceLocation.sourceRange.start).toEqual({ byte: 26, col: 3, line: 3 })
      expect(firstSourceLocation.sourceRange.end).toEqual({ byte: 79, col: 4, line: 5 })
    })
    it('should have merge error when hidden values are added to nacl', async () => {
      const obj = new ObjectType({
        elemID: new ElemID('salto', 't'),
        fields: {
          field: {
            annotations: {
              [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
            },
            refType: BuiltinTypes.NUMBER,
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
        expect(wsError.sourceLocations).toHaveLength(0)
      })
    })

    it('should use adapters config source for errors in the configuration', async () => {
      const mockAdaptersConfig = mockAdaptersConfigSource()
      const ws = await createWorkspace(undefined, undefined, undefined, mockAdaptersConfig)
      const error = new InvalidValueValidationError({ elemID: new ElemID('someID'), value: 'val', fieldName: 'field', expectedValue: 'expVal' });
      (error as SaltoError).source = 'config'
      await ws.transformError(error)
      expect(mockAdaptersConfig.getSourceRanges).toHaveBeenCalled()
    })
  })

  describe('removeNaclFiles', () => {
    let dirStore: DirectoryStore<string>
    let workspace: Workspace
    const removedPaths = ['file.nacl', 'willbempty.nacl', 'fieldsWithHidden.nacl']

    beforeEach(async () => {
      dirStore = mockDirStore()
      workspace = await createWorkspace(dirStore)
      await workspace.elements()
    })

    it('should update elements to not include fields from removed Nacl files', async () => {
      await workspace.removeNaclFiles(removedPaths)
      const elemMap = await getElemMap(await workspace.elements())
      expect(Object.keys(elemMap).sort())
        .toEqual(['salesforce.RenamedType1', 'salesforce.inconsistent_case', 'salesforce.lead', 'multi.loc'].sort())
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(Object.keys(lead.fields)).toContain('ext_field')
    })

    it('should modify element to not include fields from removed Nacl files', async () => {
      const changes = await workspace.removeNaclFiles(['subdir/file.nacl'])
      const elemMap = await getElemMap(await workspace.elements())
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(Object.keys(lead.fields)).not.toContain('ext_field')
      expect(changes.default.changes.map(getChangeData).map(c => c.elemID.getFullName()).sort())
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
        .toEqual(['salesforce.RenamedType1', 'salesforce.inconsistent_case', 'salesforce.lead', 'multi.loc'].sort())
      const lead = elemMap['salesforce.lead'] as ObjectType
      expect(Object.keys(lead.fields)).toContain('ext_field')
    })

    describe('on secondary envs', () => {
      const primarySourceName = 'default'
      const secondarySourceName = 'inactive'
      let wsWithMultipleEnvs: Workspace
      const removedElemID = new ElemID('salesforce', 'RenamedType1')
      beforeEach(async () => {
        wsWithMultipleEnvs = await createWorkspace(
          undefined,
          undefined,
          mockWorkspaceConfigSource(undefined, true),
          undefined,
          undefined,
          undefined,
          {
            [COMMON_ENV_PREFIX]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore([], true),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
            },
            [primarySourceName]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore([], true),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
            [secondarySourceName]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore(),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
          },
        )
      })
      it('should return the changes of secondary envs as well', async () => {
        const envChanges = await wsWithMultipleEnvs
          .removeNaclFiles([`envs/${secondarySourceName}/renamed_type.nacl`])
        const change = {
          action: 'remove',
          data: { before: new ObjectType({ elemID: removedElemID }) },
        } as Change<ObjectType>
        expect(envChanges[secondarySourceName].changes).toEqual([change])
      })
      it('should not include remove element in the secondary env', async () => {
        expect(await awu(await (await wsWithMultipleEnvs.elements(true, secondarySourceName))
          .list()).toArray())
          .toContainEqual(removedElemID)
        await wsWithMultipleEnvs
          .removeNaclFiles([`envs/${secondarySourceName}/renamed_type.nacl`])
        expect(await awu(await (await wsWithMultipleEnvs.elements(true, secondarySourceName))
          .list()).toArray())
          .not.toContainEqual(removedElemID)
      })
    })
  })

  describe('setNaclFiles', () => {
    const naclFileStore = mockDirStore()
    let workspace: Workspace
    let elemMap: Record<string, Element>
    let changes: Record<string, ChangeSet<Change<Element>>>
    const newAddedObject = new ObjectType({ elemID: new ElemID('salesforce', 'new') })
    const salesforceLeadElemID = new ElemID('salesforce', 'lead')
    const salesforceText = new ObjectType({ elemID: new ElemID('salesforce', 'text') })
    const salesforceLeadObject = new ObjectType({
      elemID: salesforceLeadElemID,
      fields: {
        // eslint-disable-next-line camelcase
        new_base: { refType: salesforceText },
        // eslint-disable-next-line camelcase
        ext_field: { refType: salesforceText, annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'foo' } },
      },
    })
    const multiLocElemID = new ElemID('multi', 'loc')
    const mutliLocObject = new ObjectType({ elemID: multiLocElemID, annotations: { b: 1 } })
    let mockAdaptersConfig: MockInterface<AdaptersConfigSource>

    beforeAll(async () => {
      mockAdaptersConfig = mockAdaptersConfigSource()
      mockAdaptersConfig.isConfigFile.mockImplementation(
        filePath => filePath === changedConfFile.filename
      )
      workspace = await createWorkspace(naclFileStore, undefined, undefined, mockAdaptersConfig)
      await workspace.elements()
      changes = await workspace.setNaclFiles([
        changedNaclFile,
        newNaclFile,
        emptyNaclFile,
        changedConfFile,
      ])
      elemMap = await getElemMap(await workspace.elements())
    })

    it('should update elements', () => {
      const refMap: Record<string, Element> = {
        'multi.loc': mutliLocObject,
        'salesforce.lead': salesforceLeadObject,
        'salesforce.new': newAddedObject,
        'salesforce.RenamedType1': new ObjectType({ elemID: new ElemID('salesforce', 'RenamedType1') }),
      }
      expect(elemMap.nonempty).not.toBeDefined()
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

    it('should call the adaptersConfigSource when the path is in the config dir', async () => {
      expect(naclFileStore.set as jest.Mock).not.toHaveBeenCalledWith(changedConfFile)
      expect(mockAdaptersConfig.setNaclFiles as jest.Mock).toHaveBeenCalledWith([changedConfFile])
    })

    it('should return the correct changes', async () => {
      const primaryEnvChanges = changes.default.changes
      expect(primaryEnvChanges).toHaveLength(26)
      expect((primaryEnvChanges.find(c => c.action === 'add') as AdditionChange<Element>).data.after)
        .toEqual(newAddedObject)
      const multiLocChange = primaryEnvChanges
        .find(c => getChangeData(c).elemID.isEqual(multiLocElemID))
      expect(multiLocChange).toEqual({
        action: 'modify',
        data: {
          before: new ObjectType({ elemID: multiLocElemID, annotations: { a: 1, b: 1 } }),
          after: mutliLocObject,
        },
      })
    })

    it('setNaclFiles without files should return empty changes', async () => {
      expect(await workspace.setNaclFiles([])).toEqual({})
    })

    describe('on secondary envs', () => {
      const primarySourceName = 'default'
      const secondarySourceName = 'inactive'
      let wsWithMultipleEnvs: Workspace
      const afterObj = new ObjectType({
        elemID: new ElemID('salesforce', 'lead'),
        fields: {
          new_base: { refType: new TypeReference(salesforceText.elemID) },
        },
      })
      beforeEach(async () => {
        wsWithMultipleEnvs = await createWorkspace(
          undefined,
          undefined,
          mockWorkspaceConfigSource(undefined, true),
          undefined,
          undefined,
          undefined,
          {
            [COMMON_ENV_PREFIX]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore([], true),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
            },
            [primarySourceName]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore(),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
            [secondarySourceName]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore([], true),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
          },
        )
      })
      it('should return the changes of secondary envs as well', async () => {
        const envChanges = await wsWithMultipleEnvs.setNaclFiles([changedNaclFile])
        const change = { action: 'add', data: { after: afterObj } } as Change<ObjectType>
        expect(envChanges[secondarySourceName].changes).toEqual([change])
      })
      it('should include the new elements in the secondary env', async () => {
        expect(await awu(await (
          await wsWithMultipleEnvs.elements(true, secondarySourceName)
        ).list()).toArray()).toEqual([])
        await wsWithMultipleEnvs.setNaclFiles([changedNaclFile])
        expect(await awu(await (
          await wsWithMultipleEnvs.elements(true, secondarySourceName)
        ).list()).toArray()).toEqual([afterObj.elemID])
      })
    })

    describe('when merge errors are fixed', () => {
      it('should delete fixed merge errors', async () => {
        const ws = await createWorkspace(naclFileStore)
        await ws.setNaclFiles([
          {
            filename: 'mergeIssue.nacl',
            buffer: `
                type salto.dup {
                  x = "x"
                }

                type salto.dup {
                  x = "x"
                }
              `,
          },
        ])

        expect((await ws.errors()).merge).toHaveLength(1)
        expect((await ws.errors()).merge[0].message).toContain('duplicate annotation key x')
        await ws.setNaclFiles([
          {
            filename: 'mergeIssue.nacl',
            buffer: `
                type salto.dup {
                  x = "x"
                }
              `,
          },
        ])

        expect((await ws.errors()).merge).toHaveLength(0)
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
      fields: { aaa: { refType: BuiltinTypes.NUMBER } },
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

    const queueHiddenInstanceToRemove = new InstanceElement(
      'queueHiddenInstanceToRemove',
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
      ['Records', 'Queue', 'queueInstanceToRemove'],
      {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      }
    )

    const objWithFieldTypeWithHidden = new ObjectType({
      elemID: ElemID.fromFullName('salesforce.ObjWithFieldTypeWithHidden'),
      fields: {
        fieldWithHidden: {
          refType: new TypeReference(ElemID.fromFullName('salesforce.FieldTypeWithHidden')),
          annotations: {
            visible: 'YOU SEE ME',
            hiddenValAnno: 'YOU DO NOT SEE ME',
          },
        },
        fieldWithChangingHidden: {
          refType: new TypeReference(new ElemID('salesforce', 'FieldTypeWithChangingHidden')),
          annotations: {
            hiddenSwitchType: 'asd',
            visibleSwitchType: 'asd',
            visibleChangeType: 'asd',
            hiddenChangeType: 'asd',
            visibleChangeAndSwitchType: 'asd',
          },
        },
      },
      annotationRefsOrTypes: {
        hiddenSwitchType: BuiltinTypes.STRING,
        visibleSwitchType: BuiltinTypes.HIDDEN_STRING,
        visibleChangeType: new TypeReference(new ElemID('salesforce', 'VisibleToHiddenType')),
        hiddenChangeType: new TypeReference(new ElemID('salesforce', 'HiddenToVisibleType')),
        visibleChangeAndSwitchType: BuiltinTypes.HIDDEN_STRING,
      },
      annotations: {
        hiddenSwitchType: 'asd',
        visibleSwitchType: 'asd',
        visibleChangeType: 'asd',
        hiddenChangeType: 'asd',
        visibleChangeAndSwitchType: 'asd',
      },
    })

    const nonHiddenObjWithOnlyHiddeNotInNacl = new ObjectType({
      elemID: ElemID.fromFullName('salesforce.nonHiddenObjWithOnlyHiddeNotInNacl'),
      annotationRefsOrTypes: {
        hidden: BuiltinTypes.HIDDEN_STRING,
      },
      annotations: {
        hidden: 'hidden',
      },
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
      // Remove a hidden type
      {
        id: queueHiddenInstanceToRemove.elemID,
        action: 'remove',
        data: {
          before: queueHiddenInstanceToRemove,
        },
      },
      // Remove a field with hidden annotations
      {
        id: objWithFieldTypeWithHidden.fields.fieldWithHidden.elemID,
        action: 'remove',
        data: {
          before: objWithFieldTypeWithHidden.fields.fieldWithHidden,
        },
      },
      { // Change visible annotation type to hidden type for field annotation
        id: new ElemID('salesforce', 'FieldTypeWithChangingHidden', 'annotation', 'visibleSwitchType'),
        action: 'modify',
        data: {
          before: createRefToElmWithValue(BuiltinTypes.STRING),
          after: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING),
        },
      },
      { // Change hidden annotation type to visible type for field annotation
        id: new ElemID('salesforce', 'FieldTypeWithChangingHidden', 'annotation', 'hiddenSwitchType'),
        action: 'modify',
        data: {
          before: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING),
          after: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
      { // Switch hidden annotation type to visible type for type annotation
        id: objWithFieldTypeWithHidden.elemID.createNestedID('annotation', 'visibleSwitchType'),
        action: 'modify',
        data: {
          before: createRefToElmWithValue(BuiltinTypes.STRING),
          after: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING),
        },
      },
      { // Switch hidden annotation type to visible type for type annotation
        id: objWithFieldTypeWithHidden.elemID.createNestedID('annotation', 'hiddenSwitchType'),
        action: 'modify',
        data: {
          before: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING),
          after: createRefToElmWithValue(BuiltinTypes.STRING),
        },
      },
      { // Switch visible annotation type to hidden when the same type changes to hidden as well
        id: objWithFieldTypeWithHidden.elemID.createNestedID('annotation', 'visibleChangeAndSwitchType'),
        action: 'modify',
        data: {
          before: new TypeReference(new ElemID('salesforce', 'VisibleToHiddenType')),
          after: createRefToElmWithValue(BuiltinTypes.HIDDEN_STRING),
        },
      },
      { // Change type with annotation value from visible to hidden
        id: new ElemID('salesforce', 'VisibleToHiddenType', 'attr', CORE_ANNOTATIONS.HIDDEN_VALUE),
        action: 'add',
        data: { after: true },
      },
      { // Change type with annotation value from hidden to visible
        id: new ElemID('salesforce', 'HiddenToVisibleType', 'attr', CORE_ANNOTATIONS.HIDDEN_VALUE),
        action: 'remove',
        data: { before: true },
      },
      {
        id: nonHiddenObjWithOnlyHiddeNotInNacl.elemID.createNestedID('attr', 'hidden'),
        action: 'modify',
        path: ['should', 'not', 'matter'],
        data: {
          before: 'hidden',
          after: 'changed',
        },
      },
      {
        id: new ElemID('salesforce', 'Inconsistent_Case'),
        action: 'add',
        path: ['Inconsistent_Case'],
        data: {
          after: new ObjectType({
            elemID: new ElemID('salesforce', 'Inconsistent_Case'),
            // Some value to make the serialized length different from the next case
            annotations: { someValue: 'bla' },
          }),
        },
      },
      {
        id: new ElemID('salesforce', 'inconsistent_case'),
        action: 'remove',
        data: {
          before: new ObjectType({ elemID: new ElemID('salesforce', 'inconsistent_case') }),
        },
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
    let updateNaclFileResults: UpdateNaclFilesResult
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
        queueHiddenInstanceToRemove,
        objWithFieldTypeWithHidden,
        nonHiddenObjWithOnlyHiddeNotInNacl,
      ])

      workspace = await createWorkspace(dirStore, state)

      clonedChanges = _.cloneDeep(changes)
      updateNaclFileResults = await workspace.updateNaclFiles(clonedChanges)
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
    it('should have right number of results', () => {
      // This is just meant to test that calculating number of changes works,
      // and could possibly change. If you get a failure here and the number
      // of changes you get seems ok, you can just change numExpectedChanges
      expect(updateNaclFileResults).toEqual({
        naclFilesChangesCount: 25,
        stateOnlyChangesCount: 20,
      })
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
        buffer: expect.stringMatching(/.*salesforce.Queue queueInstance.*salesforce.Queue QueueInstance.*/s),
      }))
    })

    it('should use existing files when different cased elements are added separately', () => {
      // In this scenario, the addition change came with a path hint of "Inconsistent_Case"
      // but we expect the change to go to "inconsistent_case.nacl" because that file already exists
      expect(dirStore.set).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'inconsistent_case.nacl',
        buffer: expect.stringMatching(/.*type salesforce.Inconsistent_Case.*someValue =.*/s),
      }))
    })

    it('should route delete changes to the existing file even when there are different cased elements in the same update', async () => {
      const content = dirStore.get('inconsistent_case.nacl')
      expect(content).not.toContain(/.*type salesforce.inconsistent_case.*/)
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

      const updateNaclFilesResult = await workspace.updateNaclFiles([change1, change2])
      lead = findElement(
        await awu(await (await workspace.elements()).getAll()).toArray(),
        new ElemID('salesforce', 'lead')
      ) as ObjectType
      expect(updateNaclFilesResult).toEqual({
        naclFilesChangesCount: 2,
        stateOnlyChangesCount: 0,
      })
      expect(lead.fields.base_field.annotations[CORE_ANNOTATIONS.DEFAULT]).toEqual('blabla')
    })

    it('should hide hidden instance elements', () => {
      expect(elemMap['salesforce.Queue.instance.queueHiddenInstance']).toBeUndefined()
    })

    it('should remove hidden elements', async () => {
      expect(elemMap[queueHiddenInstanceToRemove.elemID.getFullName()]).toBeUndefined()
      const elem = await workspace.getValue(queueHiddenInstanceToRemove.elemID)
      expect(elem).toBeUndefined()
    })

    it('should remove fields that were removed from the nacls even if they have hidden annotations', async () => {
      expect(elemMap[objWithFieldTypeWithHidden.elemID.getFullName()]).toBeDefined()
      const elem = await workspace.getValue(objWithFieldTypeWithHidden.elemID) as ObjectType
      expect(elem).toBeDefined()
      expect(elem.fields.fieldWithHidden).toBeUndefined()
    })

    it('should hide annotation values when they switch type to hidden', () => {
      const obj = elemMap[objWithFieldTypeWithHidden.elemID.getFullName()] as ObjectType
      expect(obj).toBeDefined()
      expect(obj.annotations).not.toHaveProperty('visibleSwitchType')
      expect(obj.fields.fieldWithChangingHidden.annotations).not.toHaveProperty('visibleSwitchType')
    })
    it('should add annotation values when they switch type to visible', () => {
      const obj = elemMap[objWithFieldTypeWithHidden.elemID.getFullName()] as ObjectType
      expect(obj).toBeDefined()
      expect(obj.annotations).toHaveProperty('hiddenSwitchType')
      expect(obj.fields.fieldWithChangingHidden.annotations).toHaveProperty('hiddenSwitchType')
    })
    it('should hide annotation values when their type changes to hidden', () => {
      const obj = elemMap[objWithFieldTypeWithHidden.elemID.getFullName()] as ObjectType
      expect(obj).toBeDefined()
      expect(obj.annotations).not.toHaveProperty('visibleChangeType')
      expect(obj.fields.fieldWithChangingHidden.annotations).not.toHaveProperty('visibleChangeType')
    })
    it('should add annotation values when their type changes to visible', () => {
      const obj = elemMap[objWithFieldTypeWithHidden.elemID.getFullName()] as ObjectType
      expect(obj).toBeDefined()
      expect(obj.annotations).toHaveProperty('hiddenChangeType')
      expect(obj.fields.fieldWithChangingHidden.annotations).toHaveProperty('hiddenChangeType')
    })
    it('should hide annotation values when they switch type to hidden and the source type changes', () => {
      const obj = elemMap[objWithFieldTypeWithHidden.elemID.getFullName()] as ObjectType
      expect(obj).toBeDefined()
      expect(obj.annotations).not.toHaveProperty('visibleChangeAndSwitchType')
    })
    it('should not modify elements which are not hidden and are not in the nacls', () => {
      expect(elemMap[nonHiddenObjWithOnlyHiddeNotInNacl.elemID.getFullName()]).not.toBeDefined()
    })

    describe('on secondary envs', () => {
      const primarySourceName = 'default'
      const secondarySourceName = 'inactive'
      let wsWithMultipleEnvs: Workspace
      const obj = new ObjectType({ elemID: new ElemID('salesforce', 'dum') })
      const change = {
        id: obj.elemID,
        action: 'add',
        data: {
          after: obj,
        },
      } as DetailedChange
      beforeEach(async () => {
        wsWithMultipleEnvs = await createWorkspace(
          undefined,
          undefined,
          mockWorkspaceConfigSource(undefined, true),
          undefined,
          undefined,
          undefined,
          {
            [COMMON_ENV_PREFIX]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore([], true),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
            },
            [primarySourceName]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore([], true),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
            [secondarySourceName]: {
              naclFiles: await naclFilesSource(
                COMMON_ENV_PREFIX,
                mockDirStore([], true),
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
          },
        )
      })
      it('should include added element in the secondary env', async () => {
        expect(await awu(await (await wsWithMultipleEnvs.elements(true, secondarySourceName))
          .list()).toArray())
          .not.toContainEqual(change.id)
        expect(await wsWithMultipleEnvs.updateNaclFiles([change], 'override')).toEqual({
          naclFilesChangesCount: 2,
          stateOnlyChangesCount: 0,
        })
        expect(await awu(await (await wsWithMultipleEnvs.elements(true, secondarySourceName))
          .list()).toArray())
          .toContainEqual(change.id)
      })
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
        mockAdaptersConfigSource(),
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
            inactive: {
              naclFiles: createMockNaclFileSource([]),
              state: createState([]),
            },
          },
        },
        () => Promise.resolve(new InMemoryRemoteMap()),
      )
      expect((workspaceConf.setWorkspaceConfig as jest.Mock).mock.calls[0][0]).toEqual(
        { name: 'ws-name', uid: 'uid', envs: [{ name: 'default', accountToServiceName: {} }], currentEnv: 'default' }
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
      ws.state().getAccountsUpdateDates = jest.fn().mockImplementation(
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
      ws.state().getAccountsUpdateDates = jest.fn().mockImplementation(
        () => Promise.resolve({ salesforce: modificationDate })
      )
      const recency = await ws.getStateRecency('salesforce')
      expect(recency.status).toBe('Old')
      expect(recency.date).toBe(modificationDate)
    })
    it('should return nonexistent when the state does not exist', async () => {
      const ws = await createWorkspace()
      ws.state().getAccountsUpdateDates = jest.fn().mockImplementation(() => Promise.resolve({}))
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
        getHash: jest.fn().mockResolvedValue(undefined),
      }
      const workspace = await createWorkspace(flushable as unknown as DirectoryStore<string>,
        flushable as unknown as State, undefined, undefined, undefined, undefined,
        undefined, mapCreatorWrapper as RemoteMapCreator)
      await workspace.flush()
      expect(mockFlush).toHaveBeenCalledTimes(2)
      expect(mapFlushCounter['workspace-default-merged']).toEqual(1)
      expect(mapFlushCounter['workspace-default-errors']).toEqual(1)
      expect(mapFlushCounter['workspace-default-validationErrors']).toEqual(1)
    })
    describe('with multiple environments', () => {
      let workspace: Workspace
      let env1StateFlush: jest.SpiedFunction<State['flush']>
      let env2StateFlush: jest.SpiedFunction<State['flush']>
      beforeEach(async () => {
        const env1State = mockState()
        const env2State = mockState()
        env1StateFlush = jest.spyOn(env1State, 'flush')
        env2StateFlush = jest.spyOn(env2State, 'flush')
        workspace = await createWorkspace(
          mockDirStore(),
          undefined,
          mockWorkspaceConfigSource(undefined, true),
          undefined,
          undefined,
          undefined,
          {
            default: { naclFiles: createMockNaclFileSource([]), state: env1State },
            inactive: { naclFiles: createMockNaclFileSource([]), state: env2State },
            [COMMON_ENV_PREFIX]: { naclFiles: createMockNaclFileSource([]) },
          },
        )
        await workspace.flush()
      })
      it('should flush all state files', () => {
        expect(env1StateFlush).toHaveBeenCalled()
        expect(env2StateFlush).toHaveBeenCalled()
      })
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
      workspaceConf = mockWorkspaceConfigSource(undefined, true)
      credSource = mockCredentialsSource()
      state = createState([])
      defNaclFiles = createMockNaclFileSource([])
      inactiveNaclFiles = createMockNaclFileSource([
        new ObjectType({ elemID: new ElemID('salto', 'inactive') }),
      ])
      workspace = await createWorkspace(undefined, undefined, workspaceConf, undefined, credSource,
        undefined,
        {
          '': { naclFiles: createMockNaclFileSource([]) },
          default: { naclFiles: defNaclFiles, state },
          inactive: { naclFiles: inactiveNaclFiles, state },
        })
    })

    it('should change workspace state', async () => {
      await workspace.setCurrentEnv('inactive')
      expect(workspace.accounts().sort()).toEqual([...services, 'netsuite'].sort())
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
    const mockRmcToSource = async (_rmc: RemoteMapCreator): Promise<EnvironmentSource> =>
      ({} as unknown as EnvironmentSource)
    const envName = 'new'

    beforeEach(async () => {
      workspaceConf = mockWorkspaceConfigSource()
      workspace = await createWorkspace(mockDirStore([], true), undefined, workspaceConf)
      const state = createState([])
      await workspace.addEnvironment(
        envName,
        async (rmc: RemoteMapCreator): Promise<EnvironmentSource> => ({
          naclFiles: await naclFilesSource(
            envName,
            mockDirStore([], false, { 'common.nacl': 'type salesforce.hearing { }' }),
            mockStaticFilesSource(),
            rmc,
            false
          ),
          state,
        })
      )
    })

    it('should change workspace state', async () => {
      expect(workspace.envs().includes(envName)).toBeTruthy()
    })
    it('should persist', () => {
      expect(workspaceConf.setWorkspaceConfig).toHaveBeenCalledTimes(1)
      const envs = (
        workspaceConf.setWorkspaceConfig as jest.Mock
      ).mock.calls[0][0].envs as EnvConfig[]
      const envsNames = envs.map((e: {name: string}) => e.name)
      expect(envsNames.includes(envName)).toBeTruthy()
    })
    it('should include elements of the new source', async () => {
      expect(await awu(await (await workspace.elements(false, envName)).getAll()).toArray())
        .toEqual([new ObjectType({ elemID: new ElemID('salesforce', 'hearing') })])
    })
    it('should throw EnvDuplicationError', async () => {
      await expect(workspace.addEnvironment(envName, mockRmcToSource))
        .rejects.toEqual(new EnvDuplicationError(envName))
    })

    describe('invalid new environment name', () => {
      test('throws InvalidEnvNameError for name with illegal characters', async () => {
        const nameWithIllegalChars = 'invalid:env'
        await expect(workspace.addEnvironment(nameWithIllegalChars, mockRmcToSource))
          .rejects.toThrow(InvalidEnvNameError)
      })
      test('throws InvalidEnvNameError when name is too long', async () => {
        const longName = 'a'.repeat(MAX_ENV_NAME_LEN * 2)
        await expect(workspace.addEnvironment(longName, mockRmcToSource))
          .rejects.toThrow(InvalidEnvNameError)
      })
    })
  })
  describe('changed at index', () => {
    let workspace: Workspace
    const firstFile = `
      type salesforce.text is string {}
      type salesforce.lead {
        annotations {
          string _changed_at {
          }
        }
        _changed_at = "2000-01-01T00:00:00.000Z"
        salesforce.text singleDef {
  
        }
        salesforce.text multiDef {
  
        }
      }
    `
    const naclFileStore = mockDirStore(undefined, undefined, {
      'firstFile.nacl': firstFile,
    })
    const emptyFileStore = mockDirStore(undefined, undefined, {})
    describe('empty index', () => {
      beforeEach(async () => {
        workspace = await createWorkspace(
          emptyFileStore,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            '': {
              naclFiles: createMockNaclFileSource([]),
            },
            default: {
              naclFiles: await naclFilesSource(
                'default',
                emptyFileStore,
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
          },
        )
      })
      describe('isChangedAtIndexEmpty', () => {
        it('should return true', async () => {
          const result = await workspace.isChangedAtIndexEmpty()
          expect(result).toBeTruthy()
        })
      })
    })
    describe('populated index', () => {
      beforeEach(async () => {
        workspace = await createWorkspace(
          naclFileStore,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            '': {
              naclFiles: createMockNaclFileSource([]),
            },
            default: {
              naclFiles: await naclFilesSource(
                'default',
                naclFileStore,
                mockStaticFilesSource(),
                persistentMockCreateRemoteMap(),
                true
              ),
              state: createState([]),
            },
          },
        )
      })
      describe('getChangedElementsBetween', () => {
        it('get correct element ids without full date range', async () => {
          const dateRange = { start: new Date('1999-01-01T00:00:00.000Z') }
          const result = await workspace.getChangedElementsBetween(dateRange)
          expect(result[0].getFullName()).toEqual('salesforce.lead')
        })
        it('get correct element ids until date failure', async () => {
          const dateRange = { end: new Date('1999-02-01T00:00:00.000Z'), start: new Date('1999-01-01T00:00:00.000Z') }
          const result = await workspace.getChangedElementsBetween(dateRange)
          expect(result.length).toEqual(0)
        })
        it('get correct element ids until date success', async () => {
          const dateRange = { end: new Date('2001-01-01T00:00:00.000Z'), start: new Date('1999-01-01T00:00:00.000Z') }
          const result = await workspace.getChangedElementsBetween(dateRange)
          expect(result[0].getFullName()).toEqual('salesforce.lead')
        })
      })
      describe('isChangedAtIndexEmpty', () => {
        it('should return false', async () => {
          const result = await workspace.isChangedAtIndexEmpty()
          expect(result).toBeFalsy()
        })
      })
    })
  })
  describe('static files index', () => {
    let workspace: Workspace
    const firstTypeFile = `
      type salesforce.text is string {}
      type salesforce.lead {
        annotations {
          string _changed_by {
          }
        }
        _changed_by = "test user"
        salesforce.text singleDef {
  
        }
        salesforce.text multiDef {
  
        }
      }
    `
    const firstInstance = `
      salesforce.lead someName1 {
        salesforce.text = file("static1.nacl")
      }
    `
    const secondInstance = `
      salesforce.lead someName2 {
      salesforce.text = file("static2.nacl")
      }
    `
    const naclFileStore = mockDirStore(undefined, undefined, {
      'firstFile.nacl': firstTypeFile,
      'someName1.nacl': firstInstance,
      'someName2.nacl': secondInstance,
    })
    beforeEach(async () => {
      const firstStaticFile = new StaticFile({
        content: Buffer.from('I am a little static file'),
        filepath: 'static1.nacl',
        hash: 'FFFF',
      })
      const secondStaticFile = new StaticFile({
        content: Buffer.from('I am a little static file'),
        filepath: 'static2.nacl',
        hash: 'FFFF',
      })
      workspace = await createWorkspace(
        naclFileStore,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          '': {
            naclFiles: createMockNaclFileSource([]),
          },
          default: {
            naclFiles: await naclFilesSource(
              'default',
              naclFileStore,
              mockStaticFilesSource([firstStaticFile, secondStaticFile]),
              persistentMockCreateRemoteMap(),
              true
            ),
            state: createState([]),
          },
        },
      )
    })
    describe('getStaticFilePathsByElemIds', () => {
      it('get correct paths when providing a correct element id', async () => {
        const result = await workspace.getStaticFilePathsByElemIds([ElemID.fromFullName('salesforce.lead.instance.someName1')])
        expect(result).toEqual(['static1.nacl'])
      })
      it('get multiple static files with multiple element ids', async () => {
        const result = await workspace.getStaticFilePathsByElemIds([
          ElemID.fromFullName('salesforce.lead.instance.someName1'),
          ElemID.fromFullName('salesforce.lead.instance.someName2'),
        ])
        expect(result).toEqual(['static1.nacl', 'static2.nacl'])
      })
      it('get no paths when providing a bad element id', async () => {
        const result = await workspace.getStaticFilePathsByElemIds([ElemID.fromFullName('salesforce.lead.type')])
        expect(result).toEqual([])
      })
    })
    describe('getElemIdsByStaticFilePaths', () => {
      describe('with missing filepaths param', () => {
        it('should return full map', async () => {
          const result = await workspace.getElemIdsByStaticFilePaths()
          expect(result).toEqual(
            {
              'static1.nacl': 'salesforce.lead.instance.someName1',
              'static2.nacl': 'salesforce.lead.instance.someName2',
            }
          )
        })
      })
      describe('with supplied filepaths', () => {
        describe('when specific paths are given', () => {
          it('should return a mapping that only contains the given paths', async () => {
            const result = await workspace.getElemIdsByStaticFilePaths(new Set(['static1.nacl']))
            expect(result).toEqual(
              {
                'static1.nacl': 'salesforce.lead.instance.someName1',
              }
            )
          })
        })
        describe('when given paths do no exist', () => {
          it('should return an empty map', async () => {
            const result = await workspace.getElemIdsByStaticFilePaths(new Set(['not exists.nacl']))
            expect(result).toEqual({})
          })
        })
        describe('when given paths are empty', () => {
          it('should return an empty map', async () => {
            const result = await workspace.getElemIdsByStaticFilePaths(new Set())
            expect(result).toEqual({})
          })
        })
      })
    })
  })
  describe('alias index', () => {
    let workspace: Workspace
    const firstTypeFile = `
      type salesforce.text is string {}
      type salesforce.lead {
        annotations {
          string _alias {
          }
        }
        _alias = "lead alias"
        salesforce.text singleDef {
          _alias = "single Def alias"
        }
        salesforce.text multiDef {
  
        }
      }
    `
    const firstInstance = `
      salesforce.lead someName1 {
        _alias = "some name alias"
      }
    `
    const secondInstance = `
      salesforce.lead someName2 {
      }
    `
    const naclFileStore = mockDirStore(undefined, undefined, {
      'firstFile.nacl': firstTypeFile,
      'someName1.nacl': firstInstance,
      'someName2.nacl': secondInstance,
    })
    beforeEach(async () => {
      workspace = await createWorkspace(
        naclFileStore,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          '': {
            naclFiles: createMockNaclFileSource([]),
          },
          default: {
            naclFiles: await naclFilesSource(
              'default',
              naclFileStore,
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
            state: createState([]),
          },
        },
      )
    })
    describe('getAliases', () => {
      it('should return full map', async () => {
        const index = await workspace.getAliases()
        const result = Object.fromEntries(await awu(index.entries())
          .map(({ key: id, value: alias }) => ([id, alias]))
          .toArray())
        expect(result).toEqual(
          {
            'salesforce.lead.field.singleDef': 'single Def alias',
            'salesforce.lead.field.multiDef': 'Multi Def',
            'salesforce.lead': 'lead alias',
            'salesforce.lead.instance.someName1': 'some name alias',
            'salesforce.lead.instance.someName2': 'Some Name2',
            'salesforce.text': 'Text',
          }
        )
      })
    })
  })
  describe('changed by index', () => {
    let workspace: Workspace
    const firstFile = `
      type salesforce.text is string {}
      type salesforce.lead {
        annotations {
          string _changed_by {
          }
        }
        _changed_by = "test user"
        salesforce.text singleDef {
  
        }
        salesforce.text multiDef {
  
        }
      }
    `
    const naclFileStore = mockDirStore(undefined, undefined, {
      'firstFile.nacl': firstFile,
    })
    beforeEach(async () => {
      workspace = await createWorkspace(
        naclFileStore,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          '': {
            naclFiles: createMockNaclFileSource([]),
          },
          default: {
            naclFiles: await naclFilesSource(
              'default',
              naclFileStore,
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
            state: createState([]),
          },
        },
      )
    })
    describe('getAllChangedByAuthors', () => {
      it('get correct authors', async () => {
        const result = await workspace.getAllChangedByAuthors()
        expect(result).toEqual(expect.arrayContaining([{ user: 'Unknown', account: '' }]))
        expect(result).toEqual(expect.arrayContaining([{ user: 'test user', account: 'salesforce' }]))
      })
    })
    describe('getChangedElementsByAuthor', () => {
      it('get correct elements', async () => {
        const unknownUser = await workspace.getChangedElementsByAuthors([{ user: 'Unknown', account: '' }])
        expect(unknownUser[0].getFullName()).toEqual('salesforce.lead.field.singleDef')
        expect(unknownUser[1].getFullName()).toEqual('salesforce.lead.field.multiDef')
        expect(unknownUser[2].getFullName()).toEqual('salesforce.text')
        const testUser = await workspace.getChangedElementsByAuthors([{ user: 'test user', account: 'salesforce' }])
        expect(testUser[0].getFullName()).toEqual('salesforce.lead')
        const multipleUsers = await workspace.getChangedElementsByAuthors([{ user: 'test user', account: 'salesforce' }, { user: 'Unknown', account: '' }])
        expect(multipleUsers).toEqual(expect.arrayContaining(unknownUser))
        expect(multipleUsers).toEqual(expect.arrayContaining(testUser))
      })
    })
  })
  describe('deleteEnvironment', () => {
    describe('should delete environment', () => {
      const envName = 'inactive'
      let workspaceConf: WorkspaceConfigSource
      let credSource: ConfigSource
      let workspace: Workspace
      let stateClear: jest.SpyInstance
      let naclFiles: NaclFilesSource
      beforeEach(async () => {
        jest.clearAllMocks()
        workspaceConf = mockWorkspaceConfigSource(undefined, true)
        credSource = mockCredentialsSource()
        const state = createState([])
        stateClear = jest.spyOn(state, 'clear')
        naclFiles = createMockNaclFileSource([])
        workspace = await createWorkspace(
          undefined,
          undefined,
          workspaceConf,
          undefined,
          credSource,
          undefined,
          {
            inactive: { naclFiles, state },
            '': { naclFiles: createMockNaclFileSource([]) },
            default: { naclFiles: createMockNaclFileSource([]), state: createState([]) },
          }
        )
      })
      describe('should delete nacl and state files if keepNacls is false', () => {
        beforeEach(async () => {
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
      describe('should not delete nacl and state files if keepNacls is true', () => {
        beforeEach(async () => {
          await workspace.deleteEnvironment(envName, true)
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
        it('should not delete files', () => {
          expect(credSource.delete).toHaveBeenCalledTimes(1)
          expect(stateClear).toHaveBeenCalledTimes(0)
          expect(naclFiles.clear).toHaveBeenCalledTimes(0)
        })
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
      workspaceConf = mockWorkspaceConfigSource(undefined, true)
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
      workspace = await createWorkspace(undefined, undefined, workspaceConf, undefined, credSource,
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
        workspaceConf = mockWorkspaceConfigSource(undefined, true)
        credSource = mockCredentialsSource()
        state = createState([])
        stateRename = jest.spyOn(state, 'rename')
        naclFiles = createMockNaclFileSource([])
      })

      const verifyRenameFiles = (): void => {
        expect(credSource.rename).toHaveBeenCalledTimes(1)
        expect(stateRename).toHaveBeenCalledTimes(1)
        expect(naclFiles.load).toHaveBeenCalledTimes(1)
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
          workspace = await createWorkspace(undefined, undefined, workspaceConf, undefined,
            credSource, undefined, { [envName]: { naclFiles, state }, '': { naclFiles: createMockNaclFileSource([]) } })
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
          workspace = await createWorkspace(undefined, undefined, workspaceConf, undefined,
            credSource,
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
      describe('invalid new environment name', () => {
        test('throws InvalidEnvNameError for name with illegal characters', async () => {
          const nameWithIllegalChars = 'invalid:env'
          await expect(workspace.renameEnvironment(workspace.currentEnv(), nameWithIllegalChars))
            .rejects.toThrow(InvalidEnvNameError)
        })
        test('throws InvalidEnvNameError when name is too long', async () => {
          const longName = 'a'.repeat(MAX_ENV_NAME_LEN * 2)
          await expect(workspace.renameEnvironment(workspace.currentEnv(), longName))
            .rejects.toThrow(InvalidEnvNameError)
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

  describe('addAccount', () => {
    let workspaceConf: WorkspaceConfigSource
    let workspace: Workspace

    describe('when creating an account', () => {
      beforeEach(async () => {
        workspaceConf = mockWorkspaceConfigSource({})
        workspace = await createWorkspace(undefined, undefined, workspaceConf)
        await workspace.addAccount('salto', 'new')
      })

      it('should change workspace state', async () => {
        expect(workspace.accounts().includes('new')).toBeTruthy()
      })

      it('should throw account duplication error', async () => {
        await expect(workspace.addAccount('salto', 'new')).rejects.toThrow(AccountDuplicationError)
      })

      it('should throw invalidAccountNameError', async () => {
        await expect(workspace.addAccount('salto', 'new;;')).rejects.toThrow(InvalidAccountNameError)
        await expect(workspace.addAccount('salto', 'new account')).rejects.toThrow(InvalidAccountNameError)
        await expect(workspace.addAccount('salto', 'new.')).rejects.toThrow(InvalidAccountNameError)
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

    describe('when specifing an override environment', () => {
      beforeEach(async () => {
        workspaceConf = mockWorkspaceConfigSource({}, true)
        workspace = await createWorkspace(undefined, undefined, workspaceConf)
        await workspace.setCurrentEnv('inactive', false)
        await workspace.addAccount('salto')
      })

      it('should add the account only in the other enviroment', () => {
        expect(workspace.accounts('default')).not.toContain('salto')
        expect(workspace.accounts('inactive')).toContain('salto')
      })

      it('should not change the persisted current environment', () => {
        expect(workspaceConf.setWorkspaceConfig as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ currentEnv: 'default' })
        )
      })
    })
  })

  describe('accountConfig', () => {
    let workspace: Workspace
    let adaptersConfig: MockInterface<AdaptersConfigSource>
    const configElemId = new ElemID('dummy', 'new')
    const configObjectType = new ObjectType({ elemID: configElemId })
    const configInstanceElement = new InstanceElement('aaa', configObjectType)
    const resolveMock = jest.spyOn(expressionsModule, 'resolve')
    beforeEach(async () => {
      resolveMock.mockClear()
      adaptersConfig = mockAdaptersConfigSource()
      adaptersConfig.getElements.mockReturnValue(createInMemoryElementSource([
        configObjectType,
      ]))
      workspace = await createWorkspace(undefined, undefined, undefined, adaptersConfig)
    })
    afterAll(() => {
      resolveMock.mockRestore()
    })
    describe('when called with name only', () => {
      it('should return the unresolved accountConfig', async () => {
        adaptersConfig.getAdapter.mockResolvedValue(configInstanceElement)
        resolveMock.mockImplementation(async elem => elem)
        expect(await workspace.accountConfig('new')).toEqual(configInstanceElement)
        expect(resolveMock).not.toHaveBeenCalled()
      })
    })
    describe('when called with shouldResolve', () => {
      it('should return the resolved accountConfig', async () => {
        adaptersConfig.getAdapter.mockResolvedValue(configInstanceElement)
        resolveMock.mockImplementation(async elem => elem)
        expect(await workspace.accountConfig('new', undefined, true)).toEqual(configInstanceElement)
        expect(resolveMock).toHaveBeenCalled()
      })
    })
    describe('when getAdapter return undefined', () => {
      it('should return undefined', async () => {
        adaptersConfig.getAdapter.mockResolvedValue(undefined)
        resolveMock.mockImplementation(async elem => elem)
        expect(await workspace.accountConfig('new')).toEqual(undefined)
        expect(resolveMock).not.toHaveBeenCalled()
      })
    })
    describe('when resolve returned Element', () => {
      it('should return undefined', async () => {
        adaptersConfig.getAdapter.mockResolvedValue(configInstanceElement)
        resolveMock.mockResolvedValue([configObjectType])
        expect(await workspace.accountConfig('new', undefined, true)).toEqual(undefined)
        expect(resolveMock).toHaveBeenCalled()
      })
    })
  })

  describe('updateAccountCredentials', () => {
    let credsSource: ConfigSource
    let workspace: Workspace
    const newCreds = new InstanceElement(
      services[0],
      new ObjectType({ elemID: new ElemID(services[0]) }),
      { user: 'username', password: 'pass' },
    )

    beforeEach(async () => {
      credsSource = mockCredentialsSource()
      workspace = await createWorkspace(undefined, undefined, undefined, undefined, credsSource)
      await workspace.updateAccountCredentials(services[0], newCreds)
    })

    it('should persist', () => {
      expect(credsSource.set).toHaveBeenCalledTimes(1)
      const instance = (credsSource.set as jest.Mock).mock.calls[0][1] as InstanceElement
      expect(instance).toEqual(newCreds)
      const credsPath = (credsSource.set as jest.Mock).mock.calls[0][0] as string
      expect(credsPath).toEqual(`default/${services[0]}`)
    })
  })

  describe('updateAccountConfig', () => {
    let adaptersConf: AdaptersConfigSource
    let workspace: Workspace
    const newConf = new InstanceElement(services[0],
      new ObjectType({ elemID: new ElemID(services[0]) }), { conf1: 'val1' })

    beforeEach(async () => {
      adaptersConf = mockAdaptersConfigSource()
      workspace = await createWorkspace(undefined, undefined, undefined, adaptersConf)
      await workspace.updateAccountConfig(services[0], newConf, services[0])
    })

    it('should persist', () => {
      expect(adaptersConf.setAdapter).toHaveBeenCalledTimes(1)
      const setAdapterParams = (
        adaptersConf.setAdapter as jest.Mock
      ).mock.calls[0]
      expect(setAdapterParams[0]).toEqual('salesforce')
      expect(setAdapterParams[1]).toEqual('salesforce')
      expect(setAdapterParams[2]).toEqual(newConf)
    })
  })

  describe('accountCredentials', () => {
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
      workspace = await createWorkspace(undefined, undefined, undefined, undefined, credsSource)
    })

    it('should get creds', async () => {
      await workspace.accountCredentials()
      expect(credsSource.get).toHaveBeenCalledTimes(1)
    })

    it('should get creds partials', async () => {
      await workspace.accountCredentials(services)
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

  describe('getElementOutgoingReferences', () => {
    let workspace: Workspace

    beforeAll(async () => {
      workspace = await createWorkspace()
    })

    it('None-base type should throw', async () => {
      await expect(workspace.getElementOutgoingReferences(new ElemID('adapter', 'type', 'attr', 'aaa'))).rejects.toThrow()
    })

    it('None-exist type should return empty array', async () => {
      expect(await workspace.getElementOutgoingReferences(new ElemID('adapter', 'notExists'))).toEqual([])
    })
  })

  describe('getElementIncomingReferences', () => {
    let workspace: Workspace

    beforeAll(async () => {
      workspace = await createWorkspace()
    })

    it('None-base type should throw', async () => {
      await expect(workspace.getElementIncomingReferences(new ElemID('adapter', 'type', 'attr', 'aaa'))).rejects.toThrow()
    })

    it('None-exist type should return empty array', async () => {
      expect(await workspace.getElementIncomingReferences(new ElemID('adapter', 'notExists'))).toEqual([])
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
              { name: 'default', accounts: ['test'], accountToServiceName: { test: 'test' } },
              { name: 'full', accounts: ['test'], accountToServiceName: { test: 'test' } },
            ],
            uid: '',
            name: 'test',
            currentEnv: 'full',
          })),
          setWorkspaceConfig: jest.fn(),
        },
        undefined,
        undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              '',
              mockDirStore(),
              staticFilesSource,
              remoteMapCreator,
              true
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
        undefined, undefined, mockWorkspaceConfigSource(undefined, true), undefined, undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              '',
              mockDirStore(),
              staticFilesSource,
              remoteMapCreator,
              true
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
    let resultNumber: UpdateNaclFilesResult
    beforeAll(async () => {
      workspace = await createWorkspace(naclFileStore)
      // Verify that the two errors we are starting with (that should be deleted in the update
      // since the update resolves them ) are present. This check will help debug situations in
      // which the entier flow is broken and errors are not created at all...
      expect((await workspace.errors()).validation).toHaveLength(2)
      resultNumber = await workspace.updateNaclFiles(changes)
      validationErrs = (await workspace.errors()).validation
    })

    it('returns correct number of actual changes', () => {
      expect(resultNumber.naclFilesChangesCount).toEqual(changes.length)
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

  describe('element commands', () => {
    const primarySourceName = 'default'
    const secondarySourceName = 'inactive'
    let ws: Workspace
    beforeEach(async () => {
      ws = await createWorkspace(
        undefined,
        undefined,
        mockWorkspaceConfigSource(undefined, true),
        undefined,
        undefined,
        undefined,
        {
          [COMMON_ENV_PREFIX]: {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore([], false, { 'common.nacl': 'type salesforce.hearing { }' }),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          [primarySourceName]: {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
            state: createState([]),
          },
          [secondarySourceName]: {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore([], true),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
            state: createState([]),
          },
        },
      )
    })
    describe('promote', () => {
      it('should update the elements correctly', async () => {
        const elemIDToMove = new ElemID('salesforce', 'lead')
        expect(
          await awu(await (await ws.elements(undefined, secondarySourceName)).list()).toArray()
        ).not.toContainEqual(elemIDToMove)
        await ws.promote([elemIDToMove])
        expect(
          await awu(await (await ws.elements(undefined, secondarySourceName)).list()).toArray()
        ).toContainEqual(elemIDToMove)
        expect(
          await awu(await (await ws.elements(undefined, primarySourceName)).list()).toArray()
        ).toContainEqual(elemIDToMove)
      })
    })
    describe('copyTo', () => {
      it('should update the elements correctly', async () => {
        const elemIDToMove = new ElemID('salesforce', 'lead')
        expect(
          await awu(await (await ws.elements(undefined, secondarySourceName)).list()).toArray()
        ).not.toContainEqual(elemIDToMove)
        await ws.copyTo([elemIDToMove], [secondarySourceName])
        expect(
          await awu(await (await ws.elements(undefined, secondarySourceName)).list()).toArray()
        ).toContainEqual(elemIDToMove)
        expect(
          await awu(await (await ws.elements(undefined, primarySourceName)).list()).toArray()
        ).toContainEqual(elemIDToMove)
      })
    })

    describe('sync', () => {
      it('should update the elements correctly', async () => {
        const elemIDToRemove = new ElemID('salesforce', 'someType', 'instance', 'inst1')
        const elemIDToAdd = new ElemID('salesforce', 'lead')
        await ws.sync(
          [elemIDToAdd],
          { [secondarySourceName]: [elemIDToRemove] },
          [secondarySourceName]
        )
        const elements = await awu(
          await (await ws.elements(undefined, secondarySourceName)).list()
        ).toArray()
        expect(elements).not.toContainEqual(elemIDToRemove)
        expect(elements).toContainEqual(elemIDToAdd)
      })
    })
  })

  describe('getNaclFile', () => {
    let ws: Workspace
    let mockAdaptersConfig: MockInterface<AdaptersConfigSource>
    beforeEach(async () => {
      mockAdaptersConfig = mockAdaptersConfigSource()
      ws = await createWorkspace(undefined, undefined, undefined, mockAdaptersConfig)
    })

    it('when the file is a config file should use the adapters config source', async () => {
      mockAdaptersConfig.isConfigFile.mockReturnValue(true)
      await ws.getNaclFile('someFile')
      expect(mockAdaptersConfig.getNaclFile).toHaveBeenCalled()
    })

    it('when the file is not a config file should not use the adapters config source', async () => {
      mockAdaptersConfig.isConfigFile.mockReturnValue(false)
      await ws.getNaclFile('someFile')
      expect(mockAdaptersConfig.getNaclFile).not.toHaveBeenCalled()
    })
  })


  describe('static files', () => {
    let workspace: Workspace
    const elemID = ElemID.fromFullName('salto.withStatic')
    const defaultStaticFile = new StaticFile({
      content: Buffer.from('I am a little static file'),
      filepath: 'salto/static.txt',
      hash: 'FFFF',
    })
    const defaultElem = new ObjectType({
      elemID,
      annotationRefsOrTypes: {
        static: BuiltinTypes.STRING,
      },
      annotations: {
        static: defaultStaticFile,
      },
    })

    const defaultStaticFileSource = mockStaticFilesSource([defaultStaticFile])
    const inactiveStaticFile = new StaticFile({
      content: Buffer.from('I am a big static file'),
      filepath: 'salto/static.txt',
      hash: 'FFFF',
    })
    const inactiveElem = new ObjectType({
      elemID,
      annotationRefsOrTypes: {
        static: new TypeReference(BuiltinTypes.STRING.elemID),
      },
      annotations: {
        static: inactiveStaticFile,
      },
    })
    const inactiveStaticFileSource = mockStaticFilesSource([inactiveStaticFile])

    beforeEach(async () => {
      workspace = await createWorkspace(
        undefined,
        undefined,
        {
          getWorkspaceConfig: jest.fn().mockImplementation(() => ({
            envs: [
              { name: 'default', accounts: ['salto'] },
              { name: 'inactive', accounts: ['salto'] },
            ],
            uid: '',
            name: 'test',
            currentEnv: 'default',
          })),
          setWorkspaceConfig: jest.fn(),
        },
        undefined,
        undefined,
        undefined,
        {
          '': {
            naclFiles: createMockNaclFileSource([]),
          },
          default: {
            naclFiles: createMockNaclFileSource(
              [defaultElem], undefined, undefined, undefined, undefined, defaultStaticFileSource
            ),
            state: createState([]),
          },
          inactive: {
            naclFiles: createMockNaclFileSource(
              [inactiveElem], undefined, undefined, undefined, undefined, inactiveStaticFileSource
            ),
            state: createState([]),
          },
        }
      )
    })
    describe('deserialization', () => {
      it('should deserialize static files from the active env', async () => {
        const elem = await (await workspace.elements()).get(elemID) as Element
        expect(isStaticFile(elem.annotations.static)).toBeTruthy()
        const elemStaticFile = elem.annotations.static as StaticFile
        expect(await elemStaticFile.getContent()).toEqual(await defaultStaticFile.getContent())
      })

      it('should deserialize static files from the non-active env', async () => {
        const elem = await (await workspace.elements(true, 'inactive')).get(elemID) as Element
        expect(isStaticFile(elem.annotations.static)).toBeTruthy()
        const elemStaticFile = elem.annotations.static as StaticFile
        expect(await elemStaticFile.getContent()).toEqual(await inactiveStaticFile.getContent())
      })
    })

    describe('getStaticFile', () => {
      it('should get staticFile by env', async () => {
        const defaultStaticFileRes = (await workspace.getStaticFile({ filepath: 'salto/static.txt', encoding: 'utf-8' }))
        expect(defaultStaticFileRes).toBeDefined()
        expect(defaultStaticFileRes?.isEqual(defaultStaticFile)).toBeTruthy()
        const inactiveStaticFileRes = (await workspace.getStaticFile({ filepath: 'salto/static.txt', encoding: 'utf-8', env: 'inactive' }))
        expect(inactiveStaticFileRes).toBeDefined()
        expect(inactiveStaticFileRes?.isEqual(inactiveStaticFile)).toBeTruthy()
      })

      it('should return missing staticFile if it does not exist', async () => {
        const defaultMissing = (await workspace.getStaticFile({ filepath: 'no', encoding: 'utf-8' }))
        expect(defaultMissing).toBeInstanceOf(MissingStaticFile)
        const inactiveMissing = (await workspace.getStaticFile({ filepath: 'no', encoding: 'utf-8', env: 'inactive' }))
        expect(inactiveMissing).toBeInstanceOf(MissingStaticFile)
      })
    })
  })

  describe('isEmpty', () => {
    it('should return true if the workspace is empty', async () => {
      const ws = await createWorkspace(
        mockDirStore(undefined, undefined, {}),
        mockState([])
      )
      expect(await ws.isEmpty()).toBeTruthy()
    })

    it('should return false is the workspace is not empty', async () => {
      const ws = await createWorkspace()
      expect(await ws.isEmpty()).toBeFalsy()
    })

    it('should return true if state is not empty but the withNaclFilesOnly flag is provided', async () => {
      const ws = await createWorkspace(
        mockDirStore(undefined, undefined, {}),
        mockState([new ObjectType({ elemID: new ElemID('salto', 'something') })])
      )
      expect(await ws.isEmpty(true)).toBeTruthy()
    })
  })

  describe('getElementIdsBySelectors', () => {
    let ws: Workspace

    const defaultElem = new ObjectType({
      elemID: new ElemID('adapter', 'default'),
    })

    const inactiveElem = new ObjectType({
      elemID: new ElemID('adapter', 'inactive'),
    })
    beforeEach(async () => {
      ws = await createWorkspace(
        undefined,
        undefined,
        {
          getWorkspaceConfig: jest.fn().mockImplementation(() => ({
            envs: [
              { name: 'default', services: ['salto'] },
              { name: 'inactive', services: ['salto'] },
            ],
            uid: '',
            name: 'test',
            currentEnv: 'default',
          })),
          setWorkspaceConfig: jest.fn(),
        },
        undefined,
        undefined,
        undefined,
        {
          '': {
            naclFiles: createMockNaclFileSource([]),
          },
          default: {
            naclFiles: createMockNaclFileSource(
              [defaultElem]
            ),
            state: createState([]),
          },
          inactive: {
            naclFiles: createMockNaclFileSource(
              [inactiveElem]
            ),
            state: createState([]),
          },
        }
      )
    })

    it('When envName is passed should use the env', async () => {
      const selector = createElementSelector('adapter.*')
      const ids = await awu(await ws.getElementIdsBySelectors(
        [selector],
        { source: 'env', envName: 'inactive' }
      )).toArray()
      expect(ids.map(id => id.getFullName())).toEqual(['adapter.inactive'])
    })

    it('When envName is not passed should use the current env', async () => {
      const selector = createElementSelector('adapter.*')
      const ids = await awu(await ws.getElementIdsBySelectors(
        [selector],
        { source: 'env' }
      )).toArray()
      expect(ids.map(id => id.getFullName())).toEqual(['adapter.default'])
    })
  })
  describe('getServiceFromAccountName', () => {
    let ws: Workspace
    beforeEach(async () => {
      ws = await createWorkspace(
        undefined,
        undefined,
        {
          getWorkspaceConfig: jest.fn().mockImplementation(() => ({
            envs: [
              { name: 'default', accountToServiceName: { salto2: 'salto', salto1: 'salto' } },
            ],
            uid: '',
            name: 'test',
            currentEnv: 'default',
          })),
          setWorkspaceConfig: jest.fn(),
        },
        undefined,
        undefined,
        undefined,
        {
          '': {
            naclFiles: createMockNaclFileSource([]),
          },
          default: {
            naclFiles: createMockNaclFileSource(
              []
            ),
            state: createState([]),
          },
        }
      )
    })

    it('gets correct service from account name', () => {
      expect(ws.getServiceFromAccountName('salto2')).toEqual('salto')
      expect(ws.getServiceFromAccountName('salto1')).toEqual('salto')
    })

    it('throws exception on non-existant account name', () => {
      expect(() => ws.getServiceFromAccountName('salto'))
        .toThrow(new UnknownAccountError('salto'))
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

describe('getElementFileNames', () => {
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
  const naclFileStoreOfInactive = mockDirStore(undefined, undefined, {
    'thirdFile.nacl': 'type salesforce.test is string {}',
  })

  beforeAll(async () => {
    workspace = await createWorkspace(
      naclFileStore,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        '': {
          naclFiles: createMockNaclFileSource([]),
        },
        default: {
          naclFiles: await naclFilesSource(
            'default',
            naclFileStore,
            mockStaticFilesSource(),
            persistentMockCreateRemoteMap(),
            true
          ),
          state: createState([]),
        },
        inactive: {
          naclFiles: await naclFilesSource(
            'inactive',
            naclFileStoreOfInactive,
            mockStaticFilesSource(),
            persistentMockCreateRemoteMap(),
            true
          ),
          state: createState([]),
        },
      },
    )
  })
  it('should return the correct elements to file names mapping', async () => {
    const res = await workspace.getElementFileNames()
    expect(Array.from(res.entries())).toEqual([
      ['salesforce.text', ['envs/default/firstFile.nacl']],
      ['salesforce.lead', ['envs/default/firstFile.nacl', 'envs/default/secondFile.nacl']],
      ['salesforce.hearing', ['envs/default/redHeringFile.nacl']],
    ])
  })

  it('should return the correct elements to file names mapping of inactive env', async () => {
    const res = await workspace.getElementFileNames('inactive')
    expect(Array.from(res.entries())).toEqual([
      ['salesforce.test', ['envs/inactive/thirdFile.nacl']],
    ])
  })
})

describe('non persistent workspace', () => {
  it('should not allow flush when the ws is non-persistent', async () => {
    const nonPWorkspace = await createWorkspace(undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, false)
    await expect(() => nonPWorkspace.flush()).rejects.toThrow()
  })
})

describe('stateOnly update', () => {
  let ws: Workspace

  const objectWithHiddenToAdd = new ObjectType({
    elemID: ElemID.fromFullName('salto.withhiddenToAdd'),
    annotationRefsOrTypes: {
      hidden: BuiltinTypes.HIDDEN_STRING,
      visible: BuiltinTypes.STRING,
    },
    annotations: {
      hidden: 'hidden',
      visible: 'visible',
    },
  })
  const hiddenInstToAdd = new InstanceElement('hiddenToAdd', objectWithHiddenToAdd, {
    key: 'value',
  }, [], {
    [INSTANCE_ANNOTATIONS.HIDDEN]: true,
  })

  const objectWithHiddenToModify = new ObjectType({
    elemID: ElemID.fromFullName('salto.withhiddenToModify'),
    annotationRefsOrTypes: {
      hidden: BuiltinTypes.HIDDEN_STRING,
      visible: BuiltinTypes.STRING,
    },
    annotations: {
      hidden: 'hidden',
      visible: 'visible',
    },
  })

  const hiddenInstToModify = new InstanceElement('hiddenToModify', objectWithHiddenToModify, {
    key: 'value',
  }, [], {
    [INSTANCE_ANNOTATIONS.HIDDEN]: true,
  })

  const objectWithHiddenToRemove = new ObjectType({
    elemID: ElemID.fromFullName('salto.withhiddenToRemove'),
    annotationRefsOrTypes: {
      hidden: BuiltinTypes.HIDDEN_STRING,
      visible: BuiltinTypes.STRING,
    },
    annotations: {
      hidden: 'hidden',
      visible: 'visible',
    },
  })

  const hiddenInstToRemove = new InstanceElement('hiddenToRemove', objectWithHiddenToRemove, {
    key: 'value',
  }, [], {
    [INSTANCE_ANNOTATIONS.HIDDEN]: true,
  })

  beforeAll(async () => {
    const state = mockState([
      objectWithHiddenToModify,
      objectWithHiddenToRemove,
      hiddenInstToModify,
      hiddenInstToRemove,
    ].map(e => e.clone()))
    const dirStore = mockDirStore([], false, {
      'salto/objwithhidden.nacl': `
        type salto.withhiddenToModify {
          annotations {
            hidden_string hidden {
            }
            string visible {
            }
          }
          visible = "visible"
        }
        type salto.withhiddenToRemove {
          annotations {
            hidden_string hidden {
            }
            string visible {
            }
          }
          visible = "visible"
        }
      `,
    })
    ws = await createWorkspace(dirStore, state)
    const changes: DetailedChange[] = [
      {
        action: 'add',
        data: {
          after: objectWithHiddenToAdd,
        },
        id: objectWithHiddenToAdd.elemID,
        path: ['salto', 'objwithhidden.nacl'],
      },
      {
        action: 'add',
        data: {
          after: hiddenInstToAdd,
        },
        id: hiddenInstToAdd.elemID,
        path: ['salto', 'inst.nacl'],
      },
      {
        action: 'modify',
        data: {
          before: 'hidden',
          after: 'changed',
        },
        id: objectWithHiddenToModify.elemID.createNestedID('attr', 'hidden'),
      },
      {
        action: 'modify',
        data: {
          before: 'visible',
          after: 'changed',
        },
        id: objectWithHiddenToModify.elemID.createNestedID('attr', 'visible'),
      },
      {
        action: 'modify',
        data: {
          before: 'value',
          after: 'changed',
        },
        id: hiddenInstToModify.elemID.createNestedID('key'),
      },
      {
        action: 'remove',
        data: {
          before: 'hidden',
        },
        id: objectWithHiddenToRemove.elemID.createNestedID('attr', 'hidden'),
      },
      {
        action: 'remove',
        data: {
          before: 'visible',
        },
        id: objectWithHiddenToRemove.elemID.createNestedID('attr', 'visible'),
      },
      {
        action: 'remove',
        data: {
          before: 'value',
        },
        id: hiddenInstToRemove.elemID.createNestedID('key'),
      },
    ]
    await ws.updateNaclFiles(changes, 'default', true)
  })

  it('should update add changes for state only elements in the workspace cache', async () => {
    const resElement = await ws.getValue(hiddenInstToAdd.elemID)
    expect(resElement).toBeDefined()
  })

  it('should not apply add chabges to the workspace for non hidden elements', async () => {
    const resElement = await ws.getValue(objectWithHiddenToAdd.elemID)
    expect(resElement).not.toBeDefined()
  })

  it('should update only the hidden parts modifications of elements that have a visible part in the workspace cache', async () => {
    const resElement = await ws.getValue(objectWithHiddenToModify.elemID)
    expect(resElement).toBeDefined()
    expect(resElement.annotations.hidden).toEqual('changed')
    expect(resElement.annotations.visible).not.toEqual('changed')
  })


  it('should update hidden elements modifications in the workspace cache', async () => {
    const resElement = await ws.getValue(hiddenInstToModify.elemID)
    expect(resElement).toBeDefined()
    expect(resElement.value.key).toEqual('changed')
  })

  it('should update remove changes for hidden types in the ws cache', async () => {
    const resElement = await ws.getValue(hiddenInstToRemove.elemID)
    expect(resElement).toBeDefined()
    expect(resElement.value.key).not.toBeDefined()
  })

  it('should update remove changes only for for hidden parts of elements with a visible part in the ws cache', async () => {
    const resElement = await ws.getValue(objectWithHiddenToRemove.elemID)
    expect(resElement).toBeDefined()
    expect(resElement.annotations.hidden).not.toBeDefined()
    expect(resElement.annotations.visible).toBeDefined()
  })
})
describe('listUnresolvedReferences', () => {
  let workspace: Workspace
  let res: UnresolvedElemIDs

  const createEnvElements = (): Element[] => {
    const type1 = new ObjectType({
      elemID: new ElemID('salesforce', 'someType'),
      fields: {
        f1: { refType: BuiltinTypes.NUMBER },
        f2: { refType: BuiltinTypes.NUMBER },
        f3: { refType: BuiltinTypes.NUMBER },
      },
    })
    const type2 = new ObjectType({
      elemID: new ElemID('salesforce', 'anotherType'),
      annotations: { _parent: new TypeReference(type1.elemID) },
      fields: {
        f1: { refType: type1 },
        f2: { refType: BuiltinTypes.NUMBER },
        f3: { refType: type1 },
      },
    })
    const inst1 = new InstanceElement(
      'inst1',
      new TypeReference(type1.elemID),
      {
        f1: 'aaa',
        f2: new ReferenceExpression(new ElemID('salesforce', 'someType', 'field', 'f3')),
        f3: 'ccc',
      },
    )
    const inst2 = new InstanceElement(
      'inst2',
      new TypeReference(type2.elemID),
      {
        f1: {
          f1: 'aaa',
          f2: 'bbb',
          f3: new ReferenceExpression(new ElemID('salesforce', 'someType', 'instance', 'inst1', 'f1')),
        },
        f3: new TypeReference(new ElemID('salesforce', 'someType', 'instance', 'inst1')),
      },
    )
    return [type1, type2, inst1, inst2]
  }

  const createNetsuiteEnvElements = (): Element[] => {
    const nsType = new ObjectType({
      elemID: new ElemID('netsuite', 'advancedpdftemplate'),
      fields: {
        scriptid: { refType: BuiltinTypes.STRING },
      },
    })
    const nsInstance1 = new InstanceElement(
      'custtmpl1',
      nsType,
      {
        scriptid: new ReferenceExpression(new ElemID('netsuite', 'advancedpdftemplate', 'instance', 'custtmpl2', 'scriptid')),
      }
    )
    const nsInstance2 = new InstanceElement(
      'custtmpl2',
      nsType,
      {
        scriptid: new ReferenceExpression(new ElemID('netsuite', 'advancedpdftemplate', 'instance', 'custtmpl3', 'scriptid')),
      }
    )
    const nsInstance3 = new InstanceElement(
      'custtmpl3',
      nsType,
      {
        scriptid: 'This is a scriptid',
      }
    )
    return [nsType, nsInstance1, nsInstance2, nsInstance3]
  }

  describe('workspace with no references', () => {
    beforeAll(async () => {
      const elements = createEnvElements().slice(0, 1)
      workspace = await createWorkspace(
        undefined, undefined, undefined, undefined, undefined, undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource(elements),
            state: createState(elements),
          },
          other: {
            naclFiles: createMockNaclFileSource(elements),
            state: createState(elements),
          },
        }
      )
      res = await workspace.listUnresolvedReferences()
    })

    it('should not find any unresolved references', async () => {
      expect(res.found).toHaveLength(0)
      expect(res.missing).toHaveLength(0)
    })
  })

  describe('workspace with resolved references', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const elements = createEnvElements()
      workspace = await createWorkspace(
        undefined, undefined, undefined, undefined, undefined, undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource(elements),
            state: createState(elements),
          },
          other: {
            naclFiles: createMockNaclFileSource(elements),
            state: createState(elements),
          },
        }
      )
      res = await workspace.listUnresolvedReferences('other')
    })

    it('should not find any unresolved references', () => {
      expect(res.found).toHaveLength(0)
      expect(res.missing).toHaveLength(0)
    })
  })

  describe('workspace with unresolved references and no complete-from env', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createEnvElements().slice(3)
      const otherElements = createEnvElements()
      workspace = await createWorkspace(
        undefined, undefined, undefined, undefined, undefined, undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource(defaultElements),
            state: createState(defaultElements),
          },
          other: {
            naclFiles: createMockNaclFileSource(otherElements),
            state: createState(otherElements),
          },
        }
      )
      res = await workspace.listUnresolvedReferences()
    })

    it('should not resolve any references', () => {
      expect(res.found).toHaveLength(0)
      expect(res.missing).toEqual([
        new ElemID('salesforce', 'someType', 'instance', 'inst1'),
      ])
    })
  })

  describe('workspace with unresolved references that exist in other env', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createEnvElements().slice(3)
      const otherElements = createEnvElements()
      workspace = await createWorkspace(
        undefined, undefined, mockWorkspaceConfigSource(undefined, true), undefined, undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource(defaultElements),
            state: createState(defaultElements),
          },
          inactive: {
            naclFiles: createMockNaclFileSource(otherElements),
            state: createState(otherElements),
          },
        }
      )
      res = await workspace.listUnresolvedReferences('inactive')
    })

    it('should successfully resolve all references', () => {
      expect(res.found).toEqual([
        new ElemID('salesforce', 'someType', 'field', 'f3'),
        new ElemID('salesforce', 'someType', 'instance', 'inst1'),
      ])
      expect(res.missing).toHaveLength(0)
    })
  })

  describe('workspace with unresolved references that exist in other env with circular references', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const type = new ObjectType({
        elemID: new ElemID('salesforce', 'someType'),
      })

      const instance1 = new InstanceElement(
        'instance1',
        type,
        {
          val: new ReferenceExpression(new ElemID('salesforce', 'someType', 'instance', 'instance2')),
        }
      )

      const instance2 = new InstanceElement(
        'instance2',
        type,
        {
          val: new ReferenceExpression(new ElemID('salesforce', 'someType', 'instance', 'instance3')),
        }
      )

      const instance3 = new InstanceElement(
        'instance3',
        type,
        {
          val: new ReferenceExpression(new ElemID('salesforce', 'someType', 'instance', 'instance2')),
        }
      )

      workspace = await createWorkspace(
        undefined, undefined, mockWorkspaceConfigSource(undefined, true), undefined, undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource([instance1]),
            state: createState([instance1]),
          },
          inactive: {
            naclFiles: createMockNaclFileSource([instance1, instance2, instance3]),
            state: createState([instance1, instance2, instance3]),
          },
        }
      )
      res = await workspace.listUnresolvedReferences('inactive')
    })

    it('should successfully resolve all references', () => {
      expect(res.found).toEqual([
        new ElemID('salesforce', 'someType', 'instance', 'instance2'),
        new ElemID('salesforce', 'someType', 'instance', 'instance3'),
      ])
      expect(res.missing).toHaveLength(0)
    })
  })

  describe('workspace with unresolved references that do not exist in other env', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createEnvElements() as InstanceElement[]
      defaultElements[3].value = {
        ...(defaultElements[3] as InstanceElement).value,
        f3: new ReferenceExpression(new ElemID('salesforce', 'unresolved')),
      }
      const otherElements = createEnvElements().slice(1)
      workspace = await createWorkspace(
        undefined, undefined, mockWorkspaceConfigSource(undefined, true), undefined, undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource(defaultElements),
            state: createState(defaultElements),
          },
          inactive: {
            naclFiles: createMockNaclFileSource(otherElements),
            state: createState(otherElements),
          },
        }
      )
      res = await workspace.listUnresolvedReferences('inactive')
    })

    it('should resolve some of the references', () => {
      expect(res.found).toHaveLength(0)
      expect(res.missing).toEqual([
        new ElemID('salesforce', 'unresolved'),
      ])
    })
  })

  describe('workspace with unresolved value reference which lead to not exist unresolved reference in another env', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createEnvElements().slice(3) as InstanceElement[]
      const otherElements = createEnvElements().slice(1)
      workspace = await createWorkspace(
        undefined, undefined, mockWorkspaceConfigSource(undefined, true), undefined, undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource(defaultElements),
            state: createState(defaultElements),
          },
          inactive: {
            naclFiles: createMockNaclFileSource(otherElements),
            state: createState(otherElements),
          },
        }
      )
      res = await workspace.listUnresolvedReferences('inactive')
    })

    it('should return the instance of the unresolved reference, although the reference is a value', () => {
      expect(res.found).toEqual([
        new ElemID('salesforce', 'someType', 'instance', 'inst1'),
      ])
    })
    it('should mark the missing unresolved reference in the redirected env', () => {
      expect(res.missing).toEqual([
        new ElemID('salesforce', 'someType', 'field', 'f3'),
      ])
    })
  })

  describe('workspace with unresolved non-element reference which lead to unresolved non-element reference', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createNetsuiteEnvElements().slice(0, 2)
      const otherElements = createNetsuiteEnvElements()
      workspace = await createWorkspace(
        undefined, undefined, mockWorkspaceConfigSource(undefined, true), undefined, undefined,
        undefined,
        {
          '': {
            naclFiles: await naclFilesSource(
              COMMON_ENV_PREFIX,
              mockDirStore(),
              mockStaticFilesSource(),
              persistentMockCreateRemoteMap(),
              true
            ),
          },
          default: {
            naclFiles: createMockNaclFileSource(defaultElements),
            state: createState(defaultElements),
          },
          inactive: {
            naclFiles: createMockNaclFileSource(otherElements),
            state: createState(otherElements),
          },
        }
      )
      res = await workspace.listUnresolvedReferences('inactive')
    })

    it('should return the instance of the unresolved reference, although the reference is a value', () => {
      expect(res.found).toEqual([
        new ElemID('netsuite', 'advancedpdftemplate', 'instance', 'custtmpl2'),
        new ElemID('netsuite', 'advancedpdftemplate', 'instance', 'custtmpl3'),
      ])
    })
    it('should mark the missing unresolved reference in the redirected env', () => {
      expect(res.missing).toHaveLength(0)
    })
  })
})

describe('isValidEnvName', () => {
  it('should be valid env names', () => {
    expect(isValidEnvName('Production')).toEqual(true)
    expect(isValidEnvName('legit env name')).toEqual(true)
    expect(isValidEnvName('My Amazing production!!')).toEqual(true)
    expect(isValidEnvName('Prod 22.02.2022')).toEqual(true)
    expect(isValidEnvName('Salto_2-UAT')).toEqual(true)
  })
  it('should not be valid env name', () => {
    expect(isValidEnvName('why?')).toEqual(false)
    expect(isValidEnvName('no:pe')).toEqual(false)
    expect(isValidEnvName('100%')).toEqual(false)
    expect(isValidEnvName('created at 24/02/2022')).toEqual(false)
  })
})

describe('update nacl files with invalid state cache', () => {
  let workspace: Workspace
  beforeAll(async () => {
    const dirStore = mockDirStore()
    const changes: DetailedChange[] = [
      {
        action: 'remove',
        id: ElemID.fromFullName('salesforce.ObjWithFieldTypeWithHidden'),
        data: {
          before: new ObjectType({
            elemID: ElemID.fromFullName('salesforce.ObjWithFieldTypeWithHidden'),
          }),
        },
      },
    ]
    workspace = await createWorkspace(dirStore)
    const state = workspace.state()
    await state.setHash('XXX')
    await workspace.updateNaclFiles(changes)
  })

  it('should not have the hidden parts of the removed element', async () => {
    expect(await workspace.getValue(ElemID.fromFullName('salesforce.ObjWithFieldTypeWithHidden')))
      .not.toBeDefined()
  })
})

describe('nacl sources reuse', () => {
  let mockMuiltiEnv: jest.SpyInstance
  let elementSources: Record<string, EnvironmentSource>
  let ws: Workspace

  beforeAll(() => {
    mockMuiltiEnv = jest.spyOn(multiEnvSrcLib, 'multiEnvSource')
  })
  beforeEach(async () => {
    mockMuiltiEnv.mockClear()
    elementSources = {
      '': {
        naclFiles: createMockNaclFileSource([]),
      },
      default: {
        naclFiles: createMockNaclFileSource([]),
        state: createState([], true),
      },
      inactive: {
        naclFiles: createMockNaclFileSource([]),
        state: createState([], true),
      },
    }
    ws = await createWorkspace(undefined, undefined, mockWorkspaceConfigSource(undefined, true),
      undefined, undefined, undefined, elementSources)
  })
  afterAll(() => {
    mockMuiltiEnv.mockReset()
  })

  it('should create only one copy the multi env source', async () => {
    await ws.flush()
    expect(mockMuiltiEnv).toHaveBeenCalledTimes(1)
  })

  it('should not create a new copy of a secondary env when invoking a command directly on the secondary env', async () => {
    await ws.elements(true, 'inactive')
    expect(mockMuiltiEnv).toHaveBeenCalledTimes(1)
  })
})
