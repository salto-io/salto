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
  Element, ElemID, findInstances, findObjectType,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'


export const LEAD_CONVERT_SETTINGS_TYPE_ID = new ElemID(SALESFORCE, 'LeadConvertSettings')
export const LEAD_TYPE_ID = new ElemID(SALESFORCE, 'Lead')

/**
* Declare the lead convert settings filter, this filter fixes the LeadConvertSettings instance path.
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, fix LeadConvertSettings path to be under the Lead object directory.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const lead = findObjectType(elements, LEAD_TYPE_ID)
    const convertSettingsInst = [...findInstances(elements, LEAD_CONVERT_SETTINGS_TYPE_ID)].pop()
    if (convertSettingsInst && lead && lead.path) {
      convertSettingsInst.path = [...lead.path.slice(0, -1), convertSettingsInst.elemID.name]
    }
  },
})

export default filterCreator
