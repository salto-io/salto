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
import { createSaltoElementErrorFromError, isSaltoElementError, isSaltoError } from '@salto-io/adapter-api'
import { APIDefinitionsOptions, ApiDefinitions, ResolveCustomNameMappingOptionsType, UserConfig } from '../definitions'
import { AdapterFilterCreator, FilterResult } from '../filter_utils'
import { FieldReferenceDefinition } from '../references'
import { hideTypesFilterCreator } from './hide_types'
import { defaultDeployFilterCreator } from './default_deploy'
import { fieldReferencesFilterCreator } from './field_references'
import { queryFilterCreator } from './query'

/**
 * Filter creators of all the common filters
 */
export const createCommonFilters = <
  Options extends APIDefinitionsOptions,
  Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>,
>({
  referenceRules,
}: {
  referenceRules?: FieldReferenceDefinition<never>[]
  config: Co
  definitions: ApiDefinitions<Options>
}): Record<string, AdapterFilterCreator<Co, FilterResult, {}, Options>> => ({
  // TODO SALTO-5421 finish upgrading filters to new def structure and add remaining shared filters
  hideTypes: hideTypesFilterCreator(),
  // fieldReferencesFilter should run after all elements were created
  fieldReferencesFilter: fieldReferencesFilterCreator(referenceRules),
  // referencedInstanceNames should run after fieldReferencesFilter
  // referencedInstanceNames: referencedInstanceNamesFilterCreator(), // TODO add back after SALTO-5421
  query: queryFilterCreator({}),
  // defaultDeploy should run after other deploy filters
  defaultDeploy: defaultDeployFilterCreator({
    convertError: (elemID, error) => {
      if (isSaltoError(error) && isSaltoElementError(error)) {
        return error
      }
      return createSaltoElementErrorFromError({ error, severity: 'Error', elemID })
    },
  }),
})
