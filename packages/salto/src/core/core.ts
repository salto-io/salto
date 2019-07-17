import { EventEmitter } from 'events'
import _ from 'lodash'
import wu from 'wu'
import {
  PlanAction, ObjectType, isInstanceElement, InstanceElement, Element, Plan, ElemID,
} from 'adapter-api'
import SalesforceAdapter from 'salesforce-adapter'

import { buildDiffGraph } from '../dag/diff'
import { DataNodeMap } from '../dag/nodemap'
import Parser from '../parser/salto'
import State from '../state/state'

export interface Blueprint {
  buffer: Buffer
  filename: string
}

export interface CoreCallbacks {
  getConfigFromUser(configType: ObjectType): Promise<InstanceElement>
}

// Don't know if this should be extend or a delegation
export class SaltoCore extends EventEmitter {
  private state: State
  adapters: Record<string, SalesforceAdapter>
  callbacks: CoreCallbacks
  constructor(callbacks: CoreCallbacks) {
    super()
    this.callbacks = callbacks
    this.adapters = {}
    this.state = new State()
  }

  // eslint-disable-next-line class-methods-use-this
  async getAllElements(blueprints: Blueprint[]): Promise<Element[]> {
    const parseResults = await Promise.all(blueprints.map(
      bp => Parser.parse(bp.buffer, bp.filename)
    ))

    const elements = _.flatten(parseResults.map(r => r.elements))
    const errors = _.flatten(parseResults.map(r => r.errors))

    if (errors.length > 0) {
      throw new Error(`Failed to parse blueprints: ${errors.join('\n')}`)
    }
    return elements
  }

  // eslint-disable-next-line class-methods-use-this
  private async getPlan(allElements: Element[]): Promise<Plan> {
    const toNodeMap = (elements: Element[]): DataNodeMap<Element> => {
      const nodeMap = new DataNodeMap<Element>()
      elements.filter(e => e.elemID.adapter)
        .filter(e => e.elemID.name !== ElemID.CONFIG_INSTANCE_NAME)
        .forEach(element => nodeMap.addNode(element.elemID.getFullName(), [], element))
      return nodeMap
    }
    const before = toNodeMap(await this.state.getLastState())
    const after = toNodeMap(allElements)

    // TODO: enable this once we support instances and we can add test coverage
    // if (isInstanceElement(element)) {
    //   dependsOn.push(element.type.elemID.getFullName())
    // }
    // TODO: split elements to fields and fields values
    const diffGraph = buildDiffGraph(before, after,
      id => _.isEqual(before.getData(id), after.getData(id)))
    return wu(diffGraph.evaluationOrder()).map(id => (diffGraph.getData(id) as PlanAction))
  }

  private async applyAction(action: PlanAction): Promise<void> {
    this.emit('progress', action)
    const existingValue = (action.data.after || action.data.before) as Element
    const { elemID } = existingValue
    const adapterName = elemID && elemID.adapter as string
    const adapter = this.adapters[adapterName]
    if (!adapter) {
      throw new Error(`Missing adapter for ${adapterName}`)
    }
    if (action.action === 'add') {
      await adapter.add(action.data.after as ObjectType)
    }
    if (action.action === 'remove') {
      await adapter.remove(action.data.before as ObjectType)
    }
    if (action.action === 'modify') {
      await adapter.update(action.data.before as ObjectType, action.data.after as ObjectType)
    }
  }

  private async applyActions(plan: Plan): Promise<void> {
    return wu(plan).reduce((result, action) => result.then(() => this.applyAction(action)),
      Promise.resolve())
  }

  private async getConfigInstance(
    elements: Element[],
    configType: ObjectType
  ): Promise<InstanceElement> {
    const configElements = elements.filter(
      element => isInstanceElement(element)
      && element.type.elemID.getFullName() === configType.elemID.getFullName()
    )
    const configElement = configElements.pop() as InstanceElement
    if (configElement) {
      return configElement
    }
    return this.callbacks.getConfigFromUser(configType)
  }

  private initAdapters(salesforceConfig: InstanceElement): void {
    if (!this.adapters.salesforce) {
      this.adapters.salesforce = new SalesforceAdapter(salesforceConfig)
    }
  }

  async apply(blueprints: Blueprint[], dryRun?: boolean): Promise<Plan> {
    const elements = await this.getAllElements(blueprints)
    const salesforceConfigType = SalesforceAdapter.getConfigType()
    const salesforceConfig = await this.getConfigInstance(elements, salesforceConfigType)
    await this.initAdapters(salesforceConfig)

    const plan = await this.getPlan(elements)
    if (!dryRun) {
      await this.applyActions(plan)
    }
    return plan
  }

  /* eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars */
  elementToHCL(element: Element, _maxDepth: number): string {
    return JSON.stringify(element, null, 2)
  }

  async discover(blueprints: Blueprint[]): Promise<Blueprint> {
    const elements = await this.getAllElements(blueprints)
    const salesforceConfigType = SalesforceAdapter.getConfigType()
    const salesforceConfig = await this.getConfigInstance(elements, salesforceConfigType)
    await this.initAdapters(salesforceConfig)
    const discoverElements = await this.adapters.salesforce.discover()
    const uniqElements = [...discoverElements, salesforceConfig]
    // Save state
    await this.state.saveState(uniqElements)
    const buffer = await Parser.dump(uniqElements)
    return { buffer, filename: 'none' }
  }
}
