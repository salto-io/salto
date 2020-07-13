/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { EOL } from 'os'
import { Element } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { ParseResult, ParseError, SourceMap } from '../parser'
import { deserialize as deserializeElements, StaticFileReviver } from './deserializer'
import { serialize as serializeElements } from './serializer'


const serializeErrors = (errors: ParseError[]): string =>
  safeJsonStringify(errors)

const serializeSourceMap = (sourceMap: SourceMap): string => (
  safeJsonStringify(Array.from(sourceMap.entries()))
)

export const serialize = (parseResult: ParseResult): string => [
  serializeElements(parseResult.elements, {
    // When serializing for the cache, keep reference expressions
    // since the idea is to reflect the nacl files, not the state file.
    referenceSerializerMode: 'keepRef',
  }),
  serializeErrors(parseResult.errors),
  parseResult.sourceMap ? serializeSourceMap(parseResult.sourceMap) : undefined,
].filter(line => line !== undefined).join(EOL)

const deserializeParseErrors = (data: string): ParseError[] =>
  JSON.parse(data)

const deserializeSourceMap = (data: string): SourceMap => {
  const raw = JSON.parse(data)
  return new SourceMap(raw)
}

export const deserialize = async (
  data: string,
  staticFileReviver?: StaticFileReviver,
): Promise<ParseResult> => {
  const [elementsData, errorsData, sourceMapData] = data.split(EOL)
  const elements = await deserializeElements<Element[]>(elementsData, staticFileReviver)
  return {
    errors: deserializeParseErrors(errorsData),
    elements,
    sourceMap: sourceMapData ? deserializeSourceMap(sourceMapData) : undefined,
  }
}
