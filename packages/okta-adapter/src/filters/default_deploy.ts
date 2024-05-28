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
import { Change, InstanceElement, isInstanceChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { defaultDeployWithStatus, deployChanges } from '../deployment'

/**
 * Deploys all the changes that were not deployed by the previous filters
 */
const filterCreator: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'defaultDeployFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const client = definitions.clients.options.main.httpClient
    const deployResult = await deployChanges(changes.filter(isInstanceChange), async change => {
      await defaultDeployWithStatus(change, client, oldApiDefinitions.apiDefinitions)
    })
    return { deployResult, leftoverChanges: [] }
  },
})

export default filterCreator
