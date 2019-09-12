import {
  Type, BuiltinTypes, ElemID, Change, ObjectType,
  Field, InstanceElement, Element,
} from 'adapter-api'
import wu from 'wu'
import _ from 'lodash'
import { Group, DataNodeMap } from '@salto/dag'
import { Blueprint } from '../../../src/blueprints/blueprint'
import { Plan, PlanItem, PlanItemId } from '../../../src/core/plan'

export const getAllElements = async (
  _blueprints: Blueprint[] = []
): Promise<Element[]> => {
  const addrElemID = new ElemID('salto', 'address')
  const saltoAddr = new ObjectType({
    elemID: addrElemID,
    fields: {
      country: new Field(addrElemID, 'country', BuiltinTypes.STRING),
      city: new Field(addrElemID, 'city', BuiltinTypes.STRING),
    },
  })
  saltoAddr.annotationsDescriptor.label = BuiltinTypes.STRING

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
  })
  saltoOffice.annotationsDescriptor.label = BuiltinTypes.STRING

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

  const saltoEmployeeInstance = new InstanceElement(new ElemID('salto', 'employee_instance'),
    saltoEmployee, { name: 'FirstEmployee' })

  return [BuiltinTypes.STRING, saltoAddr, saltoOffice, saltoEmployee, saltoEmployeeInstance]
}

const runChangeMock = async (
  changes: Plan,
  reportProgress: (action: PlanItem) => void
): Promise<void> => wu(changes.itemsByEvalOrder()).reduce((result, action) =>
  result.then(() => {
    setTimeout(() => reportProgress(action), 0)
  }), Promise.resolve())

const newAction = (before?: string, after?: string): Change => {
  const adapter = 'salesforce'
  if (before && after) {
    return {
      action: 'modify',
      data: {
        before: new ObjectType({ elemID: new ElemID(adapter, before) }),
        after: new ObjectType({ elemID: new ElemID(adapter, after) }),
      },
    }
  }
  if (before) {
    return {
      action: 'remove',
      data: { before: new ObjectType({ elemID: new ElemID(adapter, before) }) },
    }
  }
  return {
    action: 'add',
    data: {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      after: new ObjectType({ elemID: new ElemID(adapter, after!) }),
    },
  }
}

const add = (name: string): Change => newAction(undefined, name)
const remove = (name: string): Change => newAction(name, undefined)
const modify = (name: string): Change => newAction(name, name)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const plan = async (
  _blueprints: Blueprint[],
): Promise<Plan> => {
  const result = new DataNodeMap<Group<Change>>() as Plan

  const items = new Map<PlanItemId, Change>([
    ['lead', modify('lead')],
    ['lead_do_you_have_a_sales_team', add('lead_do_you_have_a_sales_team')],
    ['lead_how_many_sales_people', modify('lead_do_you_have_a_sales_team')],
    ['lead_status', remove('lead_status')],
  ])
  const planItem = {
    items,
    groupKey: 'lead',
    data: () => wu(items.values()).toArray(),
    parent: () => modify('lead'),
  }
  result.addNode(_.uniqueId(), [], planItem)

  result.itemsByEvalOrder = (): Iterable<PlanItem> => [planItem]
  return result
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const apply = async (
  blueprints: Blueprint[],
  _fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldApply: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanItem) => void,
  force = false
): Promise<Plan> => {
  const changes = await plan(blueprints)
  if (force || await shouldApply(changes)) {
    await runChangeMock(changes, reportProgress)
  }

  return changes
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const discover = async (
  _blueprints: Blueprint[],
  _fillConfig: (configType: ObjectType) => Promise<InstanceElement>
): Promise<Blueprint[]> => [({ buffer: Buffer.from('asd'), filename: 'none' })]

const mockIterator = async function *mockIterator(): AsyncIterable<InstanceElement[]> {
  const testType = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
  })
  const elemID = new ElemID('salesforce')
  const values = [
    {
      Id: 1,
      FirstName: 'Daile',
      LastName: 'Limeburn',
      Email: 'dlimeburn0@blogs.com',
      Gender: 'Female',
    }, {
      Id: 2,
      FirstName: 'Murial',
      LastName: 'Morson',
      Email: 'mmorson1@google.nl',
      Gender: 'Female',
    }, {
      Id: 3,
      FirstName: 'Minna',
      LastName: 'Noe',
      Email: 'mnoe2@wikimedia.org',
      Gender: 'Female',
    },
  ]
  yield values.map(value => new InstanceElement(
    elemID,
    testType,
    value
  ))
}

export const exportToCsv = async (
  _typeId: string,
  _blueprints: Blueprint[],
  _fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<AsyncIterable<InstanceElement[]>> => mockIterator()
