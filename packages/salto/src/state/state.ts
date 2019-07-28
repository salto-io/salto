import { Element } from 'adapter-api'
import * as fs from 'async-file'
import * as path from 'path'
import os from 'os'
import Parser from '../parser/salto'

const STATEPATH = path.join(os.homedir(), '.salto/latest_state.bp')
/**
 * Salto state - an interface for managing the state between runs
 */
export default class State {
    public statePath: string
    constructor(statePath: string = STATEPATH) {
      this.statePath = statePath
    }

    /**
     * This method save the state
     * @param elements the elements to save
     */
    public async saveState(elements: Element[]): Promise<void> {
      const buffer = await Parser.dump(elements)
      await fs.createDirectory(path.dirname(this.statePath))
      await fs.writeFile(this.statePath, buffer)
    }

    /**
     * Retrieves the latest state saved
     * @returns the elements that represent the last saved state
     */
    public async getLastState(): Promise<Element[]> {
      let buffer: Buffer
      try {
        const exists = await fs.exists(this.statePath)
        if (!exists) {
          return []
        }
        buffer = await fs.readFile(this.statePath, 'utf8')
      } catch (err) {
        throw new Error(`Failed to access state file: ${err}`)
      }
      const parseResults = await Parser.parse(buffer, this.statePath)

      if (parseResults.errors.length > 0) {
        throw new Error(`Failed to parse last state: ${parseResults.errors.join('\n')}`)
      }
      return parseResults.elements
    }
}
