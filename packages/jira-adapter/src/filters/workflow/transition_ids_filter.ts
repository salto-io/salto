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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance } from './types'

/**
 * A filter that deletes the transition ids from all the workflows.
 * We delete the ids since they are not env friendly and not needed
 * (since we implement modification of a workflow with addition and removal)
 */
const filter: FilterCreator = () => ({
  name: 'transitionIdsFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(isWorkflowInstance)
      .forEach(instance => {
        instance.value.transitions?.forEach(transition => {
          // We don't need to id after this filter since
          // in modification we remove and create a new workflow
          delete transition.id
        })
      })
  },
})

export default filter
