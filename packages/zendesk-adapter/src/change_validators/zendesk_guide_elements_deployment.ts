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
import { ChangeValidator, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { GUIDE_INSTANCE_TYPES } from '../config/config'

// TO DO - remove after supporting on multiple brands deployment - SALTO-2769
export const zendeskGuideElementsDeploymentValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(change => GUIDE_INSTANCE_TYPES.includes(getChangeData(change).elemID.typeName))
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Deployment of Zendesk Guide elements is not supported.',
      detailedMessage: `Element ${instance.elemID.getFullName()} which related to the brand ${instance.value.brand_id.elemID.getFullName()} cannot be deployed.`,
    }))
)
