import {
  Type, PrimitiveTypes, TypeID, TypesRegistry, PlanActionType, PlanAction,
} from 'adapter-api'
import { SaltoCore, Blueprint } from '../../../src/core/core'

// Don't know if this should be extend or a delegation
export default class SaltoCoreMock extends SaltoCore {
  constructor() {
    super()
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  async getAllElements(_blueprints: Blueprint[] = []): Promise<Type[]> {
    const reg = new TypesRegistry()
    const saltoAddr = reg.getType(new TypeID({ adapter: 'salto', name: 'address' }))
    saltoAddr.annotations.label = reg.getType(new TypeID({ adapter: '', name: 'string' }))
    saltoAddr.fields.country = reg.getType(new TypeID({ adapter: '', name: 'string' }))
    saltoAddr.fields.city = reg.getType(new TypeID({ adapter: '', name: 'string' }))

    const saltoOffice = reg.getType(new TypeID({ adapter: 'salto', name: 'office' }))
    saltoOffice.annotations.label = reg.getType(new TypeID({ adapter: '', name: 'string' }))
    saltoOffice.fields.name = reg.getType(new TypeID({ adapter: '', name: 'string' }))
    saltoOffice.fields.location = reg.getType(new TypeID({ adapter: 'salto', name: 'address' })).clone({
      label: 'Office Location',
      description: 'A location of an office',
    })

    const saltoEmployee = reg.getType(new TypeID({ adapter: 'salto', name: 'employee' }))
    saltoEmployee.fields.name = reg.getType(new TypeID({ adapter: '', name: 'string' })).clone({
      _required: true,
    })
    saltoEmployee.fields.nicknames = reg.getType(
      new TypeID({ adapter: 'salto', name: 'nicknames' }),
      PrimitiveTypes.LIST,
    )

    saltoEmployee.fields.nicknames.elementType = reg.getType(new TypeID({ adapter: '', name: 'string' }))
    /* eslint-disable-next-line @typescript-eslint/camelcase */
    saltoEmployee.fields.employee_resident = reg.getType(new TypeID({ adapter: 'salto', name: 'address' })).clone({
      label: 'Employee Resident',
    })
    saltoEmployee.fields.company = reg.getType(new TypeID({ adapter: '', name: 'string' })).clone({
      _default: 'salto',
    })
    saltoEmployee.fields.office = reg.getType(new TypeID({ adapter: 'salto', name: 'office' })).clone({
      label: 'Based In',
    })
    saltoEmployee.fields.office.fields.name.annotationsValues[Type.DEFAULT] = 'HQ'
    saltoEmployee.fields.office.fields.location.fields.country.annotationsValues[
      Type.DEFAULT
    ] = 'IL'
    saltoEmployee.fields.office.fields.location.fields.city.annotationsValues[
      Type.DEFAULT
    ] = 'Raanana'

    return [saltoAddr, saltoOffice, saltoEmployee]
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
}
