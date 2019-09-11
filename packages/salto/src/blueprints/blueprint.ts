import _ from 'lodash'
import { Element } from 'adapter-api'
import Parser, { SourceMap } from '../parser/salto'
import { Error as HclError } from '../parser/hcl'

export interface Blueprint {
  buffer: Buffer
  filename: string
}

export type Error = HclError

export interface ParsedBlueprint extends Blueprint {
  elements: Element[]
  errors: Error[]
  sourceMap: SourceMap
}

export const parseBlueprints = (blueprints: Blueprint[]): Promise<ParsedBlueprint[]> =>
  Promise.all(blueprints.map(async bp => ({
    ...bp,
    ...(await Parser.parse(bp.buffer, bp.filename)),
  })))

export const getAllElements = async (blueprints: Blueprint[]): Promise<Element[]> => {
  const parseResults = await parseBlueprints(blueprints)

  const elements = _.flatten(parseResults.map(r => r.elements))
  const errors = _.flatten(parseResults.map(r => r.errors))

  if (errors.length > 0) {
    throw new Error(`Failed to parse blueprints: ${errors.join('\n')}`)
  }

  return elements
}
