import {
  Type, PrimitiveTypes, ElemID, PlanActionType, PlanAction, ObjectType, PrimitiveType, ListType,
  Field, Plan,
} from 'adapter-api'
import wu from 'wu'
import { SaltoCore, CoreCallbacks } from '../../../src/core/core'
import Blueprint from '../../../src/core/blueprint'

// Don't know if this should be extend or a delegation
export default class SaltoCoreMock extends SaltoCore {
  constructor(callbacks: CoreCallbacks) {
    super(callbacks)
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  async getAllElements(_blueprints: Blueprint[] = []): Promise<Type[]> {
    const stringType = new PrimitiveType({
      elemID: new ElemID('', 'string'),
      primitive: PrimitiveTypes.STRING,
    })
    const addrElemID = new ElemID('salto', 'address')
    const saltoAddr = new ObjectType({
      elemID: addrElemID,
      fields: {
        country: new Field(addrElemID, 'country', stringType),
        city: new Field(addrElemID, 'city', stringType),
      },
    })
    saltoAddr.annotations.label = stringType

    const officeElemID = new ElemID('salto', 'office')
    const saltoOffice = new ObjectType({
      elemID: officeElemID,
      fields: {
        name: new Field(officeElemID, 'name', stringType),
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
    saltoOffice.annotations.label = stringType

    const employeeElemID = new ElemID('salto', 'employee')
    const saltoEmployee = new ObjectType({
      elemID: employeeElemID,
      fields: {
        name: new Field(
          employeeElemID,
          'name',
          stringType,
          { _required: true },
        ),
        nicknames: new Field(
          employeeElemID,
          'nicknames',
          new ListType({
            elemID: new ElemID('salto', 'nicknames'),
            elementType: stringType,
          }),
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
          stringType,
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

    return [stringType, saltoAddr, saltoOffice, saltoEmployee]
  }

  private async runChangeMock(changes: Plan): Promise<void> {
    return wu(changes).reduce((result, action) =>
      result.then(() => {
        setTimeout(() => this.emit('progress', action), 0)
      }), Promise.resolve())
  }

  private static newAction(action: PlanActionType, before?: string, after?: string,
    sub?: Plan): PlanAction {
    const adapter = 'salesforce'
    const actionFullName = before ? `${adapter}.${before}` : `${adapter}.${after}`

    const data = {
      before: before
        ? { elemID: new ElemID(adapter, before) }
        : undefined,
      after: after
        ? { elemID: new ElemID(adapter, after) }
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
      })
    }

    return { action, data, subChanges }
  }

  private static add(name: string, sub: Plan = []): PlanAction {
    return SaltoCoreMock.newAction('add', undefined, name, sub)
  }

  private static remove(name: string, sub: Plan = []): PlanAction {
    return SaltoCoreMock.newAction('remove', name, undefined, sub)
  }

  private static modify(name: string, sub: Plan = []): PlanAction {
    return SaltoCoreMock.newAction('modify', name, name, sub)
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  async apply(_blueprints: Blueprint[], dryRun?: boolean): Promise<Plan> {
    const changes = [
      SaltoCoreMock.add('lead.do_you_have_a_sales_team', [SaltoCoreMock.add('label'), SaltoCoreMock.add('defaultValue')]),
      SaltoCoreMock.modify('salesforce.lead.how_many_sales_people', [SaltoCoreMock.modify('restricttovalueset'),
        SaltoCoreMock.remove('values')]),
      SaltoCoreMock.add('lead.how_many_sales_people', [SaltoCoreMock.add('label'),
        SaltoCoreMock.add('restrict_to_value_set'), SaltoCoreMock.add('controlling_field'),
        SaltoCoreMock.add('values')]),
      SaltoCoreMock.remove('lead.status', [SaltoCoreMock.remove('label'), SaltoCoreMock.remove('defaultValue')])]
    if (!dryRun) {
      await this.runChangeMock(changes)
    }

    return changes
  }

  // eslint-disable-next-line class-methods-use-this
  async discover(): Promise<Blueprint> {
    return { buffer: Buffer.from('asd'), filename: 'none' }
  }
}
