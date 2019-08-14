import _ from 'lodash'
import { Element } from 'adapter-api'
import * as fs from 'async-file'
import * as path from 'path'
import os from 'os'
import { serialize, deserialize } from './serializer'

const STATEPATH = path.join(os.homedir(), '.salto/latest_state.bp')
/**
 * Salto state - an interface for managing the state between runs
 */
export default class State {
    public statePath: string
    private state?: Element[]
    constructor(statePath: string = STATEPATH) {
      this.statePath = statePath
    }

    public async get(): Promise<Element[]> {
      if (!this.state) {
        this.state = await this.read()
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
    }

    public async remove(elements: Element[]): Promise<void> {
      const current = await this.get()
      elements.forEach(element => {
        _.remove(current, _.matches(element))
      })
    }

    /**
     * This method save the current state
     */
    public async flush(): Promise<void> {
      // If state is not loaded we don't have anything to save
      if (!this.state) return
      const buffer = serialize(this.state)
      await fs.createDirectory(path.dirname(this.statePath))
      await fs.writeFile(this.statePath, buffer)
    }

    /**
     * This method override current state with given elements and save the state
     * @param elements the elements to save
     */
    public override(elements: Element[]): void {
      this.state = elements
    }

    /**
     * Retrieves the latest state saved
     * @returns the elements that represent the last saved state
     */
    private async read(): Promise<Element[]> {
      let data: string
      try {
        const exists = await fs.exists(this.statePath)
        if (!exists) {
          return []
        }
        data = await fs.readFile(this.statePath, 'utf8')
        return deserialize(data)
      } catch (err) {
        throw new Error(`Failed to load state: ${err}`)
      }
    }

    private static find(elements: Element[], element: Element): number {
      return elements.findIndex(e => e.elemID.getFullName() === element.elemID.getFullName())
    }
}
