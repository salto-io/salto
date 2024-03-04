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
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  SeverityLevel,
  isRemovalChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE } from '../../constants'
import { JiraConfig } from '../../config/config'

const { awu } = collections.asynciterable

/*
 * This validator prevents the deletion of the label attribute of an objectType.
 */
export const deleteLabelAtttributeValidator: (config: JiraConfig) => ChangeValidator =
  config => async (changes, elementsSource) => {
    if (elementsSource === undefined || !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium)) {
      return []
    }
    const objectTypeAttributeRemovalChanges = await awu(changes)
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE)
      .toArray()

    if (objectTypeAttributeRemovalChanges.length === 0) {
      return []
    }

    const labelAttributesFullNames = await awu(await elementsSource.list())
      .filter(id => id.typeName === OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE)
      .map(id => elementsSource.get(id))
      .filter(isInstanceElement)
      .filter(instance => isReferenceExpression(instance.value.labelAttribute))
      .map(instance => instance.value.labelAttribute.elemID.getFullName())
      .toArray()

    return objectTypeAttributeRemovalChanges
      .filter(instance => labelAttributesFullNames.includes(instance.elemID.getFullName()))
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot delete this attribute, as it is the label attribute of its Object Type.',
        detailedMessage: 'Cannot delete this attribute, as it is the label attribute of its objectType.',
      }))
  }
