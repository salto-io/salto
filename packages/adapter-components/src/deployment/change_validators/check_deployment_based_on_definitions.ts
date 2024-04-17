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
import _ from 'lodash'
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  Element,
  ElemID,
  isInstanceElement,
  isReferenceExpression,
  ActionName,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { DeployApiDefinitions, DeployableRequestDefinition } from '../../definitions/system/deploy'
import { DefaultWithCustomizations, queryWithDefault } from '../../definitions'
import { ERROR_MESSAGE, detailedErrorMessage } from './check_deployment_based_on_config'

const { awu } = collections.asynciterable

const createChangeErrors = (
  typeConfig: DefaultWithCustomizations<DeployableRequestDefinition<never>[], ActionName>,
  instanceElemID: ElemID,
  action: ActionName,
): ChangeError[] => {
  const requestsByAction = queryWithDefault(typeConfig).query(action)
  if (!requestsByAction) {
    return [
      {
        elemID: instanceElemID,
        severity: 'Error',
        message: ERROR_MESSAGE,
        detailedMessage: detailedErrorMessage(action, instanceElemID),
      },
    ]
  }
  return []
}

export const createCheckDeploymentBasedOnDefinitionsValidator = ({
  typesConfig,
  typesDeployedViaParent = [],
  typesWithNoDeploy = [],
}: {
  typesConfig: DeployApiDefinitions<never, never>
  typesDeployedViaParent?: string[]
  typesWithNoDeploy?: string[]
}): ChangeValidator => {
  const typeConfigQuery = queryWithDefault(typesConfig.instances)
  return async changes =>
    awu(changes)
      .map(async (change: Change<Element>): Promise<(ChangeError | undefined)[]> => {
        const element = getChangeData(change)
        if (!isInstanceElement(element)) {
          return []
        }
        const getChangeErrorsByTypeName = (typeName: string): ChangeError[] => {
          const requestsByAction = typeConfigQuery.query(typeName)?.requestsByAction ?? {}
          return createChangeErrors(requestsByAction, element.elemID, change.action)
        }
        if (typesWithNoDeploy.includes(element.elemID.typeName)) {
          return []
        }
        if (typesDeployedViaParent.includes(element.elemID.typeName)) {
          const parents = getParents(element)
          if (
            !_.isEmpty(parents) &&
            parents.every(isReferenceExpression) &&
            parents.every(parent => isInstanceElement(parent.value))
          ) {
            const parentTypeName = _.uniq(parents.map(p => p.value.elemID.typeName))
            return parentTypeName.flatMap(getChangeErrorsByTypeName)
          }
        }
        return getChangeErrorsByTypeName(element.elemID.typeName)
      })
      .flat()
      .toArray()
}
