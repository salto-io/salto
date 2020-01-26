import _ from 'lodash'
import { ElementsSource } from '../../tmp/elements_datasource'
import { Element, ElemID, getChangeElement } from 'adapter-api'
import { DetailedChange } from '../../core/plan'
import { mergeElements, MergeError } from 'src/core/merger'
import { routeChanges } from './routers'

export class UnknownEnviornmentError extends Error {
  constructor(envName: string) {
    super(`Unknown enviornment ${envName}`)
  }
}

export class UnsupportedNewEnvChangeError extends Error {
  constructor(change: DetailedChange){
    const changeElemID = getChangeElement(change).elemID.getFullName()
    const message = `Adding a new enviornment only support add changes.` + 
      `Received change of type ${change.action} for ${changeElemID}`
    super(message)
  }
}

export class MultiEnvSource implements ElementsSource{
  
  
  private elements?: Record<string, Element>
  public errors?: MergeError[]

  constructor(
      private primarySource: ElementsSource,
      private commonSource?: ElementsSource,
      private secondarySources : Record<string, ElementsSource> = {}
    ) {
  }

  private invalidateElements(): void {
    this.elements = undefined
    this.errors = undefined
  }

  private async updateElements(): Promise<void> {
    const allActiveElements = _.flatten(
      await Promise.all(this.getActiveSources().map(s => s.getAll()))
    )
    const mergeResult = mergeElements(allActiveElements)
    this.elements = _.keyBy(mergeResult.merged, e => e.elemID.getFullName())
    this.errors = mergeResult.errors
  }


  async update(changes: DetailedChange[], compact: boolean = false): Promise<void> {
    this.invalidateElements()
    if (!this.commonSource) {
      return this.primarySource.update(changes)
    }
    const routedChanges = await routeChanges(
      changes,
      this.primarySource,
      this.commonSource,
      this.secondarySources, 
      compact  
    )
    const secondaryChanges = routedChanges.secondarySources || {} 
    await Promise.all([
      this.primarySource.update(routedChanges.primarySource || []),
      this.commonSource.update(routedChanges.commonSource || []),
      ... _.keys(secondaryChanges).map(k => this.secondarySources[k].update(secondaryChanges[k]))
    ])
  }

  private getActiveSources(): ElementsSource[] {
    return this.commonSource ? [this.primarySource, this.commonSource] : [this.primarySource]
  }

  async list(): Promise<ElemID[]> {
    if (!this.elements) {
      await this.updateElements()
    }
    return this.elements ? _.values(this.elements).map(e => e.elemID) : []
  }

  async get(id: ElemID): Promise<Element | undefined> {
    if (!this.elements) {
      await this.updateElements()
    }
    return this.elements && this.elements[id.getFullName()]
  }

  async getAll(): Promise<Element[]> {
    if (!this.elements) {
      await this.updateElements()
    }
    return _.values(this.elements)
  }

  async has(id: ElemID): Promise<boolean> {
    return await this.get(id) !== undefined
  }
}