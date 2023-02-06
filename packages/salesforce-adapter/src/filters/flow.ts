/*
*                      Copyright 2023 Salto Labs Ltd.
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
  Element, ElemID, getRestriction,
} from '@salto-io/adapter-api'
import {
  findObjectType,
} from '@salto-io/adapter-utils'
import { FilterWith } from '../filter'
import { SALESFORCE } from '../constants'

export const FLOW_METADATA_TYPE_ID = new ElemID(SALESFORCE, 'FlowMetadataValue')

/**
 * Create filter that handles flow type/instances corner case.
 */
const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'flowFilter',
  /**
   * Upon fetch remove restriction values from flowMetadataValue.name.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    // fix flowMetadataValue - mark restriction values as not enforced, see: SALTO-93
    const flowMetadataValue = findObjectType(elements, FLOW_METADATA_TYPE_ID)
    if (flowMetadataValue && flowMetadataValue.fields.name) {
      // eslint-disable-next-line camelcase
      getRestriction(flowMetadataValue.fields.name).enforce_value = false
    }
  },
})

export default filterCreator
