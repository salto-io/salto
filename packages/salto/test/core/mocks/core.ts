import {
  Type, BuiltinTypes, ElemID, Change, ObjectType,
  Field, InstanceElement, Element,
} from 'adapter-api'
import wu from 'wu'
import _ from 'lodash'
import { GroupedNodeMap } from '@salto/dag'
import { Blueprint } from '../../../src/core/blueprint'
import { Plan, PlanItem, PlanItemId } from '../../../src/core/plan'
import { SearchResult } from '../../../src/core/search'

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

  const saltoEmployeeInstance = new InstanceElement(new ElemID('salto', 'employee_instance'),
    saltoEmployee, { name: 'FirstEmployee' })

  return [BuiltinTypes.STRING, saltoAddr, saltoOffice, saltoEmployee, saltoEmployeeInstance]
}

const runChangeMock = (changes: Plan, reportProgress: (action: PlanItem) => void): void => {
  wu(changes.itemsByEvalOrder()).forEach(change => {
    reportProgress(change)
  })
}

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

export const plan = async (
  _blueprints: Blueprint[],
): Promise<Plan> => {
  const result = new GroupedNodeMap<Change>()

  const leadPlanItem: PlanItem = {
    items: new Map<PlanItemId, Change>([
      ['lead', modify('lead')],
      ['lead_do_you_have_a_sales_team', add('lead_do_you_have_a_sales_team')],
      ['lead_how_many_sales_people', modify('lead_do_you_have_a_sales_team')],
      ['lead_status', remove('lead_status')],
    ]),
    groupKey: 'lead',
    parent: () => modify('lead'),
  }
  result.addNode(_.uniqueId('lead'), [], leadPlanItem)

  const accountPlanItem: PlanItem = {
    items: new Map<PlanItemId, Change>([
      ['account_status', add('account_status')],
      ['account_name', modify('account_name')],
    ]),
    groupKey: 'account',
    parent: () => modify('account'),
  }
  result.addNode(_.uniqueId('account'), [], accountPlanItem)

  Object.assign(result, {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return [leadPlanItem, accountPlanItem]
    },
    getItem(id: PlanItemId): PlanItem {
      return id.toString().startsWith('lead') ? leadPlanItem : accountPlanItem
    },
  })

  return result as Plan
}

export const apply = async (
  blueprints: Blueprint[],
  _fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldApply: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanItem) => void,
  force = false
): Promise<Plan> => {
  const changes = await plan(blueprints)
  if (force || await shouldApply(changes)) {
    runChangeMock(changes, reportProgress)
  }

  return changes
}

export const discover = async (
  _blueprints: Blueprint[],
  _fillConfig: (configType: ObjectType) => Promise<InstanceElement>
): Promise<Blueprint[]> => [({ buffer: Buffer.from('asd'), filename: 'none' })]

export const describe = async (
  _searchWords: string[],
  _blueprints?: Blueprint[],
): Promise<SearchResult> => {
  const elements = await getAllElements()
  return {
    key: 'salto_employee',
    element: elements[3],
    isGuess: false,
  }
}

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
