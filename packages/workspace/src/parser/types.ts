/*
*                      Copyright 2021 Salto Labs Ltd.
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

import { SaltoError, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { HclParseError } from './internal/types'
import { SourceMap } from './source_map'

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>
export type ParseError = HclParseError & SaltoError

export type ParseResult = {
  elements: ThenableIterable<Element>
  errors: ParseError[]
  sourceMap?: SourceMap
}
