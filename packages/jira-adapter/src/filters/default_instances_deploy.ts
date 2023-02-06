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
import { isInstanceChange } from '@salto-io/adapter-api'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'

const filter: FilterCreator = ({ client, config }) => ({
  name: 'defaultInstancesDeployFilter',
  deploy: async changes => {
    const deployResult = await deployChanges(
      changes.filter(isInstanceChange),
      async change => {
        await defaultDeployChange({ change, client, apiDefinitions: config.apiDefinitions })
      },
    )

    return {
      leftoverChanges: [],
      deployResult,
    }
  },
})

export default filter
