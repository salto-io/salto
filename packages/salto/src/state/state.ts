import { Element, Type, InstanceElement } from 'adapter-api'
import * as fs from 'async-file'
import _ from 'lodash'
import Parser from '../parser/salto'

/**
 * Salto state - an interface for managing the state between runs
 */
export default class State {
    private static STATEPATH = './.salto/latest_state.bp'
    /**
     * This method save the state
     * @param elements the elements to save
     */
    public static async saveState(elements: (Type | InstanceElement)[]): Promise<void> {
      const buffer = await Parser.dump(elements)
      await fs.writeFile(State.STATEPATH, buffer)
    }

    /**
     * Retrieves the latest state saved
     * @returns the elements that represent the last saved state
     */
    public static async getLastState(): Promise<Element[]> {
      const buffer = await fs.readFile(State.STATEPATH, 'utf8')
      const parseResults = await Parser.parse(buffer, State.STATEPATH)

      const elements = _.flatten(parseResults.elements)
      const errors = _.flatten(parseResults.errors)

      if (errors.length > 0) {
        throw new Error(`Failed to parse last state: ${errors.join('\n')}`)
      }
      return elements
    }
}
