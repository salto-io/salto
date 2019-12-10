import { GroupedNodeMap } from '@salto/dag'
import {
  BuiltinTypes, Change, Element, ElemID, Field, getChangeElement, InstanceElement,
  ObjectType, Type,
} from 'adapter-api'
import _ from 'lodash'
import { DetailedChange, Plan, PlanItem, SearchResult, Workspace, WorkspaceError, DeployResult } from 'salto'
import wu from 'wu'
import realCli from '../src/cli'
import builders from '../src/commands/index'
import { YargsCommandBuilder } from '../src/command_builder'
import { Spinner, SpinnerCreator } from '../src/types'

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

export const elements = (): Element[] => {
  const addrElemID = new ElemID('salto', 'address')
  const saltoAddr = new ObjectType({
    elemID: addrElemID,
    fields: {
      country: new Field(addrElemID, 'country', BuiltinTypes.STRING),
      city: new Field(addrElemID, 'city', BuiltinTypes.STRING),
    },
  })
  saltoAddr.annotationTypes.label = BuiltinTypes.STRING

  const officeElemID = new ElemID('salto', 'office')
  const saltoOffice = new ObjectType({
    elemID: officeElemID,
    fields: {
      name: new Field(officeElemID, 'name', BuiltinTypes.STRING),
      location: new Field(
        officeElemID,
        'location',
        saltoAddr,
        {
          label: 'Office Location',
          description: 'A location of an office',
        },
      ),
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
      name: new Field(
        employeeElemID,
        'name',
        BuiltinTypes.STRING,
        { _required: true },
      ),
      nicknames: new Field(
        employeeElemID,
        'nicknames',
        BuiltinTypes.STRING,
        {},
        true
      ),
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      employee_resident: new Field(
        employeeElemID,
        'employee_resident',
        saltoAddr,
        { label: 'Employee Resident' }
      ),
      company: new Field(
        employeeElemID,
        'company',
        BuiltinTypes.STRING,
        { _default: 'salto' },
      ),
      office: new Field(
        employeeElemID,
        'office',
        saltoOffice,
        {
          label: 'Based In',
          name: {
            [Type.DEFAULT]: 'HQ',
          },
          location: {
            country: {
              [Type.DEFAULT]: 'IL',
            },
            city: {
              [Type.DEFAULT]: 'Raanana',
            },
          },
        },
      ),
    },
  })

  const saltoEmployeeInstance = new InstanceElement(
    'test', saltoEmployee,
    { name: 'FirstEmployee', nicknames: ['you', 'hi'], office: { label: 'bla', name: 'foo' } }
  )

  return [BuiltinTypes.STRING, saltoAddr, saltoOffice, saltoEmployee, saltoEmployeeInstance]
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
  detailedChange('add', ['adapter', 'dummy'], undefined, 'asd'),
  detailedChange('remove', ['adapter', 'other'], 'asd', undefined),
]

export const preview = (): Plan => {
  const change = (action: 'add' | 'modify' | 'remove', ...path: string[]): Change => {
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
  const toPlanItem = (
    parent: Change,
    subChanges: Change[],
    detailed: DetailedChange[]
  ): PlanItem => ({
    groupKey: getChangeElement(parent).elemID.getFullName(),
    items: new Map<string, Change>(
      [parent, ...subChanges].map(c => [getChangeElement(c).elemID.getFullName(), c])
    ),
    parent: () => parent,
    changes: () => [parent, ...subChanges],
    detailedChanges: () => detailed,
    getElementName: () => getChangeElement(parent).elemID.getFullName(),
  })

  const result = new GroupedNodeMap<Change>()

  const leadPlanItem = toPlanItem(
    change('modify', 'lead'),
    [
      change('add', 'lead', 'do_you_have_a_sales_team'),
      change('modify', 'lead', 'how_many_sales_people'),
      change('remove', 'lead', 'status'),
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
    change('modify', 'account'),
    [
      change('add', 'account', 'status'),
      change('modify', 'account', 'name'),
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

  Object.assign(result, {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return [leadPlanItem, accountPlanItem, instancePlanItem]
    },
    getItem(id: string): PlanItem {
      if (id.startsWith('lead')) return leadPlanItem
      return id.startsWith('account') ? accountPlanItem : instancePlanItem
    },
  })

  return result as Plan
}

export const deploy = async (
  _workspace: Workspace,
  _fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldDeploy: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanItem, step: string, details?: string) => void,
  _services: string[],
  force = false
): Promise<DeployResult> => {
  const changes = preview()
  if (force || await shouldDeploy(changes)) {
    wu(changes.itemsByEvalOrder()).forEach(change => {
      reportProgress(change, 'started')
      reportProgress(change, 'finished')
    })
  }

  return {
    success: true,
    changes: dummyChanges.map(c => ({ change: c, serviceChange: c })),
    errors: [],
  }
}

export const describe = async (_searchWords: string[]):
  Promise<SearchResult> =>
  ({
    key: 'salto.office',
    element: elements()[2],
    isGuess: false,
  })

export const getWorkspaceErrors = (): ReadonlyArray<WorkspaceError> => [{
  sourceFragments: [],
  error: 'Error',
  severity: 'Error',
}]
