/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { FixElementsFunc } from '@salto-io/adapter-api'
import { FixElementsArgs } from '@salto-io/adapter-components'
import { UserConfig } from '../config'
import { Options } from '../definitions/types'
import { replaceGroupsDomainHandler } from './replace_groups_domain'

export const createFixElementFunctions = (
  args: FixElementsArgs<Options, UserConfig>,
): Record<string, FixElementsFunc> => ({
  replaceGroupsDomain: replaceGroupsDomainHandler(args),
})
