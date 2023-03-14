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
import { Change, ChangeError, ChangeValidator, getChangeData, isInstanceChange, Element, isRemovalChange, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { transformValues } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { getDiffInstance } from '../diff'

const { awu } = collections.asynciterable
const { OPERATION_TO_ANNOTATION } = deployment

const detailedNestedElementErrorMessage = (
  path: ElemID,
  action: Change['action'],
): string => {
  const nestedPart = path.getFullNameParts().slice(path.nestingLevel * -1).join('.')
  return action === 'modify'
    ? `Deploying "${nestedPart}" in ${path.createBaseID().parent.getFullName()} is not supported. The current value in the target environment will not be modified`
    : `Deploying "${nestedPart}" in ${path.createBaseID().parent.getFullName()} is not supported. The instance will be created with the default value of the target environment`
}

const detailedTopLevelErrorMessage = (action: Change['action'], path: ElemID): string =>
  `Salto does not support "${action}" of ${path.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`

const isDeploymentSupported = (element: Element, action: Change['action']): boolean =>
  element.annotations[OPERATION_TO_ANNOTATION[action]]
  || element.annotations[OPERATION_TO_ANNOTATION[action]] === undefined

const getUnsupportedPaths = async (change: Change<InstanceElement>)
: Promise<{ field: ElemID; path: ElemID}[]> => {
  const unsupportedPaths: { field: ElemID; path: ElemID}[] = []
  const diffInstance = getDiffInstance(change)

  await transformValues({
    values: diffInstance.value,
    type: await diffInstance.getType(),
    pathID: diffInstance.elemID,
    transformFunc: async ({ value, field, path }) => {
      if (field !== undefined
        && !isDeploymentSupported(field, change.action)
        && path !== undefined) {
        unsupportedPaths.push({ field: field.elemID, path })
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
      const instance = getChangeData(change)
      const type = await instance.getType()
      if (!isDeploymentSupported(type, change.action)) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Operation not supported',
          detailedMessage: detailedTopLevelErrorMessage(change.action, instance.elemID),
        }]
      }

      if (isRemovalChange(change)) {
        return []
      }

      const unsupportedPaths = await getUnsupportedPaths(change)

      return unsupportedPaths.map(({ path }) => ({
        elemID: path,
        severity: 'Info',
        message: 'Operation not supported for specific value',
        detailedMessage: detailedNestedElementErrorMessage(path, change.action),
      }))
    })
    .flat()
    .filter(values.isDefined)
    .toArray()
)
