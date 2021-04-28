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
import wu from 'wu'
import _ from 'lodash'
import { DataNodeMap, Group } from '@salto-io/dag'
import {
  BuiltinTypes, Change, Element, ElemID, getChangeElement, InstanceElement,
  ObjectType, CORE_ANNOTATIONS, SaltoError, Values, ListType, DetailedChange,
  AdapterAuthentication, OAuthRequestParameters, OauthAccessTokenResponse,
} from '@salto-io/adapter-api'
import {
  Plan, PlanItem, EVENT_TYPES, DeployResult,
  telemetrySender, Telemetry, Tags, TelemetryEvent, CommandConfig,
} from '@salto-io/core'
import { Workspace, errors as wsErrors, state as wsState, parser, remoteMap, elementSource } from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import realCli from '../src/cli'
import commandDefinitions from '../src/commands/index'
import { CommandOrGroupDef, CommandArgs } from '../src/command_builder'
import { Spinner, SpinnerCreator } from '../src/types'
import { getCliTelemetry } from '../src/telemetry'
import { version as currentVersion } from '../src/generated/version.json'


const { InMemoryRemoteMap } = remoteMap
const { createInMemoryElementSource } = elementSource
const { awu } = collections.asynciterable

export type MockFunction<T extends (...args: never[]) => unknown> =
  jest.Mock<ReturnType<T>, Parameters<T>>

export type SpiedFunction<T extends (...args: never[]) => unknown> =
  jest.SpyInstance<ReturnType<T>, Parameters<T>>

export type MockInterface<T extends {}> = {
  [k in keyof T]: T[k] extends (...args: never[]) => unknown
    ? MockFunction<T[k]>
    : MockInterface<T[k]>
}

export const mockFunction = <T extends (...args: never[]) => unknown>(): MockFunction<T> => (
  jest.fn()
)

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
  const telemetry = telemetrySender(
    { url: '', enabled: false, token: '' },
    { installationID: '1234', app: 'test' },
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
      tags,
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
      country: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      city: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    },
  })
  saltoAddr.annotationRefTypes.label = createRefToElmWithValue(BuiltinTypes.STRING)

  const officeElemID = new ElemID('salto', 'office')
  const saltoOffice = new ObjectType({
    elemID: officeElemID,
    fields: {
      name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      location: {
        refType: createRefToElmWithValue(saltoAddr),
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
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: { _required: true },
      },
      nicknames: {
        refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
        annotations: {},
      },
      company: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: { _default: 'salto' },
      },
      office: {
        refType: createRefToElmWithValue(saltoOffice),
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

export const mockErrors = (errors: SaltoError[]): wsErrors.Errors => ({
  all: () => errors,
  hasErrors: () => errors.length !== 0,
  merge: [],
  parse: [],
  validation: errors.map(err => ({ elemID: new ElemID('test'), error: '', ...err })),
  strings: () => errors.map(err => err.message),
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
  services?: string[]
}
export const mockWorkspace = ({
  uid = '123',
  name = '',
  envs = ['active', 'inactive'],
  services = ['salesforce', 'hubspot'],
}: MockWorkspaceArgs): MockWorkspace => {
  const state = wsState.buildInMemState(
    async () => ({
      elements: createInMemoryElementSource(),
      pathIndex: new InMemoryRemoteMap(),
      servicesUpdateDate: new InMemoryRemoteMap(),
      saltoMetadata: new InMemoryRemoteMap([
        { key: 'version', value: currentVersion },
      ] as {key: wsState.StateMetadataKey; value: string}[]),
    })
  )
  return {
    uid,
    name,
    elements: mockFunction<Workspace['elements']>().mockResolvedValue(
      createInMemoryElementSource(elements())
    ),
    state: mockFunction<Workspace['state']>().mockReturnValue(state),
    envs: mockFunction<Workspace['envs']>().mockReturnValue(envs),
    currentEnv: mockFunction<Workspace['currentEnv']>().mockReturnValue(envs[0]),
    services: mockFunction<Workspace['services']>().mockReturnValue(services),
    servicesCredentials: mockFunction<Workspace['servicesCredentials']>().mockResolvedValue({}),
    serviceConfig: mockFunction<Workspace['serviceConfig']>().mockResolvedValue(undefined),
    isEmpty: mockFunction<Workspace['isEmpty']>().mockResolvedValue(false),
    hasElementsInServices: mockFunction<Workspace['hasElementsInServices']>().mockResolvedValue(true),
    hasElementsInEnv: mockFunction<Workspace['hasElementsInEnv']>().mockResolvedValue(false),
    envOfFile: mockFunction<Workspace['envOfFile']>().mockReturnValue(''),
    getSourceFragment: mockFunction<Workspace['getSourceFragment']>().mockImplementation(
      async sourceRange => ({ sourceRange, fragment: '' })
    ),
    hasErrors: mockFunction<Workspace['hasErrors']>().mockResolvedValue(false),
    errors: mockFunction<Workspace['errors']>().mockResolvedValue(mockErrors([])),
    transformToWorkspaceError: mockFunction<Workspace['transformToWorkspaceError']>().mockImplementation(
      async error => ({ ...error, sourceFragments: [] })
    ) as Workspace['transformToWorkspaceError'],
    transformError: mockFunction<Workspace['transformError']>().mockImplementation(
      async error => ({ ...error, sourceFragments: [] })
    ),
    updateNaclFiles: mockFunction<Workspace['updateNaclFiles']>(),
    listNaclFiles: mockFunction<Workspace['listNaclFiles']>().mockResolvedValue([]),
    getTotalSize: mockFunction<Workspace['getTotalSize']>().mockResolvedValue(0),
    getNaclFile: mockFunction<Workspace['getNaclFile']>(),
    setNaclFiles: mockFunction<Workspace['setNaclFiles']>(),
    removeNaclFiles: mockFunction<Workspace['removeNaclFiles']>(),
    getSourceMap: mockFunction<Workspace['getSourceMap']>().mockResolvedValue(new parser.SourceMap()),
    getSourceRanges: mockFunction<Workspace['getSourceRanges']>().mockResolvedValue([]),
    getElementReferencedFiles: mockFunction<Workspace['getElementReferencedFiles']>().mockResolvedValue([]),
    getElementNaclFiles: mockFunction<Workspace['getElementNaclFiles']>().mockResolvedValue([]),
    getElementIdsBySelectors: mockFunction<Workspace['getElementIdsBySelectors']>().mockResolvedValue(awu([])),
    getParsedNaclFile: mockFunction<Workspace['getParsedNaclFile']>(),
    flush: mockFunction<Workspace['flush']>(),
    clone: mockFunction<Workspace['clone']>(),
    clear: mockFunction<Workspace['clear']>(),
    addService: mockFunction<Workspace['addService']>(),
    addEnvironment: mockFunction<Workspace['addEnvironment']>(),
    deleteEnvironment: mockFunction<Workspace['deleteEnvironment']>(),
    renameEnvironment: mockFunction<Workspace['renameEnvironment']>(),
    setCurrentEnv: mockFunction<Workspace['setCurrentEnv']>(),
    updateServiceCredentials: mockFunction<Workspace['updateServiceCredentials']>(),
    updateServiceConfig: mockFunction<Workspace['updateServiceConfig']>(),
    getStateRecency: mockFunction<Workspace['getStateRecency']>().mockImplementation(
      async serviceName => ({ serviceName, status: 'Nonexistent', date: undefined })
    ),
    promote: mockFunction<Workspace['promote']>(),
    demote: mockFunction<Workspace['demote']>(),
    demoteAll: mockFunction<Workspace['demoteAll']>(),
    copyTo: mockFunction<Workspace['copyTo']>(),
    getValue: mockFunction<Workspace['getValue']>(),
    getSearchableNames: mockFunction<Workspace['getSearchableNames']>(),
    getSearchableNamesOfSource: mockFunction<Workspace['getSearchableNamesOfSource']>(),
  }
}

export const mockCredentialsType = (adapterName: string): AdapterAuthentication => {
  const configID = new ElemID(adapterName)
  return { basic: { credentialsType: new ObjectType({
    elemID: configID,
    fields: {
      username: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      password: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      token: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      sandbox: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
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
        accessToken: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        instanceUrl: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      },
    }),
    oauthRequestParameters: new ObjectType({
      elemID: new ElemID(adapterName),
      fields: {
        consumerKey: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
        port: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
        isSandbox: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
      },
    }),
    createOAuthRequest: jest.fn().mockReturnValue(oauthParameters),
    createFromOauthResponse: jest.fn().mockImplementation((oldConfig: Values,
      response: OauthAccessTokenResponse) => ({
      isSandbox: oldConfig.isSandbox,
      accessToken: response.accessToken,
      instanceUrl: response.instanceUrl,
    })),
  }
  return baseType
}

export const mockConfigType = (adapterName: string): ObjectType => {
  const configID = new ElemID(adapterName)
  return new ObjectType({
    elemID: configID,
    fields: {
      username: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      password: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      token: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      sandbox: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
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
  groupKey: getChangeElement(parent).elemID.getFullName(),
  items: new Map<string, Change>(
    [parent, ...subChanges].map(c => [_.uniqueId(), c])
  ),
  action: parent.action,
  changes: () => [parent, ...subChanges],
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
        refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
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
  const changeErrors = [{
    elemID: new ElemID('salesforce', 'test'),
    severity: 'Error',
    message: 'Message key for test',
    detailedMessage: 'Validation message',
  }]
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
  _services: string[],
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
    changes: dummyChanges.map(c => ({ change: c, serviceChange: c })),
    errors: [],
  }
}
