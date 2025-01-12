/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, Element, ElemID, InstanceElement, ObjectType, SaltoError, Value } from '@salto-io/adapter-api'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import * as workspace from '@salto-io/workspace'
import { elementSource, errors as wsErrors, staticFiles } from '@salto-io/workspace'
import { mockState } from './state'

type AdaptersConfigSource = workspace.adaptersConfigSource.AdaptersConfigSource

const mockService = 'salto'
const emptyMockService = 'salto2'

export const ACCOUNTS = [mockService, emptyMockService]

export const configID = new ElemID(mockService)
export const emptyConfigID = new ElemID(emptyMockService)
export const mockConfigType = new ObjectType({
  elemID: configID,
  fields: {
    username: { refType: BuiltinTypes.STRING },
    password: { refType: BuiltinTypes.STRING },
    token: { refType: BuiltinTypes.STRING },
    sandbox: { refType: BuiltinTypes.BOOLEAN },
  },
})

export const mockEmptyConfigType = new ObjectType({
  elemID: emptyConfigID,
  fields: {
    username: { refType: BuiltinTypes.STRING },
    password: { refType: BuiltinTypes.STRING },
    token: { refType: BuiltinTypes.STRING },
    sandbox: { refType: BuiltinTypes.BOOLEAN },
  },
})

export const mockConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, {
  username: 'test@test',
  password: 'test',
  token: 'test',
  sandbox: false,
})

const mockEmptyConfigInstance = new InstanceElement(ElemID.CONFIG_NAME, mockEmptyConfigType, {
  username: 'test@test',
  password: 'test',
  token: 'test',
  sandbox: false,
})

export const mockErrors = (errors: SaltoError[]): wsErrors.Errors =>
  new wsErrors.Errors({
    parse: [],
    merge: [],
    validation: errors.map(err => ({ elemID: new ElemID('test'), error: err.message, ...err })),
  })

export const mockWorkspace = ({
  elements = [],
  elementsWithoutHidden = [],
  name = undefined,
  index = [],
  stateElements = undefined,
  accounts = ACCOUNTS,
  errors = [],
  accountConfigs = {},
  accountToServiceName = {},
  parsedNaclFiles = {},
  staticFilesSource = undefined,
}: {
  elements?: Element[]
  elementsWithoutHidden?: Element[]
  name?: string
  index?: workspace.remoteMap.RemoteMapEntry<workspace.pathIndex.Path[]>[]
  stateElements?: Element[]
  accounts?: string[]
  errors?: SaltoError[]
  accountConfigs?: Record<string, InstanceElement>
  getValue?: Promise<Value | undefined>
  accountToServiceName?: Record<string, string>
  parsedNaclFiles?: Record<string, Element[]>
  staticFilesSource?: staticFiles.StaticFilesSource
}): workspace.Workspace => {
  const elementIDtoFileMap = Object.entries(parsedNaclFiles).reduce(
    (acc, entry) => {
      const [filename, elems] = entry
      elems.forEach(elem => {
        const key = elem.elemID.getFullName()
        acc[key] = acc[key] || []
        acc[key].push(filename)
      })
      return acc
    },
    {} as Record<string, string[]>,
  )
  const state = mockState(ACCOUNTS, stateElements || elements, index)
  return {
    elements: jest
      .fn()
      .mockImplementation(async (includeHidden = true) =>
        elementSource.createInMemoryElementSource(includeHidden ? elements : elementsWithoutHidden),
      ),
    name,
    envs: () => ['default'],
    currentEnv: () => 'default',
    services: () => accounts,
    accounts: () => accounts,
    state: jest.fn().mockReturnValue(state),
    updateNaclFiles: jest.fn(),
    flush: jest.fn(),
    accountCredentials: jest.fn().mockResolvedValue({
      [mockService]: mockConfigInstance,
      [emptyMockService]: mockEmptyConfigInstance,
    }),
    accountConfig: (accountName: string) => accountConfigs[accountName],
    getWorkspaceErrors: jest.fn().mockResolvedValue(errors),
    getServiceFromAccountName: (account: string) => accountToServiceName[account] ?? account,
    addService: jest.fn(),
    updateServiceCredentials: jest.fn(),
    updateServiceConfig: jest.fn(),
    getReferenceSourcesIndex: mockFunction<workspace.Workspace['getReferenceSourcesIndex']>(),
    getReferenceTargetsIndex: mockFunction<workspace.Workspace['getReferenceSourcesIndex']>(),
    addAccount: jest.fn(),
    updateAccountCredentials: jest.fn(),
    updateAccountConfig: jest.fn(),
    clear: jest.fn(),
    getElementIdsBySelectors: jest.fn(),
    errors: jest.fn().mockImplementation(() => mockErrors(errors)),
    hasErrors: () => errors.length > 0,
    getValue: async (id: ElemID) => elements.find(e => e.elemID.getFullName() === id.getFullName()),
    getElementNaclFiles: async (id: ElemID) => elementIDtoFileMap[id.getFullName()] ?? [],
    getParsedNaclFile: async (filename: string) => ({
      elements: async () => parsedNaclFiles[filename],
    }),
    getStaticFile: ({
      filepath,
      encoding,
      isTemplate,
      hash,
    }: {
      filepath: string
      encoding: BufferEncoding
      isTemplate?: boolean
      hash?: string
    }) => (staticFilesSource ? staticFilesSource.getStaticFile({ filepath, encoding, isTemplate, hash }) : undefined),
  } as unknown as workspace.Workspace
}

export const mockAdaptersConfigSource = (): MockInterface<AdaptersConfigSource> => {
  const adapters: Record<string, InstanceElement> = {}

  const getAdapter = async (adapterName: string): Promise<InstanceElement | undefined> => adapters[adapterName]
  const setAdapter = async (
    accountName: string,
    _adapterName: string,
    config: Readonly<InstanceElement> | Readonly<InstanceElement>[],
  ): Promise<void> => {
    if (!Array.isArray(config)) {
      adapters[accountName] = config as InstanceElement
    }
  }

  return {
    getAdapter: mockFunction<AdaptersConfigSource['getAdapter']>().mockImplementation(getAdapter),
    setAdapter: mockFunction<AdaptersConfigSource['setAdapter']>().mockImplementation(setAdapter),
    getElementNaclFiles: mockFunction<AdaptersConfigSource['getElementNaclFiles']>(),
    getErrors: mockFunction<AdaptersConfigSource['getErrors']>().mockResolvedValue(
      new workspace.errors.Errors({
        parse: [],
        validation: [],
        merge: [],
      }),
    ),
    getSourceRanges: mockFunction<AdaptersConfigSource['getSourceRanges']>().mockResolvedValue([]),
    getNaclFile: mockFunction<AdaptersConfigSource['getNaclFile']>(),
    setNaclFiles: mockFunction<AdaptersConfigSource['setNaclFiles']>(),
    flush: mockFunction<AdaptersConfigSource['flush']>(),
    getElements: mockFunction<AdaptersConfigSource['getElements']>(),
    getParsedNaclFile: mockFunction<AdaptersConfigSource['getParsedNaclFile']>(),
    getSourceMap: mockFunction<AdaptersConfigSource['getSourceMap']>(),
    listNaclFiles: mockFunction<AdaptersConfigSource['listNaclFiles']>(),
    isConfigFile: mockFunction<AdaptersConfigSource['isConfigFile']>(),
  }
}
