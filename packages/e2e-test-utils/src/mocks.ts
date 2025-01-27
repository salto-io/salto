/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  elementSource,
  errors as wsErrors,
  pathIndex,
  remoteMap,
  state as wsState,
  staticFiles,
  Workspace,
} from '@salto-io/workspace'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { parser } from '@salto-io/parser'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRefToElmWithValue,
  Element,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  SaltoError,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'

const { InMemoryRemoteMap } = remoteMap
const { createInMemoryElementSource } = elementSource
const { awu } = collections.asynciterable

type MockWorkspaceArgs = {
  uid?: string
  envs?: string[]
  accounts?: string[]
  getElements?: () => Element[]
}

export const elements = (): Element[] => {
  const addrElemID = new ElemID('salto', 'address')
  const saltoAddr = new ObjectType({
    elemID: addrElemID,
    fields: {
      country: { refType: BuiltinTypes.STRING },
      city: { refType: BuiltinTypes.STRING },
    },
  })
  saltoAddr.annotationRefTypes.label = createRefToElmWithValue(BuiltinTypes.STRING)

  const officeElemID = new ElemID('salto', 'office')
  const saltoOffice = new ObjectType({
    elemID: officeElemID,
    fields: {
      name: { refType: BuiltinTypes.STRING },
      location: {
        refType: saltoAddr,
        annotations: {
          label: 'Office Location',
          description: 'A location of an office',
        },
      },
    },
    annotations: {
      description: 'Office type in salto',
    },
  })
  saltoOffice.annotationRefTypes.label = createRefToElmWithValue(BuiltinTypes.STRING)

  const employeeElemID = new ElemID('salto', 'employee')
  const saltoEmployee = new ObjectType({
    elemID: employeeElemID,
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
        annotations: { _required: true },
      },
      nicknames: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {},
      },
      company: {
        refType: BuiltinTypes.STRING,
        annotations: { _default: 'salto' },
      },
      office: {
        refType: saltoOffice,
        annotations: {
          label: 'Based In',
          name: {
            [CORE_ANNOTATIONS.DEFAULT]: 'HQ',
          },
          location: {
            country: {
              [CORE_ANNOTATIONS.DEFAULT]: 'IL',
            },
            city: {
              [CORE_ANNOTATIONS.DEFAULT]: 'Raanana',
            },
          },
        },
      },
    },
  })

  const saltoEmployeeInstance = new InstanceElement('test', saltoEmployee, {
    name: 'FirstEmployee',
    nicknames: ['you', 'hi'],
    office: { label: 'bla', name: 'foo' },
  })
  return [BuiltinTypes.STRING, saltoAddr, saltoOffice, saltoEmployee, saltoEmployeeInstance]
}

// Mock interface does not handle template functions well
export type MockWorkspace = MockInterface<Omit<Workspace, 'transformToWorkspaceError'>> &
  Pick<Workspace, 'transformToWorkspaceError'>

export const mockErrors = (errors: SaltoError[]): wsErrors.Errors =>
  new wsErrors.Errors({
    parse: [],
    merge: [],
    validation: errors.map(err => ({ elemID: new ElemID('test'), error: err.message, ...err })),
  })

export const mockStateStaticFilesSource = (): MockInterface<staticFiles.StateStaticFilesSource> => ({
  persistStaticFile: mockFunction<staticFiles.StateStaticFilesSource['persistStaticFile']>(),
  getStaticFile: mockFunction<staticFiles.StateStaticFilesSource['getStaticFile']>(),
  clear: mockFunction<staticFiles.StateStaticFilesSource['clear']>(),
  rename: mockFunction<staticFiles.StateStaticFilesSource['rename']>(),
  delete: mockFunction<staticFiles.StateStaticFilesSource['delete']>(),
  flush: mockFunction<staticFiles.StateStaticFilesSource['flush']>(),
})

export const mockWorkspace = ({
  uid = '123',
  envs = ['active', 'inactive'],
  accounts = ['salesforce', 'netsuite'],
  getElements = elements,
}: MockWorkspaceArgs): MockWorkspace => {
  const mockStateData = async (): Promise<wsState.StateData> => ({
    elements: createInMemoryElementSource(getElements()),
    pathIndex: new InMemoryRemoteMap<pathIndex.Path[]>(),
    topLevelPathIndex: new InMemoryRemoteMap<pathIndex.Path[]>(),
    accounts: new InMemoryRemoteMap([{ key: 'account_names', value: accounts }]),
    saltoMetadata: new InMemoryRemoteMap(),
    staticFilesSource: mockStateStaticFilesSource(),
    deprecated: {
      accountsUpdateDate: new InMemoryRemoteMap<Date>(),
    },
  })
  const stateByEnv = Object.fromEntries(envs.map(env => [env, wsState.buildInMemState(mockStateData)]))
  let currentEnv = envs[0]
  return {
    uid,
    elements: mockFunction<Workspace['elements']>().mockResolvedValue(createInMemoryElementSource(getElements())),
    state: mockFunction<Workspace['state']>().mockImplementation(env => stateByEnv[env ?? currentEnv]),
    envs: mockFunction<Workspace['envs']>().mockReturnValue(envs),
    currentEnv: mockFunction<Workspace['currentEnv']>().mockImplementation(() => currentEnv),
    accounts: mockFunction<Workspace['accounts']>().mockReturnValue(accounts),
    services: mockFunction<Workspace['services']>().mockReturnValue(accounts),
    close: mockFunction<Workspace['close']>().mockResolvedValue(),
    accountCredentials: mockFunction<Workspace['accountCredentials']>().mockResolvedValue({}),
    servicesCredentials: mockFunction<Workspace['servicesCredentials']>().mockResolvedValue({}),
    accountConfig: mockFunction<Workspace['accountConfig']>().mockResolvedValue(undefined),
    serviceConfig: mockFunction<Workspace['serviceConfig']>().mockResolvedValue(undefined),
    accountConfigPaths: mockFunction<Workspace['accountConfigPaths']>().mockResolvedValue([]),
    serviceConfigPaths: mockFunction<Workspace['serviceConfigPaths']>().mockResolvedValue([]),
    isEmpty: mockFunction<Workspace['isEmpty']>().mockResolvedValue(false),
    hasElementsInAccounts: mockFunction<Workspace['hasElementsInAccounts']>().mockResolvedValue(true),
    hasElementsInServices: mockFunction<Workspace['hasElementsInServices']>().mockResolvedValue(true),
    hasElementsInEnv: mockFunction<Workspace['hasElementsInEnv']>().mockResolvedValue(false),
    envOfFile: mockFunction<Workspace['envOfFile']>().mockReturnValue(''),
    hasErrors: mockFunction<Workspace['hasErrors']>().mockResolvedValue(false),
    errors: mockFunction<Workspace['errors']>().mockResolvedValue(mockErrors([])),
    transformToWorkspaceError: mockFunction<Workspace['transformToWorkspaceError']>().mockImplementation(
      async error => ({ ...error, sourceLocations: [] }),
    ) as Workspace['transformToWorkspaceError'],
    transformError: mockFunction<Workspace['transformError']>().mockImplementation(async error => ({
      ...error,
      sourceLocations: [],
    })),
    updateNaclFiles: mockFunction<Workspace['updateNaclFiles']>().mockResolvedValue({
      naclFilesChangesCount: 0,
      stateOnlyChangesCount: 0,
    }),
    listNaclFiles: mockFunction<Workspace['listNaclFiles']>().mockResolvedValue([]),
    getTotalSize: mockFunction<Workspace['getTotalSize']>().mockResolvedValue(0),
    getNaclFile: mockFunction<Workspace['getNaclFile']>(),
    setNaclFiles: mockFunction<Workspace['setNaclFiles']>(),
    removeNaclFiles: mockFunction<Workspace['removeNaclFiles']>(),
    getServiceFromAccountName: mockFunction<Workspace['getServiceFromAccountName']>().mockImplementation(
      account => account,
    ),
    getSourceMap: mockFunction<Workspace['getSourceMap']>().mockResolvedValue(new parser.SourceMap()),
    getSourceRanges: mockFunction<Workspace['getSourceRanges']>().mockResolvedValue([]),
    getReferenceSourcesIndex: mockFunction<Workspace['getReferenceSourcesIndex']>(),
    getElementOutgoingReferences: mockFunction<Workspace['getElementOutgoingReferences']>().mockResolvedValue([]),
    getElementIncomingReferences: mockFunction<Workspace['getElementIncomingReferences']>().mockResolvedValue([]),
    getElementIncomingReferenceInfos: mockFunction<Workspace['getElementIncomingReferenceInfos']>().mockResolvedValue(
      [],
    ),
    getElementAuthorInformation: mockFunction<Workspace['getElementAuthorInformation']>().mockResolvedValue({}),
    getElementsAuthorsById: mockFunction<Workspace['getElementsAuthorsById']>().mockResolvedValue({}),
    getElementNaclFiles: mockFunction<Workspace['getElementNaclFiles']>().mockResolvedValue([]),
    getElementIdsBySelectors: mockFunction<Workspace['getElementIdsBySelectors']>().mockResolvedValue(awu([])),
    getParsedNaclFile: mockFunction<Workspace['getParsedNaclFile']>(),
    flush: mockFunction<Workspace['flush']>(),
    clone: mockFunction<Workspace['clone']>(),
    clear: mockFunction<Workspace['clear']>(),
    addAccount: mockFunction<Workspace['addAccount']>(),
    addService: mockFunction<Workspace['addService']>(),
    addEnvironment: mockFunction<Workspace['addEnvironment']>(),
    deleteEnvironment: mockFunction<Workspace['deleteEnvironment']>(),
    renameEnvironment: mockFunction<Workspace['renameEnvironment']>(),
    setCurrentEnv: mockFunction<Workspace['setCurrentEnv']>().mockImplementation(async env => {
      currentEnv = env
    }),
    updateAccountCredentials: mockFunction<Workspace['updateAccountCredentials']>(),
    updateServiceCredentials: mockFunction<Workspace['updateServiceCredentials']>(),
    updateAccountConfig: mockFunction<Workspace['updateAccountConfig']>(),
    updateServiceConfig: mockFunction<Workspace['updateServiceConfig']>(),

    getAllChangedByAuthors: mockFunction<Workspace['getAllChangedByAuthors']>(),
    getChangedElementsByAuthors: mockFunction<Workspace['getChangedElementsByAuthors']>(),
    promote: mockFunction<Workspace['promote']>(),
    demote: mockFunction<Workspace['demote']>(),
    demoteAll: mockFunction<Workspace['demoteAll']>(),
    copyTo: mockFunction<Workspace['copyTo']>(),
    sync: mockFunction<Workspace['sync']>(),
    updateStateProvider: mockFunction<Workspace['updateStateProvider']>(),
    getValue: mockFunction<Workspace['getValue']>(),
    getSearchableNames: mockFunction<Workspace['getSearchableNames']>(),
    getSearchableNamesOfEnv: mockFunction<Workspace['getSearchableNamesOfEnv']>(),
    listUnresolvedReferences: mockFunction<Workspace['listUnresolvedReferences']>(),
    getElementSourceOfPath: mockFunction<Workspace['getElementSourceOfPath']>(),
    getFileEnvs: mockFunction<Workspace['getFileEnvs']>(),
    getStaticFile: mockFunction<Workspace['getStaticFile']>(),
    getElementFileNames: mockFunction<Workspace['getElementFileNames']>(),
    getChangedElementsBetween: mockFunction<Workspace['getChangedElementsBetween']>(),
    getAliases: mockFunction<Workspace['getAliases']>(),
    getStaticFilePathsByElemIds: mockFunction<Workspace['getStaticFilePathsByElemIds']>(),
    isChangedAtIndexEmpty: mockFunction<Workspace['isChangedAtIndexEmpty']>(),
    getElemIdsByStaticFilePaths: mockFunction<Workspace['getElemIdsByStaticFilePaths']>(),
  }
}
