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
import wu from 'wu'
import {
  Element, ElemID, findInstances,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { SALESFORCE } from '../constants'

export const ASSIGNMENT_RULES_TYPE_ID = new ElemID(SALESFORCE, 'AssignmentRules')

/**
* Declare the assignment rules filter, this filter renames assignment rules instances to match
* the names in the Salesforce UI
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, rename assignment rules instances
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    wu(findInstances(elements, ASSIGNMENT_RULES_TYPE_ID))
      .forEach(rule => {
        // We aim to get `LeadAssignmentRules` and `CaseAssignmentRules`, since the instance
        // name we get from the API is Lead / Case we can just use the instance name followed by
        // AssignmentRules to get the desired name
        const newName = `${apiName(rule)}${ASSIGNMENT_RULES_TYPE_ID.name}`
        // Replace the element ID
        _.set(rule, 'elemID', rule.type.elemID.createNestedID('instance', newName))
      })
  },
})

export default filterCreator
