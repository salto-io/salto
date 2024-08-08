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

import { definitions } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { BLOG_POST_TYPE_NAME } from '../../constants'
import { validateValue } from './generic'
import { createAdjustUserReferencesReverse } from './users'
import { increaseVersion } from './version'

const { reduceAsync } = collections.asynciterable

export const adjustUserReferencesOnBlogPostReverse = createAdjustUserReferencesReverse(BLOG_POST_TYPE_NAME)

/**
 * AdjustFunction that runs all blog_post modification adjust functions.
 */
export const adjustBlogPostOnModification: definitions.AdjustFunctionSingle<
  definitions.deploy.ChangeAndContext
> = async args => {
  const value = validateValue(args.value)
  const argsWithValidatedValue = { ...args, value }
  return reduceAsync(
    [increaseVersion, adjustUserReferencesOnBlogPostReverse],
    async (input, func) => ({ ...argsWithValidatedValue, ...(await func(input)) }),
    argsWithValidatedValue,
  )
}
