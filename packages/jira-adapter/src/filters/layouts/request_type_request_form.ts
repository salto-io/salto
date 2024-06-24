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

import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { fetchRequestTypeDetails } from './layout_service_operations'

const filter: FilterCreator = ({ client, config, fetchQuery, getElemIdFunc }) => ({
  name: 'requestTypeLayoutsFilter',
  onFetch: async elements => {
    await fetchRequestTypeDetails({
      elements,
      client,
      config,
      fetchQuery,
      getElemIdFunc,
      typeName: REQUEST_FORM_TYPE,
    })
    await fetchRequestTypeDetails({
      elements,
      client,
      config,
      fetchQuery,
      getElemIdFunc,
      typeName: ISSUE_VIEW_TYPE,
    })
  },
})

export default filter
