import { EventEmitter } from 'events'
import _ from 'lodash'
import wu from 'wu'
import {
  PlanAction, ObjectType, isInstanceElement, InstanceElement, Element, Plan, ElemID,
} from 'adapter-api'

import { buildDiffGraph } from '../dag/diff'
import { DataNodeMap } from '../dag/nodemap'
import Parser from '../parser/salto'
import State from '../state/state'
import Blueprint from './blueprint'
import { adapters, init as initAdapters } from './adapters'

export interface CoreCallbacks {
  getConfigFromUser(configType: ObjectType): Promise<InstanceElement>
}

// Don't know if this should be extend or a delegation
export class SaltoCore extends EventEmitter {
  private state: State
  callbacks: CoreCallbacks
  constructor(callbacks: CoreCallbacks) {
    super()
    this.callbacks = callbacks
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
    const element = (action.data.after || action.data.before) as Element
    const adapter = adapters[element.elemID.adapter]
    if (!adapter) {
      throw new Error(`Missing adapter for ${element.elemID.adapter}`)
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

  async apply(blueprints: Blueprint[], dryRun?: boolean): Promise<Plan> {
    const elements = await this.getAllElements(blueprints)
    initAdapters(elements, this.callbacks.getConfigFromUser)

    const plan = await this.getPlan(elements)
    if (!dryRun) {
      await this.applyActions(plan)
    }
    return plan
  }

  async discover(blueprints: Blueprint[]): Promise<Blueprint> {
    const elements = await this.getAllElements(blueprints)
    elements.push(...await initAdapters(elements, this.callbacks.getConfigFromUser))
    Object.values(adapters).forEach(async adapter => elements.push(...await adapter.discover()))
    // Save state
    await this.state.saveState(elements)
    const buffer = await Parser.dump(elements)
    return { buffer, filename: 'none' }
  }
}
