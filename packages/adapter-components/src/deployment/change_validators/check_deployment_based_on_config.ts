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
import _ from 'lodash'
import { Change, ChangeError, ChangeValidator, getChangeData, Element, ElemID, isInstanceElement,
  isReferenceExpression, ActionName } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { AdapterApiConfig, DeploymentRequestsByAction, DeployRequestConfig } from '../../config'

const { awu } = collections.asynciterable

const ERROR_MESSAGE = 'Operation not supported'

const detailedErrorMessage = (action: Change['action'], path: ElemID): string =>
  `Salto does not support "${action}" of ${path.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`

const isDeploymentSupported = (
  action: Change['action'], config: DeploymentRequestsByAction
): boolean => config[action] !== undefined

const createChangeErrors = (
  typeConfig: Partial<Record<ActionName, DeployRequestConfig>>,
  instanceElemID: ElemID,
  action: ActionName,
): ChangeError[] => {
  if (!isDeploymentSupported(action, typeConfig)) {
    return [{
      elemID: instanceElemID,
      severity: 'Error',
      message: ERROR_MESSAGE,
      detailedMessage: detailedErrorMessage(action, instanceElemID),
    }]
  }
  return []
}

export const createCheckDeploymentBasedOnConfigValidator = ({
  apiConfig, typesDeployedViaParent = [], typesWithNoDeploy = [],
}: {
  apiConfig: AdapterApiConfig
  typesDeployedViaParent?: string[]
  typesWithNoDeploy?: string[]
}): ChangeValidator => async changes => (
  awu(changes)
    .map(async (change: Change<Element>): Promise<(ChangeError | undefined)[]> => {
      const element = getChangeData(change)
      if (!isInstanceElement(element)) {
        return []
      }
      const getChangeErrorsByTypeName = (typeName: string): ChangeError[] => {
        const typeConfig = apiConfig?.types?.[typeName]?.deployRequests ?? {}
        return createChangeErrors(typeConfig, element.elemID, change.action)
      }
      if (typesWithNoDeploy.includes(element.elemID.typeName)) {
        return []
      }
      if (typesDeployedViaParent.includes(element.elemID.typeName)) {
        const parents = getParents(element)
        if (!_.isEmpty(parents)
          && parents.every(isReferenceExpression)
          && parents.every(parent => isInstanceElement(parent.value))
        ) {
          const parentTypeName = _.uniq(parents.map(p => p.value.elemID.typeName))
          return parentTypeName.flatMap(getChangeErrorsByTypeName)
        }
      }
      return getChangeErrorsByTypeName(element.elemID.typeName)
    })
    .flat()
    .toArray()
)
