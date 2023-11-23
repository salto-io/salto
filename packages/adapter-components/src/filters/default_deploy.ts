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
import { Change, ElemID, InstanceElement, SaltoElementError, isInstanceChange } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { AdapterFilterCreator } from '../filter_utils'
import { deployChanges } from '../deployment'
import { generateLookupFunc } from '../references'
import { ChangeAndContext } from '../definitions/system/deploy'
import { createChangeElementResolver } from '../resolve_utils'

/**
 * Default deploy based on deploy definitions.
 * Note: when there are other filters running custom deploy, they should usually run before this filter.
 */
export const defaultDeployFilterCreator =
  <
    TResult extends void | filter.FilterResult,
    ClientOptions extends string,
    PaginationOptions extends string | 'none',
    AdditionalAction extends string,
  >({
    deployChangeFunc,
    convertError,
  }: {
    deployChangeFunc?: (args: ChangeAndContext) => Promise<void>
    convertError: (elemID: ElemID, error: Error) => Error | SaltoElementError
  }): AdapterFilterCreator<{}, TResult, {}, ClientOptions, PaginationOptions, AdditionalAction> =>
  ({ definitions, elementSource }) => ({
    name: 'defaultDeployFilter',
    deploy: async (changes, changeGroup) => {
      const { deploy, ...otherDefs } = definitions
      if (deploy === undefined) {
        throw new Error('could not find deploy definitions')
      }
      if (changeGroup === undefined) {
        throw new Error('change group not provided')
      }

      const lookupFunc = generateLookupFunc(
        definitions.references?.rules ?? [],
      )
      const changeResolver = createChangeElementResolver<Change<InstanceElement>>({ getLookUpName: lookupFunc })

      const deployResult = await deployChanges({
        changes: changes.filter(isInstanceChange),
        changeGroup,
        elementSource,
        deployChangeFunc,
        convertError,
        definitions: { deploy, ...otherDefs },
        changeResolver,
      })
      return { deployResult, leftoverChanges: [] }
    },
  })
