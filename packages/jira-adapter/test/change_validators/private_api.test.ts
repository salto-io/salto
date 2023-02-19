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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { privateApiValidator } from '../../src/change_validators/private_api'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('privateApiValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) })
    instance = new InstanceElement('instance', type)
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  })
  it('should return an error if privateAPI is disabled', async () => {
    config.client.usePrivateAPI = false
    expect(await privateApiValidator(config)([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Deploying this element requires Jira Private API',
        detailedMessage: 'To deploy this element, private Jira API usage must be enabled. Enable it by setting the jira.client.usePrivateAPI flag to “true” in your Jira environment configuration.',
      },
    ])
  })

  it('should not return an error if privateAPI is enabled', async () => {
    config.client.usePrivateAPI = true

    expect(await privateApiValidator(config)([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })
})
