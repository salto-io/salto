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
import wu from 'wu'
import _ from 'lodash'
import { DataNodeMap, Group } from '@salto-io/dag'
import {
  BuiltinTypes, Change, Element, ElemID, getChangeElement, InstanceElement,
  ObjectType, CORE_ANNOTATIONS, SaltoError, Values, ListType, DetailedChange,
} from '@salto-io/adapter-api'
import {
  Plan, PlanItem, EVENT_TYPES, DeployResult,
  telemetrySender, Telemetry, Tags, TelemetryEvent, CommandConfig,
} from '@salto-io/core'
import { Workspace, errors as wsErrors } from '@salto-io/workspace'
import * as workspace from '../src/workspace/workspace'
import realCli from '../src/cli'
import builders from '../src/commands/index'
import { YargsCommandBuilder } from '../src/command_builder'
import { Spinner, SpinnerCreator, CliOutput } from '../src/types'

export const mockFunction = <T extends (...args: never[]) => unknown>():
  jest.Mock<ReturnType<T>, Parameters<T>> => jest.fn()

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

export type MockWritableStream = NodeJS.WritableStream & {
  contents(): string
}

export const mockSpinnerCreator = (spinners: Spinner[]): SpinnerCreator => jest.fn(() => {
  const result = {
    succeed: jest.fn(),
    fail: jest.fn(),
  }
  spinners.push(result)
  return result
})

export interface MockCliOutput {
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

export const cli = async ({
  commandBuilders = builders,
  args = [],
  out = {},
  err = {},
}: {
  commandBuilders?: YargsCommandBuilder[]
  args?: string[] | string
  out?: MockWriteStreamOpts
  err?: MockWriteStreamOpts
} = {}): Promise<MockCliOutput> => {
  const input = {
    args: _.isArray(args) ? args : args.split(' '),
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

  const exitCode = await realCli({ input, output, commandBuilders, spinnerCreator })

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
      country: { type: BuiltinTypes.STRING },
      city: { type: BuiltinTypes.STRING },
    },
  })
  saltoAddr.annotationTypes.label = BuiltinTypes.STRING

  const officeElemID = new ElemID('salto', 'office')
  const saltoOffice = new ObjectType({
    elemID: officeElemID,
    fields: {
      name: { type: BuiltinTypes.STRING },
      location: {
        type: saltoAddr,
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
  saltoOffice.annotationTypes.label = BuiltinTypes.STRING

  const employeeElemID = new ElemID('salto', 'employee')
  const saltoEmployee = new ObjectType({
    elemID: employeeElemID,
    fields: {
      name: {
        type: BuiltinTypes.STRING,
        annotations: { _required: true },
      },
      nicknames: {
        type: new ListType(BuiltinTypes.STRING),
        annotations: {},
      },
      company: {
        type: BuiltinTypes.STRING,
        annotations: { _default: 'salto' },
      },
      office: {
        type: saltoOffice,
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

export const mockLoadWorkspace = (
  name: string,
  envs = ['active', 'inactive'],
  isEmpty = false,
  hasElementsInServices = true,
): Workspace =>
  ({
    uid: '123',
    name,
    currentEnv: () => 'active',
    envs: () => envs,
    services: () => ['salesforce', 'hubspot'],
    elements: jest.fn().mockResolvedValue([] as ReadonlyArray<Element>),
    hasErrors: () => jest.fn().mockResolvedValue(false),
    errors: () => jest.fn().mockResolvedValue(mockErrors([])),
    isEmpty: jest.fn().mockResolvedValue(isEmpty),
    hasElementsInServices: jest.fn().mockResolvedValue(hasElementsInServices),
    getTotalSize: jest.fn().mockResolvedValue(0),
    addEnvironment: jest.fn(),
    deleteEnvironment: jest.fn(),
    renameEnvironment: jest.fn(),
    setCurrentEnv: jest.fn().mockReturnValue('active'),
    transformToWorkspaceError: () => ({
      sourceFragments: [],
      message: 'Error',
      severity: 'Error',
    }),
    state: jest.fn().mockImplementation(() => ({
      existingServices: jest.fn().mockResolvedValue(['salesforce', 'hubspot']),
    })),
    fetchedServices: jest.fn().mockResolvedValue([]),
    promote: jest.fn().mockResolvedValue(undefined),
    demote: jest.fn().mockResolvedValue(undefined),
    demoteAll: jest.fn().mockResolvedValue(undefined),
    copyTo: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined),
  } as unknown as Workspace)

export const withoutEnvironmentParam = 'active'
export const withEnvironmentParam = 'inactive'

export const mockLoadWorkspaceEnvironment = (
  baseDir: string,
  _cliOutput: CliOutput,
  { sessionEnv = withoutEnvironmentParam }: Partial<workspace.LoadWorkspaceOptions>
): workspace.LoadWorkspaceResult => {
  if (baseDir === 'errorDir') {
    return {
      workspace: ({}) as unknown as Workspace,
      errored: true,
      stateRecencies: [],
    }
  }
  if (sessionEnv === withEnvironmentParam) {
    return {
      workspace: {
        ...mockLoadWorkspace(baseDir),
        currentEnv: () => withEnvironmentParam,
      },
      errored: false,
      stateRecencies: [],
    }
  }
  return {
    workspace: {
      ...mockLoadWorkspace(baseDir),
      currentEnv: () => withoutEnvironmentParam,
    },
    errored: false,
    stateRecencies: [],
  }
}

export const mockConfigType = (adapterName: string): ObjectType => {
  const configID = new ElemID(adapterName)
  return new ObjectType({
    elemID: configID,
    fields: {
      username: { type: BuiltinTypes.STRING },
      password: { type: BuiltinTypes.STRING },
      token: { type: BuiltinTypes.STRING },
      sandbox: { type: BuiltinTypes.BOOLEAN },
    },
    annotationTypes: {},
    annotations: {},
  })
}

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
    fields: { test: { type: new ListType(BuiltinTypes.STRING) } },
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
      createChange('remove', 'lead', 'status'),
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
      return [leadPlanItem, accountPlanItem, instancePlanItem]
    },
    getItem(id: string): PlanItem {
      if (id.startsWith('lead')) return leadPlanItem
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
  wu(actionPlan.itemsByEvalOrder()).forEach(change => {
    reportProgress(change, 'started')
    reportProgress(change, 'finished')
  })

  return {
    success: true,
    changes: dummyChanges.map(c => ({ change: c, serviceChange: c })),
    errors: [],
  }
}

export const createMockEnvNameGetter = (
  newEnvName = 'default'
): (
) => Promise<string> => (
  () => Promise.resolve(newEnvName)
)
