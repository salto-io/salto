/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { filters } from '@salto-io/adapter-components'
import { FilterContext } from '../config'
import { FilterCreator, FilterResult } from '../filter'
import OktaClient from '../client/client'

/**
 *  Resolves references in elements name using referenced idFields
 *
 */
const filter: FilterCreator = params =>
  filters.referencedInstanceNamesFilterCreator<OktaClient, FilterContext, FilterResult>(
  )(params)

export default filter
