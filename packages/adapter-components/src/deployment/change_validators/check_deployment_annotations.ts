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
import { Change, ChangeError, ChangeValidator, getChangeElement, isInstanceChange, Element, isModificationChange, isRemovalChange, InstanceElement, ElemID, isReferenceExpression, compareSpecialValues } from '@salto-io/adapter-api'
import { resolvePath, setPath, transformValues, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { DEPLOYMENT_ANNOTATIONS } from '../annotations'

const { awu } = collections.asynciterable

const ERROR_MESSAGE = 'Operation not supported'

const detailedErrorMessage = (action: Change['action'], path: ElemID): string =>
  `Salto does not support "${action}" of ${path.getFullName()}`

const isDeploymentSupported = (element: Element, action: Change['action']): boolean =>
  (action === 'add' && element.annotations[DEPLOYMENT_ANNOTATIONS.CREATABLE])
    || (action === 'modify' && element.annotations[DEPLOYMENT_ANNOTATIONS.UPDATABLE])
    || (action === 'remove' && element.annotations[DEPLOYMENT_ANNOTATIONS.DELETABLE])

const getDiffInstance = (change: Change<InstanceElement>): InstanceElement => {
  const instance = getChangeElement(change)

  const diffInstance = instance.clone()

  if (isModificationChange(change)) {
    walkOnElement({
      element: change.data.before,
      func: ({ value, path }) => {
        if (_.isObject(value) && !isReferenceExpression(value)) {
          return WALK_NEXT_STEP.RECURSE
        }

        const valueAfter = resolvePath(instance, path)

        if (_.isEqualWith(value, valueAfter, compareSpecialValues)) {
          setPath(diffInstance, path, undefined)
        }
        return WALK_NEXT_STEP.RECURSE
      },
    })
  }

  return diffInstance
}

const getUnsupportedPaths = async (change: Change<InstanceElement>): Promise<ElemID[]> => {
  const unsupportedPaths: ElemID[] = []
  const diffInstance = getDiffInstance(change)

  await transformValues({
    values: diffInstance.value,
    type: await diffInstance.getType(),
    pathID: diffInstance.elemID,
    transformFunc: async ({ value, field, path }) => {
      if (field !== undefined
        && !isDeploymentSupported(field, change.action)
        && path !== undefined) {
        unsupportedPaths.push(path)
        return undefined
      }
      return value
    },
  })

  return unsupportedPaths
}

export const checkDeploymentAnnotationsValidator: ChangeValidator = async changes => (
  awu(changes)
    .map(async (change: Change<Element>): Promise<(ChangeError | undefined)[]> => {
      if (!isInstanceChange(change)) {
        return []
      }
      const instance = getChangeElement(change)
      const type = await instance.getType()
      if (!isDeploymentSupported(type, change.action)) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: ERROR_MESSAGE,
          detailedMessage: detailedErrorMessage(change.action, instance.elemID),
        }]
      }

      if (isRemovalChange(change)) {
        return []
      }

      const unsupportedPaths = await getUnsupportedPaths(change)

      return unsupportedPaths.map(path => ({
        elemID: instance.elemID,
        severity: 'Error',
        message: ERROR_MESSAGE,
        detailedMessage: detailedErrorMessage(change.action, path),
      }))
    })
    .flat()
    .filter(values.isDefined)
    .toArray()
)
