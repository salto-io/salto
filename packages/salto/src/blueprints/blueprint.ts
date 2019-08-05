import _ from 'lodash'
import { Element } from 'adapter-api'
import Parser from '../parser/salto'

export interface Blueprint {
  buffer: Buffer
  filename: string
}

export const getAllElements = async (blueprints: Blueprint[]): Promise<Element[]> => {
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
