import { SaltoState } from "./state"
import { Element, Type, InstanceElement } from "adapter-api"
import Parser from '../parser/salto'
import { Blueprint } from "../core/core"
import * as fs from 'async-file'
import _ from "lodash";

export class BpState implements SaltoState {
    private static STATEPATH = './.salto/latest_state.bp'
    /**
     * This method save the state
     * @param elements the elements to save
     */
    public async saveState(elements: (Type | InstanceElement)[]): Promise<void> {
        const buffer = await Parser.dump(elements)
        await this.dumpBlueprint({buffer, filename: BpState.STATEPATH})
    }

    /**
     * Retrieves the latest state saved
     * @returns the elements that represent the last saved state
     */ 
    public async getLastState(): Promise<Element[]> {
        const bp = await this.loadBlueprint(BpState.STATEPATH)
        const parseResults = await Parser.parse(bp.buffer, bp.filename)

        const elements = _.flatten(parseResults.elements)
        const errors = _.flatten(parseResults.errors)

        if (errors.length > 0) {
        throw new Error(`Failed to parse last state: ${errors.join('\n')}`)
        }
        return elements
    }

    /**
     * Write blueprint to file
     * @param blueprint The blueprint to dump
     */
    private async dumpBlueprint(blueprint: Blueprint): Promise<void> {
        return fs.writeFile(blueprint.filename, blueprint.buffer)
    }

    /**
     * Reads a blueprints file.
     * @param {string} blueprintsFile a path to a valid blueprints file.
     * @returns The content of the file.
     */
    private async loadBlueprint(blueprintFile: string): Promise<Blueprint> {
    return {
      buffer: await fs.readFile(blueprintFile, 'utf8'),
      filename: blueprintFile,
    }
  }
}