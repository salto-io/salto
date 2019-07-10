import {
  Type, PrimitiveTypes, ElemID, PlanActionType, PlanAction, ObjectType, PrimitiveType, ListType,
} from 'adapter-api'
import { SaltoCore, Blueprint, CoreCallbacks } from '../../../src/core/core'

// Don't know if this should be extend or a delegation
export default class SaltoCoreMock extends SaltoCore {
  constructor(callbacks: CoreCallbacks) {
    super(callbacks)
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  async getAllElements(_blueprints: Blueprint[] = []): Promise<Type[]> {
    const stringType = new PrimitiveType({
      elemID: new ElemID({ name: 'string' }),
      primitive: PrimitiveTypes.STRING,
    })
    const saltoAddr = new ObjectType({
      elemID: new ElemID({ adapter: 'salto', name: 'address' }),
    })
    saltoAddr.annotations.label = stringType
    saltoAddr.fields.country = stringType
    saltoAddr.fields.city = stringType

    const saltoOffice = new ObjectType({
      elemID: new ElemID({ adapter: 'salto', name: 'office' }),
    })
    saltoOffice.annotations.label = stringType
    saltoOffice.fields.name = stringType
    saltoOffice.fields.location = saltoAddr
    saltoOffice.annotationsValues.location = {
      label: 'Office Location',
      description: 'A location of an office',
    }

    const saltoEmployee = new ObjectType({
      elemID: new ElemID({ adapter: 'salto', name: 'employee' }),
    })
    saltoEmployee.fields.name = stringType
    saltoEmployee.annotationsValues.name = {
      _required: true,
    }
    saltoEmployee.fields.nicknames = new ListType({
      elemID: new ElemID({ adapter: 'salto', name: 'nicknames' }),
      elementType: stringType,
    })
    /* eslint-disable-next-line @typescript-eslint/camelcase */
    saltoEmployee.fields.employee_resident = saltoAddr
    /* eslint-disable-next-line @typescript-eslint/camelcase */
    saltoEmployee.annotationsValues.employee_resident = {
      label: 'Employee Resident',
    }
    saltoEmployee.fields.company = stringType
    saltoEmployee.annotationsValues.company = {
      _default: 'salto',
    }
    saltoEmployee.fields.office = saltoOffice
    saltoEmployee.annotationsValues.office = {
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
    }

    return [stringType, saltoAddr, saltoOffice, saltoEmployee]
  }

  private async runChangeMock(changes: PlanAction[]): Promise<void> {
    if (changes.length > 0) {
      const change = changes[0]
      this.emit('progress', change)
      await new Promise(resolve => setTimeout(resolve, 10))
      await this.runChangeMock(changes.slice(1))
    }
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  async apply(_blueprints: Blueprint[], dryRun?: boolean): Promise<PlanAction[]> {
    const changes = [
      new PlanAction(
        'salesforcelead do_you_have_a_sales_team',
        PlanActionType.ADD,
        [
          new PlanAction(
            'label',
            PlanActionType.ADD,
            [],
            'Do you have a sales team',
          ),
          new PlanAction('defaultvalue', PlanActionType.ADD, [], false),
        ],
      ),
      new PlanAction(
        'salesforcelead how_many_sales_people',
        PlanActionType.MODIFY,
        [
          new PlanAction(
            'restricttovalueset',
            PlanActionType.MODIFY,
            [],
            false,
            true,
          ),
          new PlanAction('values', PlanActionType.REMOVE),
        ],
      ),
      new PlanAction(
        'salesforcelead how_many_sales_people',
        PlanActionType.ADD,
        [
          new PlanAction(
            'label',
            PlanActionType.ADD,
            [],
            'How many Sales people?',
          ),
          new PlanAction('restrict_to_value_set', PlanActionType.ADD, [], true),
          new PlanAction('controlling_field', PlanActionType.ADD, [], 'test'),
          new PlanAction(
            'values',
            PlanActionType.ADD,
            [],
            ['1-10', '11-20', '21-30', '30+'],
          ),
        ],
      ),
    ]

    if (!dryRun) {
      await this.runChangeMock(changes)
    }

    return changes
  }

  /* eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars */
  elementToHCL(element: Type, _maxDepth: number): string {
    return JSON.stringify(element, null, 2)
  }

  // eslint-disable-next-line class-methods-use-this
  async discover(): Promise<Blueprint> {
    return { buffer: Buffer.from('asd'), filename: 'none' }
  }
}
