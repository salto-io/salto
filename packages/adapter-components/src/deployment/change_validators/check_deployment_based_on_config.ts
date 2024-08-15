/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { DeploymentRequestsByAction, DeployRequestConfig, TypeConfig } from '../../config_deprecated'

const { awu } = collections.asynciterable

export const ERROR_MESSAGE = 'Operation not supported'

export const detailedErrorMessage = (action: Change['action'], path: ElemID): string =>
  `Salto does not support "${action}" of ${path.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`

const isDeploymentSupported = (action: Change['action'], config: DeploymentRequestsByAction): boolean =>
  config[action] !== undefined

const createChangeErrors = (
  typeConfig: Partial<Record<ActionName, DeployRequestConfig>>,
  instanceElemID: ElemID,
  action: ActionName,
): ChangeError[] => {
  if (!isDeploymentSupported(action, typeConfig)) {
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

export const createCheckDeploymentBasedOnConfigValidator =
  ({
    typesConfig,
    typesDeployedViaParent = [],
    typesWithNoDeploy = [],
  }: {
    typesConfig: Record<string, TypeConfig>
    typesDeployedViaParent?: string[]
    typesWithNoDeploy?: string[]
  }): ChangeValidator =>
  async changes =>
    awu(changes)
      .map(async (change: Change<Element>): Promise<(ChangeError | undefined)[]> => {
        const element = getChangeData(change)
        if (!isInstanceElement(element)) {
          return []
        }
        const getChangeErrorsByTypeName = (typeName: string): ChangeError[] => {
          const typeConfig = typesConfig[typeName]?.deployRequests ?? {}
          return createChangeErrors(typeConfig, element.elemID, change.action)
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
