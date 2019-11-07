import _ from 'lodash'
import { Element } from 'adapter-api'
import { logger } from '@salto/logging'
import { readTextFile, writeTextFile } from '../file'
import { serialize, deserialize } from '../serializer/elements'

const log = logger(module)

const formatElements = (elements: Element[]): string =>
  elements.map(e => e.elemID.getFullName()).join()
const countElements = (elements: Element[]): number =>
  _.size(elements)
/**
 * Salto state - an interface for managing the state between runs
 */
export default class State {
    public statePath: string
    private state?: Element[]
    constructor(statePath: string) {
      this.statePath = statePath
    }

    public async get(): Promise<Element[]> {
      if (!this.state) {
        this.state = await this.read()
        log.debug(`loaded state [#elements=${countElements(this.state)}]`)
      }
      return this.state as Element[]
    }

    public async update(elements: Element[]): Promise<void> {
      const current = await this.get()
      elements.forEach(element => {
        const index = State.find(current, element)
        if (index === -1) {
          current.push(element)
        } else {
          current.splice(index, 1, element)
        }
      })
      log.debug(`updated elements=${formatElements(elements)}]`)
    }

    public async remove(elements: Element[]): Promise<void> {
      const current = await this.get()
      elements.forEach(element => {
        _.remove(current, _.matches(element))
      })
      log.debug(`removed elements=${formatElements(elements)}]`)
    }

    /**
     * This method save the current state
     */
    public async flush(): Promise<void> {
      // If state is not loaded we don't have anything to save
      if (!this.state) return
      const buffer = serialize(this.state)
      await writeTextFile(this.statePath, buffer)
      log.debug(`finish flushing state [#elements=${countElements(this.state)}]`)
    }

    /**
     * This method override current state with given elements and save the state
     * @param elements the elements to save
     */
    public override(elements: Element[]): void {
      this.state = elements
      log.debug(`overrided state [#elements=${countElements(this.state)}]`)
    }

    /**
     * Retrieves the latest state saved
     * @returns the elements that represent the last saved state
     */
    private async read(): Promise<Element[]> {
      const text = await readTextFile.notFoundAsUndefined(this.statePath)
      if (text === undefined) {
        return []
      }
      try {
        return deserialize(text)
      } catch (err) {
        throw new Error(`Failed to load state: ${err}`)
      }
    }

    private static find(elements: Element[], element: Element): number {
      return elements.findIndex(e => e.elemID.getFullName() === element.elemID.getFullName())
    }
}
