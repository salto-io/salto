import { EventEmitter } from 'events'
import _ from 'lodash'
import {
  PlanAction, PlanActionType,
  ElementsRegistry, InstanceElement, ElemID, Element,
} from 'adapter-api'

import SalesforceAdapter from 'salesforce-adapter'
import Parser from '../parser/salto'


export interface Blueprint {
  buffer: Buffer
  filename: string
}

// Don't know if this should be extend or a delegation
export class SaltoCore extends EventEmitter {
  adapters: Record<string, SalesforceAdapter>
  constructor() {
    super()
    const configType = SalesforceAdapter.getConfigType()
    const value = {
      username: 'vanila@salto.io',
      password: '!A123456',
      token: 'rwVvOsh7HjF8Zki9ZmyQdeth',
      sandbox: false,
    }
    const elemID = new ElemID({ adapter: 'salesforce' })
    const config = new InstanceElement(elemID, configType, value)
    this.adapters = {
      salesforce: new SalesforceAdapter(config),
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async getAllElements(blueprints: Blueprint[]): Promise<Element[]> {
    let elements: Element[] = []
    const registry = new ElementsRegistry()
    for (let i = 0; i < blueprints.length; i += 1) {
      const parser = new Parser(registry)
      const bp = blueprints[i]
      // Can't run parser in parrallel
      // eslint-disable-next-line no-await-in-loop
      const res = await parser.parse(bp.buffer, bp.filename)
      if (res.errors.length > 0) {
        throw new Error(`Failed to parse blueprints: ${res.errors.join('\n')}`)
      }
      elements = [...elements, ...res.elements]
    }
    return elements
  }

  // eslint-disable-next-line class-methods-use-this
  private getPlan(allElements: Element[]): PlanAction[] {
    const nonBuiltInElements = allElements.filter(e => e.elemID.adapter)
    return nonBuiltInElements.map(
      element => PlanAction.createFromElements(undefined, element, element.elemID.getFullName()),
    )
  }

  private async applyAction(action: PlanAction): Promise<void> {
    this.emit('progress', action)
    /* istanbul ignore next */
    const existingValue = action.newValue || action.oldValue || {}
    const { elemID } = existingValue
    const adapterName = elemID && elemID.adapter as string
    const adapter = this.adapters[elemID.adapter]
    if (!adapter) {
      throw new Error(`Missing adapter for ${adapterName}`)
    }
    if (action.actionType === PlanActionType.ADD) {
      await adapter.add(action.newValue)
    }
    /* istanbul ignore next */
    if (action.actionType === PlanActionType.REMOVE) {
      await adapter.remove(action.oldValue)
    }
  }

  private async applyActions(plan: PlanAction[]): Promise<void> {
    if (!_.isEmpty(plan)) {
      const nextAction = plan[0]
      const remPlan = plan.slice(1)
      await this.applyAction(nextAction)
      await this.applyActions(remPlan)
    }
  }

  async apply(blueprints: Blueprint[], dryRun?: boolean): Promise<PlanAction[]> {
    const allElements = await this.getAllElements(blueprints)
    const plan = this.getPlan(allElements)
    if (!dryRun) {
      await this.applyActions(plan)
    }
    return plan
  }

  /* eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars */
  elementToHCL(element: Element, _maxDepth: number): string {
    return JSON.stringify(element, null, 2)
  }

  async discover(): Promise<Blueprint> {
    const types = await this.adapters.salesforce.discover()
    const buffer = await Parser.dump(types)
    return { buffer, filename: 'none' }
  }
}
