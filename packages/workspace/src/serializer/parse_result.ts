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

import { values, collections } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'

import { ParseResult, ParseError, SourceMap } from '../parser'
import * as elementSerializer from './elements'

const { awu } = collections.asynciterable

export type ParseResultMetadata = {
  md5: string
}

type SerializeableParseResult = ParseResult & {
  metadata?: ParseResultMetadata
}


const serializeErrors = (errors: ParseError[]): string =>
  safeJsonStringify(errors)

const serializeSourceMap = (sourceMap: SourceMap): string => (
  safeJsonStringify(Array.from(sourceMap.entries()))
)

export const serialize = async (parseResult: SerializeableParseResult): Promise<string> => [
  // When serializing for the cache, keep reference expressions
  // since the idea is to reflect the nacl files, not the state file.
  elementSerializer.serialize(await awu(parseResult.elements).toArray(), 'keepRef'),
  serializeErrors(parseResult.errors),
  parseResult.sourceMap ? serializeSourceMap(parseResult.sourceMap) : undefined,
  JSON.stringify(parseResult.metadata),
].join(EOL)

const deserializeParseErrors = (data: string): ParseError[] =>
  JSON.parse(data)

const deserializeSourceMap = (data: string): SourceMap => {
  const raw = JSON.parse(data)
  return new SourceMap(raw)
}

export const deserialize = async (
  data: string,
  staticFileReviver?: elementSerializer.StaticFileReviver,
): Promise<ParseResult> => {
  const [elementsData, errorsData, sourceMapData] = data.split(EOL)
  const elements = await elementSerializer.deserialize(elementsData, staticFileReviver)
  return {
    errors: deserializeParseErrors(errorsData),
    elements,
    sourceMap: sourceMapData ? deserializeSourceMap(sourceMapData) : undefined,
  }
}

export const deserializeMetadata = (
  data: string,
): ParseResultMetadata | undefined => {
  // We seperate the deserialization of the metadata from the rest of the object to prevent
  // unessecery desirialization of the rest of the object since the metadata of the object can be
  // used to determine whether the deserialization of the rest of the object is even necessery
  const metadata = data.split(EOL)[3]
  return values.isDefined(metadata) ? JSON.parse(metadata) : undefined
}
