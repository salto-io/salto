import {
  Type, BuiltinTypes, ElemID, PlanActionType, PlanAction, ObjectType,
  Field, Plan, InstanceElement,
} from 'adapter-api'
import wu from 'wu'
import Blueprint from '../../../src/blueprints/blueprint'


export const getAllElements = async (
  _blueprints: Blueprint[] = []
): Promise<Type[]> => {
  const addrElemID = new ElemID('salto', 'address')
  const saltoAddr = new ObjectType({
    elemID: addrElemID,
    fields: {
      country: new Field(addrElemID, 'country', BuiltinTypes.STRING),
      city: new Field(addrElemID, 'city', BuiltinTypes.STRING),
    },
  })
  saltoAddr.annotations.label = BuiltinTypes.STRING

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
  saltoOffice.annotations.label = BuiltinTypes.STRING

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

  return [BuiltinTypes.STRING, saltoAddr, saltoOffice, saltoEmployee]
}

const runChangeMock = async (
  changes: Plan,
  reportProgress: (action: PlanAction) => void
): Promise<void> => wu(changes).reduce((result, action) =>
  result.then(() => {
    setTimeout(() => reportProgress(action), 0)
  }), Promise.resolve())

const newAction = (
  action: PlanActionType,
  before?: string,
  after?: string,
  sub?: Plan
): PlanAction => {
  const adapter = 'salesforce'
  const actionFullName = before ? `${adapter}.${before}` : `${adapter}.${after}`

  const data = {
    before: before
      ? new ObjectType({ elemID: new ElemID(adapter, before) })
      : undefined,
    after: after
      ? new ObjectType({ elemID: new ElemID(adapter, after) })
      : undefined,
  }
  let subChanges: Plan | undefined
  if (sub) {
    subChanges = wu(sub).map(plan => {
      if (plan.data.before) {
        plan.data.before.elemID = new ElemID(adapter, actionFullName
          + plan.data.before.elemID.name)
      }
      if (plan.data.after) {
        plan.data.after.elemID = new ElemID(adapter, actionFullName
          + plan.data.after.elemID.name)
      }
      return plan
    }).toArray()
  }

  return { action, data, subChanges }
}

const add = (name: string, sub: Plan = []): PlanAction => newAction('add', undefined, name, sub)

const remove = (name: string, sub: Plan = []): PlanAction => newAction('remove', name, undefined, sub)

const modify = (name: string, sub: Plan = []): PlanAction => newAction('modify', name, name, sub)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const plan = async (
  _blueprints: Blueprint[],
): Promise<Plan> => {
  const changes = [
    add('lead.do_you_have_a_sales_team', [add('label'), add('defaultValue')]),
    modify('salesforce.lead.how_many_sales_people', [modify('restricttovalueset'),
      remove('values')]),
    add('lead.how_many_sales_people', [add('label'),
      add('restrict_to_value_set'), add('controlling_field'),
      add('values')]),
    remove('lead.status', [remove('label'), remove('defaultValue')])]

  return changes
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const apply = async (
  blueprints: Blueprint[],
  _fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldApply: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanAction) => void,
  force: boolean = false
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
): Promise<Blueprint> => ({ buffer: Buffer.from('asd'), filename: 'none' })
