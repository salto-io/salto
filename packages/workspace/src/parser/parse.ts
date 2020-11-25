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
  SourceRange as InternalSourceRange,
} from './internal/types'
import { parseBufferAndFixErrors } from './internal/nearly/parse'
import {
  Functions,
} from './functions'
import { parseBuffer } from './internal/native/parse'
import { ParseResult } from './types'

export { parseElemID } from './internal/nearly/converter/elements'
export { IllegalReference } from './internal/types'

// Re-export these types because we do not want code outside the parser to import hcl
export type SourceRange = InternalSourceRange

/**
 * Parse a Nacl file
 *
 * @param naclFile A buffer the contains the Nacl file to parse
 * @param filename The name of the file from which the Nacl file was read
 * @param functions
 * @returns elements: Type elements found in the Nacl file
 *          errors: Errors encountered during parsing
 */
export const parse = async (
  naclFile: Buffer,
  filename: string,
  functions: Functions = {},
): Promise<Required<ParseResult>> => {
  const srcString = naclFile.toString()
  return process.env.USE_NATIVE_PARSER
    ? parseBuffer(srcString, filename, functions)
    : parseBufferAndFixErrors(srcString, filename, functions)
}
