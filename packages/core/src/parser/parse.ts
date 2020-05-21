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
import {
  Element, SaltoError,
} from '@salto-io/adapter-api'
import { flattenElementStr } from '@salto-io/adapter-utils'
import {
  SourceRange as InternalSourceRange,
  HclParseError,
} from './internal/types'
import { parse as hclParse } from './internal/parse'
import {
  Functions,
} from './functions'
import { SourceMap } from './internal/source_map'


// Re-export these types because we do not want code outside the parser to import hcl
export type SourceRange = InternalSourceRange
export type ParseError = HclParseError & SaltoError

export const mergeSourceMaps = (sourceMaps: SourceMap[]): SourceMap => {
  const result = new SourceMap()
  sourceMaps.forEach(sourceMap => {
    sourceMap.forEach((ranges, key) => {
      result.push(key, ...ranges)
    })
  })
  return result
}

export type ParseResult = {
  elements: Element[]
  errors: ParseError[]
  sourceMap: SourceMap
}

/**
 * Parse a Nacl file
 *
 * @param naclFile A buffer the contains the Nacl file to parse
 * @param filename The name of the file from which the Nacl file was read
 * @returns elements: Type elements found in the Nacl file
 *          errors: Errors encountered during parsing
 */
export const parse = async (
  naclFile: Buffer,
  filename: string,
  functions: Functions = {},
): Promise<ParseResult> => {
  const { elements, errors, sourceMap } = await hclParse(naclFile, filename, functions)
  return {
    elements: elements.map(flattenElementStr),
    errors,
    sourceMap,
  }
}
