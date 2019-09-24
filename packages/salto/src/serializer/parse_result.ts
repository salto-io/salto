import { EOL } from 'os'
import { ParseResult, ParseError, SourceMap } from '../parser/parse'
import * as elementSerializer from './elements'

const serializeErrors = (errors: ParseError[]): string =>
  JSON.stringify(errors)

const serializeSourceMap = (sourceMap: SourceMap): string =>
  JSON.stringify(Array.from(sourceMap.entries()))

export const serialize = (parseResult: ParseResult): string => [
  elementSerializer.serialize(parseResult.elements),
  serializeErrors(parseResult.errors),
  serializeSourceMap(parseResult.sourceMap),
].join(EOL)

const deserializeParseErrors = (data: string): ParseError[] =>
  JSON.parse(data)

const deserializeSourceMap = (data: string): SourceMap =>
  new Map(JSON.parse(data))

export const deserialize = (data: string): ParseResult => {
  const [elementsData, errorsData, sourceMapData] = data.split(EOL)
  return {
    elements: elementSerializer.deserialize(elementsData),
    errors: deserializeParseErrors(errorsData),
    sourceMap: deserializeSourceMap(sourceMapData),
  }
}
