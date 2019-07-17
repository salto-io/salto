import { Element } from 'adapter-api'
import * as fs from 'async-file'
import _ from 'lodash'
import * as path from 'path'
import Parser from '../parser/salto'

/**
 * Salto state - an interface for managing the state between runs
 */
export default class State {
    private static STATEPATH = path.join(__dirname, '.salto/latest_state.bp')
    /**
     * This method save the state
     * @param elements the elements to save
     */
    public static async saveState(elements: Element[]): Promise<void> {
      const buffer = await Parser.dump(elements)
      await fs.createDirectory(path.dirname(this.STATEPATH))
      await fs.writeFile(State.STATEPATH, buffer)
    }

    /**
     * Retrieves the latest state saved
     * @returns the elements that represent the last saved state
     */
    public static async getLastState(): Promise<Element[]> {
      let buffer: Buffer
      try {
        buffer = await fs.readFile(State.STATEPATH, 'utf8')
      } catch (err) {
        return []
      }
      const parseResults = await Parser.parse(buffer, State.STATEPATH)

      const elements = _.flatten(parseResults.elements)
      const errors = _.flatten(parseResults.errors)

      if (errors.length > 0) {
        throw new Error(`Failed to parse last state: ${errors.join('\n')}`)
      }
      return elements
    }
}
