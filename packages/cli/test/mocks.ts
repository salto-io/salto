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
import wu from 'wu'
import _ from 'lodash'
import { DataNodeMap, Group } from '@salto-io/dag'
import {
  BuiltinTypes, Change, Element, ElemID, getChangeData, InstanceElement,
  ObjectType, CORE_ANNOTATIONS, SaltoError, Values, ListType, DetailedChange,
  AdapterAuthentication, OAuthRequestParameters, OauthAccessTokenResponse,
  createRefToElmWithValue,
  StaticFile,
} from '@salto-io/adapter-api'
import {
  Plan, PlanItem, EVENT_TYPES, DeployResult,
  telemetrySender, Telemetry, Tags, TelemetryEvent, CommandConfig,
} from '@salto-io/core'
import { Workspace, errors as wsErrors, state as wsState, parser, remoteMap, elementSource, pathIndex, staticFiles } from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import realCli from '../src/cli'
import commandDefinitions from '../src/commands/index'
import { CommandOrGroupDef, CommandArgs } from '../src/command_builder'
import { Spinner, SpinnerCreator } from '../src/types'
import { getCliTelemetry } from '../src/telemetry'
import { version as currentVersion } from '../src/generated/version.json'

const { InMemoryRemoteMap } = remoteMap
const { createInMemoryElementSource } = elementSource
const { awu } = collections.asynciterable

export interface MockWriteStreamOpts { isTTY?: boolean; hasColors?: boolean }

export class MockWriteStream {
  constructor({ isTTY = true, hasColors = true }: MockWriteStreamOpts = {}) {
    this.isTTY = isTTY
    this.colors = hasColors
  }

  content = ''
  colors: boolean
  isTTY: boolean

  write(s: string): void { this.content += s }
}

export type MockCliOutput = {
  stdout: MockWriteStream
  stderr: MockWriteStream
}

export const mockSpinnerCreator = (spinners: Spinner[]): SpinnerCreator => jest.fn(() => {
  const result = {
    succeed: jest.fn(),
    fail: jest.fn(),
  }
  spinners.push(result)
  return result
})

export interface MockCliReturn {
  err: string
  out: string
  exitCode: number
}

export type MockTelemetry = {
  getEvents(): TelemetryEvent[]
  getEventsMap(): { [name: string]: TelemetryEvent[] }
} & Telemetry

export const getMockTelemetry = (): MockTelemetry => {
  const commonTags = { installationID: '1234', app: 'test' }
  const telemetry = telemetrySender(
    { url: '', enabled: false, token: '' },
    commonTags
  )
  const events: TelemetryEvent[] = []
  telemetry.sendCountEvent = async (
    name: string,
    value: number,
    tags: Tags = {},
  ): Promise<void> => {
    events.push({
      name,
      value,
      tags: { ...tags, ...commonTags },
      type: EVENT_TYPES.COUNTER,
      timestamp: '',
    })
  }

  return Object.assign(telemetry, {
    getEvents: (): TelemetryEvent[] => events,
    getEventsMap: (): { [name: string]: TelemetryEvent[] } => (
      _(events).groupBy(e => e.name).value()
    ),
  })
}

const getMockCommandConfig = (): CommandConfig => ({
  shouldCalcTotalSize: true,
})

export type MockCliArgs = {
  telemetry: MockTelemetry
  config: CommandConfig
  output: MockCliOutput
  spinnerCreator: SpinnerCreator
}
export const mockCliArgs = (): MockCliArgs => ({
  telemetry: getMockTelemetry(),
  config: getMockCommandConfig(),
  output: { stdout: new MockWriteStream(), stderr: new MockWriteStream() },
  spinnerCreator: mockSpinnerCreator([]),
})

export type MockCommandArgs = Omit<CommandArgs, 'workspacePath'>
export const mockCliCommandArgs = (commandName: string, cliArgs?: MockCliArgs): MockCommandArgs => {
  const { telemetry, config, output, spinnerCreator } = cliArgs ?? mockCliArgs()
  return {
    cliTelemetry: getCliTelemetry(telemetry, commandName),
    config,
    output,
    spinnerCreator,
  }
}

export const cli = async ({
  commandDefs = commandDefinitions,
  args = [],
  out = {},
  err = {},
}: {
  commandDefs?: CommandOrGroupDef[]
  args?: string[]
  out?: MockWriteStreamOpts
  err?: MockWriteStreamOpts
} = {}): Promise<MockCliReturn> => {
  const input = {
    args,
    stdin: {},
    telemetry: getMockTelemetry(),
    config: getMockCommandConfig(),
  }

  const output = {
    stderr: new MockWriteStream(err),
    stdout: new MockWriteStream(out),
  }
  const spinners: Spinner[] = []
  const spinnerCreator = mockSpinnerCreator(spinners)

  const exitCode = await realCli({ input, output, commandDefs, spinnerCreator, workspacePath: '.' })
  await Promise.all([
    input.telemetry.stop(1000),
    logger.end(),
  ])

  return { err: output.stderr.content, out: output.stdout.content, exitCode }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createMockGetCredentialsFromUser = (value: Values) =>
  jest.fn(async (configObjType: ObjectType): Promise<InstanceElement> =>
    new InstanceElement(ElemID.CONFIG_NAME, configObjType, value))

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

  const saltoEmployeeInstance = new InstanceElement(
    'test', saltoEmployee,
    { name: 'FirstEmployee', nicknames: ['you', 'hi'], office: { label: 'bla', name: 'foo' } }
  )
  return [BuiltinTypes.STRING, saltoAddr, saltoOffice, saltoEmployee, saltoEmployeeInstance]
}

export const mockErrors = (errors: SaltoError[]): wsErrors.Errors => new wsErrors.Errors({
  parse: [],
  merge: [],
  validation: errors.map(err => ({ elemID: new ElemID('test'), error: err.message, ...err })),
})

// Mock interface does not handle template functions well
export type MockWorkspace = MockInterface<Omit<Workspace, 'transformToWorkspaceError'>>
  & Pick<Workspace, 'transformToWorkspaceError'>

export const withoutEnvironmentParam = 'active'
export const withEnvironmentParam = 'inactive'

type MockWorkspaceArgs = {
  uid?: string
  name?: string
  envs?: string[]
  accounts?: string[]
  getElements?: () => Element[]
}

export const mockStateStaticFilesSource = ()
: MockInterface<staticFiles.StateStaticFilesSource> => ({
  persistStaticFile: mockFunction<staticFiles.StateStaticFilesSource['persistStaticFile']>(),
  getStaticFile: mockFunction<staticFiles.StateStaticFilesSource['getStaticFile']>(),
  clear: mockFunction<staticFiles.StateStaticFilesSource['clear']>(),
  rename: mockFunction<staticFiles.StateStaticFilesSource['rename']>(),
  delete: mockFunction<staticFiles.StateStaticFilesSource['delete']>(),
  flush: mockFunction<staticFiles.StateStaticFilesSource['flush']>(),
})


export const mockWorkspace = ({
  uid = '123',
  name = '',
  envs = ['active', 'inactive'],
  accounts = ['salesforce', 'netsuite'],
  getElements = elements,
}: MockWorkspaceArgs): MockWorkspace => {
  const mockStateData = async (): Promise<wsState.StateData> => ({
    elements: createInMemoryElementSource(getElements()),
    pathIndex: new InMemoryRemoteMap<pathIndex.Path[]>(),
    accountsUpdateDate: new InMemoryRemoteMap(),
    saltoMetadata: new InMemoryRemoteMap([
      { key: 'version', value: currentVersion },
    ] as {key: wsState.StateMetadataKey; value: string}[]),
    staticFilesSource: mockStateStaticFilesSource(),
  })
  const stateByEnv = Object.fromEntries(
    envs.map(env => [env, wsState.buildInMemState(mockStateData)])
  )
  let currentEnv = envs[0]
  return {
    uid,
    name,
    elements: mockFunction<Workspace['elements']>().mockResolvedValue(
      createInMemoryElementSource(getElements())
    ),
    state: mockFunction<Workspace['state']>().mockImplementation(env => stateByEnv[env ?? currentEnv]),
    envs: mockFunction<Workspace['envs']>().mockReturnValue(envs),
    currentEnv: mockFunction<Workspace['currentEnv']>().mockImplementation(() => currentEnv),
    accounts: mockFunction<Workspace['accounts']>().mockReturnValue(accounts),
    services: mockFunction<Workspace['services']>().mockReturnValue(accounts),
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
      async error => ({ ...error, sourceLocations: [] })
    ) as Workspace['transformToWorkspaceError'],
    transformError: mockFunction<Workspace['transformError']>().mockImplementation(
      async error => ({ ...error, sourceLocations: [] })
    ),
    updateNaclFiles: mockFunction<Workspace['updateNaclFiles']>().mockResolvedValue({
      naclFilesChangesCount: 0,
      stateOnlyChangesCount: 0,
    }),
    listNaclFiles: mockFunction<Workspace['listNaclFiles']>().mockResolvedValue([]),
    getTotalSize: mockFunction<Workspace['getTotalSize']>().mockResolvedValue(0),
    getNaclFile: mockFunction<Workspace['getNaclFile']>(),
    setNaclFiles: mockFunction<Workspace['setNaclFiles']>(),
    removeNaclFiles: mockFunction<Workspace['removeNaclFiles']>(),
    getServiceFromAccountName: mockFunction<Workspace['getServiceFromAccountName']>()
      .mockImplementation(account => account),
    getSourceMap: mockFunction<Workspace['getSourceMap']>().mockResolvedValue(new parser.SourceMap()),
    getSourceRanges: mockFunction<Workspace['getSourceRanges']>().mockResolvedValue([]),
    getElementReferencedFiles: mockFunction<Workspace['getElementReferencedFiles']>().mockResolvedValue([]),
    getReferenceSourcesIndex: mockFunction<Workspace['getReferenceSourcesIndex']>(),
    getReferenceTargetsIndex: mockFunction<Workspace['getReferenceTargetsIndex']>(),
    getElementOutgoingReferences: mockFunction<Workspace['getElementOutgoingReferences']>().mockResolvedValue([]),
    getElementIncomingReferences: mockFunction<Workspace['getElementIncomingReferences']>().mockResolvedValue([]),
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
    setCurrentEnv: mockFunction<Workspace['setCurrentEnv']>().mockImplementation(async env => { currentEnv = env }),
    updateAccountCredentials: mockFunction<Workspace['updateAccountCredentials']>(),
    updateServiceCredentials: mockFunction<Workspace['updateServiceCredentials']>(),
    updateAccountConfig: mockFunction<Workspace['updateAccountConfig']>(),
    updateServiceConfig: mockFunction<Workspace['updateServiceConfig']>(),
    getStateRecency: mockFunction<Workspace['getStateRecency']>().mockImplementation(
      async accountName => ({
        serviceName: accountName,
        accountName,
        status: 'Nonexistent',
        date: undefined,
      })
    ),
    getAllChangedByAuthors: mockFunction<Workspace['getAllChangedByAuthors']>(),
    getChangedElementsByAuthors: mockFunction<Workspace['getChangedElementsByAuthors']>(),
    promote: mockFunction<Workspace['promote']>(),
    demote: mockFunction<Workspace['demote']>(),
    demoteAll: mockFunction<Workspace['demoteAll']>(),
    copyTo: mockFunction<Workspace['copyTo']>(),
    sync: mockFunction<Workspace['sync']>(),
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

export const mockCredentialsType = (adapterName: string): AdapterAuthentication => {
  const configID = new ElemID(adapterName)
  return { basic: { credentialsType: new ObjectType({
    elemID: configID,
    fields: {
      username: { refType: BuiltinTypes.STRING },
      password: { refType: BuiltinTypes.STRING },
      token: {
        refType: BuiltinTypes.STRING,
        annotations: {},
      },
      sandbox: { refType: BuiltinTypes.BOOLEAN },
    },
  }) } }
}

export const mockOauthCredentialsType = (adapterName: string,
  oauthParameters: OAuthRequestParameters): AdapterAuthentication => {
  const baseType = mockCredentialsType(adapterName)
  baseType.oauth = {
    credentialsType: new ObjectType({
      elemID: new ElemID(adapterName),
      fields: {
        refreshToken: { refType: BuiltinTypes.STRING },
        accessToken: { refType: BuiltinTypes.STRING },
        instanceUrl: { refType: BuiltinTypes.STRING },
      },
    }),
    oauthRequestParameters: new ObjectType({
      elemID: new ElemID(adapterName),
      fields: {
        consumerKey: { refType: BuiltinTypes.STRING },
        port: { refType: BuiltinTypes.NUMBER },
        sandbox: { refType: BuiltinTypes.BOOLEAN },
      },
    }),
    createOAuthRequest: jest.fn().mockReturnValue(oauthParameters),
    createFromOauthResponse: jest.fn().mockImplementation((oldConfig: Values,
      response: OauthAccessTokenResponse) => ({
      sandbox: oldConfig.sandbox,
      accessToken: response.fields.accessToken,
      instanceUrl: response.fields.instanceUrl,
    })),
  }
  return baseType
}

export const mockConfigType = (adapterName: string): ObjectType => {
  const configID = new ElemID(adapterName)
  return new ObjectType({
    elemID: configID,
    fields: {
      username: { refType: BuiltinTypes.STRING },
      password: { refType: BuiltinTypes.STRING },
      token: { refType: BuiltinTypes.STRING },
      sandbox: { refType: BuiltinTypes.BOOLEAN },
    },
    annotationRefsOrTypes: {},
    annotations: {},
  })
}

export const mockAdapterAuthentication = (credentialsType: ObjectType): AdapterAuthentication =>
  ({ basic: { credentialsType } })

export const detailedChange = (
  action: 'add' | 'modify' | 'remove', path: ReadonlyArray<string> | ElemID,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  before: any, after: any,
): DetailedChange => {
  const id = path instanceof ElemID ? path : new ElemID('salesforce', ...path)
  if (action === 'add') {
    return { action, id, data: { after } }
  }
  if (action === 'remove') {
    return { action, id, data: { before } }
  }
  return { action, id, data: { before, after } }
}

export const dummyChanges: DetailedChange[] = [
  detailedChange('add', ['adapter', 'dummy'], undefined, 'after-add-dummy1'),
  detailedChange('remove', ['adapter', 'dummy2'], 'before-remove-dummy2', undefined),
]

const toPlanItem = (
  parent: Change,
  subChanges: Change[],
  detailed: DetailedChange[]
): PlanItem => ({
  groupKey: getChangeData(parent).elemID.getFullName(),
  items: new Map<string, Change>(
    [parent, ...subChanges].map(c => [_.uniqueId(), c])
  ),
  action: parent.action,
  changes: () => {
    const changes = [parent, ...subChanges]
    const detailedChangesByChange = _.groupBy(detailed, change => change.id.createBaseID().parent.getFullName())
    return changes.map(change => ({
      ...change,
      detailedChanges: () => detailedChangesByChange[getChangeData(change).elemID.getFullName()],
    }))
  },
  detailedChanges: () => detailed,
})

const createChange = (action: 'add' | 'modify' | 'remove', ...path: string[]): Change => {
  const elemID = new ElemID('salesforce', ...path)
  if (action === 'add') {
    return { action, data: { after: new ObjectType({ elemID }) } }
  }
  if (action === 'remove') {
    return { action, data: { before: new ObjectType({ elemID }) } }
  }
  return {
    action,
    data: { before: new ObjectType({ elemID }), after: new ObjectType({ elemID }) },
  }
}

export const configChangePlan = (): { plan: Plan; updatedConfig: InstanceElement } => {
  const result = new DataNodeMap<Group<Change>>()
  const configElemID = new ElemID('salesforce')
  const configType = new ObjectType({
    elemID: configElemID,
    fields: {
      test: {
        refType: new ListType(BuiltinTypes.STRING),
      },
    },
  })
  const configInstance = new InstanceElement(ElemID.CONFIG_NAME, configType, { test: [] })
  const updatedConfig = configInstance.clone()
  updatedConfig.value.test = ['SkipMe']
  const configChange: Change = {
    action: 'modify',
    data: {
      before: configInstance,
      after: updatedConfig,
    },
  }
  const instancePlanItem = toPlanItem(
    configChange,
    [],
    [
      {
        id: configInstance.elemID.createNestedID('test'),
        action: 'modify',
        data: { before: configInstance.value.test, after: updatedConfig.value.test },
      },
    ],
  )
  result.addNode(_.uniqueId('instance'), [], instancePlanItem)

  Object.assign(result, {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return [instancePlanItem]
    },
    getItem(_id: string): PlanItem {
      return instancePlanItem
    },
    changeErrors: [],
  })
  return { plan: result as Plan, updatedConfig }
}

export const preview = (): Plan => {
  const result = new DataNodeMap<Group<Change>>()

  const leadPlanItem = toPlanItem(
    createChange('modify', 'lead'),
    [
      createChange('add', 'lead', 'do_you_have_a_sales_team'),
      createChange('modify', 'lead', 'how_many_sales_people'),
      createChange('remove', 'lead', 'field', 'status'),
    ],
    [
      detailedChange('modify', ['lead', 'field', 'label'], 'old', 'new'),
      detailedChange('add', ['lead', 'field', 'do_you_have_a_sales_team'], undefined, 'new field'),
      detailedChange('modify', ['lead', 'field', 'how_many_sales_people', 'label'], 'old label', 'new label'),
      detailedChange('remove', ['lead', 'field', 'status'], 'old field', undefined),
    ]
  )
  result.addNode(_.uniqueId('lead'), [], leadPlanItem)

  const accountPlanItem = toPlanItem(
    createChange('modify', 'account'),
    [
      createChange('add', 'account', 'status'),
      createChange('modify', 'account', 'name'),
    ],
    [
      detailedChange('add', ['account', 'field', 'status'], undefined, { name: 'field', type: 'picklist' }),
      detailedChange('modify', ['account', 'field', 'name', 'label'], 'old label', 'new label'),
    ]
  )
  result.addNode(_.uniqueId('account'), [], accountPlanItem)

  const activityPlanItem = toPlanItem(
    createChange('add', 'activity', 'field', 'name'),
    [],
    []
  )
  result.addNode(_.uniqueId('activity'), [], activityPlanItem)

  const employeeInstance = elements()[4] as InstanceElement
  const updatedEmployee = _.cloneDeep(employeeInstance)
  updatedEmployee.value.name = 'PostChange'
  const employeeChange: Change = {
    action: 'modify',
    data: {
      before: employeeInstance,
      after: updatedEmployee,
    },
  }
  const instancePlanItem = toPlanItem(
    employeeChange,
    [],
    [
      {
        id: employeeInstance.elemID.createNestedID('name'),
        action: 'modify',
        data: { before: employeeInstance.value.name, after: updatedEmployee.value.name },
      },
    ],
  )
  result.addNode(_.uniqueId('instance'), [], instancePlanItem)
  const changeErrors = [
    {
      elemID: new ElemID('salesforce', 'test'),
      severity: 'Error',
      message: 'Message key for test',
      detailedMessage: 'Validation message',
    },
    {
      elemID: new ElemID('salesforce', 'test2'),
      severity: 'Info',
      message: 'Info message',
      detailedMessage: 'detailed Info message',
      deployActions: {
        preAction: {
          title: 'preDeployAction',
          description: 'description',
          subActions: ['first subtext', 'second subtext'],
          documentationURL: 'someURL',
        },
        postAction: {
          title: 'postDeployAction',
          subActions: ['third subtext', 'fourth subtext'],
        },
      },
    },
    {
      elemID: new ElemID('salesforce', 'test3'),
      severity: 'Warning',
      message: 'Warning message',
      detailedMessage: 'detailed Warning message',
      deployActions: {
        preAction: {
          title: 'preDeployAction2',
          subActions: ['first subtext2', 'second subtext2'],
        },
        postAction: {
          title: 'postDeployAction2',
          subActions: ['third subtext2', 'fourth subtext2'],
        },
      },
    },
  ]
  Object.assign(result, {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return [leadPlanItem, accountPlanItem, activityPlanItem, instancePlanItem]
    },
    getItem(id: string): PlanItem {
      if (id.startsWith('lead')) return leadPlanItem
      if (id.startsWith('activity')) return activityPlanItem
      return id.startsWith('account') ? accountPlanItem : instancePlanItem
    },
    changeErrors,
  })
  return result as Plan
}

export const deploy = async (
  _workspace: Workspace,
  actionPlan: Plan,
  reportProgress: (action: PlanItem, step: string, details?: string) => void,
  _accounts: string[],
): Promise<DeployResult> => {
  let numOfChangesReported = 0
  wu(actionPlan.itemsByEvalOrder()).forEach(change => {
    numOfChangesReported += 1
    if (numOfChangesReported / 3 === 1) {
      reportProgress(change, 'started')
      reportProgress(change, 'error', 'details')
      return
    }
    if (numOfChangesReported / 2 === 1) {
      reportProgress(change, 'started')
      reportProgress(change, 'finished')
      return
    }
    reportProgress(change, 'started')
    reportProgress(change, 'cancelled', 'details')
  })

  return {
    success: true,
    changes: dummyChanges.map(c => ({ change: c, serviceChanges: [c] })),
    errors: [],
  }
}

export const staticFileChange = (action: 'add' | 'modify' | 'remove', withContent = false): DetailedChange => {
  const id = new ElemID('salesforce')
  const path = ['salesforce', 'Records', 'advancedpdftemplate', 'custtmpl_103_t2257860_156']
  const beforeFile = new StaticFile({
    filepath: 'salesforce/advancedpdftemplate/custtmpl_103_t2257860_156.xml',
    encoding: 'binary',
    hash: '5fa14331d637ce9b056be8abe433d43d',
    ...(withContent ? { content: Buffer.from('before') } : {}),
  })
  const afterFile = new StaticFile({
    filepath: 'salesforce/advancedpdftemplate/custtmpl_103_t2257860_156.xml',
    encoding: 'binary',
    hash: '81511e24c8023d819040a196fbaf8ee7',
    ...(withContent ? { content: Buffer.from('after') } : {}),
  })

  if (action === 'add') {
    const data = { after: afterFile }
    return { id, action, data, path }
  }
  if (action === 'modify') {
    const data = { before: beforeFile, after: afterFile }
    return { id, action, data, path }
  }
  const data = { before: beforeFile }
  return { id, action, data, path }
}
