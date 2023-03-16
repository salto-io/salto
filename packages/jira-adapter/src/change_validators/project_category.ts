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

import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../client/client'
import { isNeedToDeleteCategory } from '../filters/project_category'

const { awu } = collections.asynciterable

export const projectCategoryValidator: (client: JiraClient) =>
  ChangeValidator = client => async changes => {
    if (!client.isDataCenter) {
      return []
    }

    return awu(changes)
      .filter(isInstanceChange)
      .filter(isModificationChange)
      .filter(change => change.data.after.elemID.typeName === 'Project')
      .filter(isNeedToDeleteCategory)
      .map(getChangeData)
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Warning' as SeverityLevel,
        message: 'Changing project category to None is not supported',
        detailedMessage: 'Changing project category to None is not supported and the project category will not be changed in the service',
      }))
      .toArray()
  }
