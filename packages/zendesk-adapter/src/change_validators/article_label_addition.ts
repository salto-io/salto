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
import _ from 'lodash'
import { ChangeValidator, getChangeData, isAdditionChange, isAdditionOrModificationChange, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { ARTICLE_LABEL_TYPE_NAME, ARTICLE_TYPE_NAME } from '../constants'

export const articleLabelAdditionValidator: ChangeValidator = async changes => {
  const labelRefsFromArticleModifications = _.uniq(changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
    .flatMap(articleInstance => articleInstance.value.label_names))

  const labelFullNames = labelRefsFromArticleModifications
    .filter(isReferenceExpression)
    .map(labelRef => labelRef.elemID.getFullName())

  return changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ARTICLE_LABEL_TYPE_NAME)
    .filter(labelInstance => !labelFullNames.includes(labelInstance.elemID.getFullName()))
    .flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Label has not been added',
        detailedMessage: `${instance.value.name} label has not been added, please make sure to assign it to articles`,
      }]
    ))
}
