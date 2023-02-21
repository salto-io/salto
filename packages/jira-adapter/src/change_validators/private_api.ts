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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { JiraConfig } from '../config/config'
import { PRIORITY_TYPE_NAME, RESOLUTION_TYPE_NAME, STATUS_TYPE_NAME } from '../constants'

const RELEVANT_TYPES = [STATUS_TYPE_NAME, PRIORITY_TYPE_NAME, RESOLUTION_TYPE_NAME]

export const privateApiValidator: (config: JiraConfig) => ChangeValidator = config =>
  async changes => {
    if (config.client.usePrivateAPI) {
      return []
    }
    return changes
      .filter(isInstanceChange)
      .filter(change => RELEVANT_TYPES.includes(getChangeData(change).elemID.typeName))
      .map(change => ({
        elemID: getChangeData(change).elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Deploying this element requires Jira Private API',
        detailedMessage: 'To deploy this element, private Jira API usage must be enabled. Enable it by setting the jira.client.usePrivateAPI flag to “true” in your Jira environment configuration.',
      }))
  }
