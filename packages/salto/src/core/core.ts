import { EventEmitter } from 'events'
import { Type, PrimitiveTypes, getType } from './elements'

export enum PlanActionType {
  ADD,
  MODIFY,
  REMOVE,
}

export class PlanAction {
  name: string
  actionType: PlanActionType
  subChanges: PlanAction[]
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  newValue: any
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  oldValue: any
  constructor(
    name: string,
    actionType: PlanActionType,
    subChanges?: PlanAction[],
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    newValue?: any,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    oldValue?: any
  ) {
    this.name = name
    this.actionType = actionType
    this.subChanges = subChanges || []
    this.newValue = newValue
    this.oldValue = oldValue
  }
}

// Don't know if this should be extend or a delegation
export class SaltoCore extends EventEmitter {
  constructor() {
    super()
  }

  // eslint-disable-next-line class-methods-use-this
  getAllElements(): Type[] {
    const saltoAddr = getType('salto_address')
    saltoAddr.annotations.label = getType('string')
    saltoAddr.fields.country = getType('string')
    saltoAddr.fields.city = getType('string')

    const saltoOffice = getType('salto_office')
    saltoOffice.annotations.label = getType('string')
    saltoOffice.fields.name = getType('string')
    saltoOffice.fields.location = getType('salto_address').clone({
      label: 'Office Location',
      description: 'A location of an office',
    })

    const saltoEmployee = getType('salto_employee')
    saltoEmployee.fields.name = getType('string').clone({
      _required: true,
    })
    saltoEmployee.fields.nicknames = getType(
      'salto_nicknamed',
      PrimitiveTypes.LIST
    )
    saltoEmployee.fields.nicknames.elementType = getType('string')
    /* eslint-disable-next-line @typescript-eslint/camelcase */
    saltoEmployee.fields.employee_resident = getType('salto_address').clone({
      label: 'Employee Resident',
    })
    saltoEmployee.fields.company = getType('string').clone({
      _default: 'salto',
    })
    saltoEmployee.fields.office = getType('salto_office').clone({
      label: 'Based In',
    })
    saltoEmployee.fields.office.fields.name.annotationsValues[Type.DEFAULT] =
      'HQ'
    saltoEmployee.fields.office.fields.location.fields.country.annotationsValues[
      Type.DEFAULT
    ] = 'IL'
    saltoEmployee.fields.office.fields.location.fields.city.annotationsValues[
      Type.DEFAULT
    ] = 'Raanana'

    return [saltoAddr, saltoOffice, saltoEmployee]
  }

  private async runChange(changes: PlanAction[]): Promise<void> {
    if (changes.length > 0) {
      const change = changes[0]
      this.emit('progress', change)
      await new Promise(resolve => setTimeout(resolve, 10))
      await this.runChange(changes.slice(1))
    }
  }

  async apply(_blueprints: string[], dryRun?: boolean): Promise<PlanAction[]> {
    const changes = [
      new PlanAction(
        'salesforcelead do_you_have_a_sales_team',
        PlanActionType.ADD,
        [
          new PlanAction(
            'label',
            PlanActionType.ADD,
            [],
            'Do you have a sales team'
          ),
          new PlanAction('defaultvalue', PlanActionType.ADD, [], false),
        ]
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
            true
          ),
          new PlanAction('values', PlanActionType.REMOVE),
        ]
      ),
      new PlanAction(
        'salesforcelead how_many_sales_people',
        PlanActionType.ADD,
        [
          new PlanAction(
            'label',
            PlanActionType.ADD,
            [],
            'How many Sales people?'
          ),
          new PlanAction('restrict_to_value_set', PlanActionType.ADD, [], true),
          new PlanAction('controlling_field', PlanActionType.ADD, [], 'test'),
          new PlanAction(
            'values',
            PlanActionType.ADD,
            [],
            ['1-10', '11-20', '21-30', '30+']
          ),
        ]
      ),
    ]

    if (!dryRun) {
      await this.runChange(changes)
    }

    return changes
  }

  /* eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars */
  elementToHCL(element: Type, _maxDepth: number): string {
    return JSON.stringify(element, null, 2)
  }
}
