/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Change, ChangeError, ChangeValidator, getChangeElement, isInstanceChange, Element, ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { AdapterApiConfig, DeploymentRequestsByAction } from '../../config'

const { awu } = collections.asynciterable

const ERROR_MESSAGE = 'Operation not supported'

const detailedErrorMessage = (action: Change['action'], path: ElemID): string =>
  `Salto does not support "${action}" of ${path.getFullName()}`

const isDeploymentSupported = (
  action: Change['action'], config: DeploymentRequestsByAction
): boolean => config[action] !== undefined

export const createCheckDeploymentBasedOnConfigValidator = (apiConfig: AdapterApiConfig):
ChangeValidator => async changes => (
  awu(changes)
    .map(async (change: Change<Element>): Promise<(ChangeError | undefined)[]> => {
      if (!isInstanceChange(change)) {
        return []
      }
      const instance = getChangeElement(change)
      const typeConfig = apiConfig?.types?.[instance.elemID.typeName]?.deployRequests ?? {}
      if (!isDeploymentSupported(change.action, typeConfig)) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: ERROR_MESSAGE,
          detailedMessage: detailedErrorMessage(change.action, instance.elemID),
        }]
      }
      return []
    })
    .flat()
    .toArray()
)
