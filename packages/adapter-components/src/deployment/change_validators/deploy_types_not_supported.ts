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
import { ChangeValidator, getChangeData, isObjectType } from '@salto-io/adapter-api'

export const deployTypesNotSupportedValidator: ChangeValidator = async changes => (
  changes
    .map(getChangeData)
    .filter(isObjectType)
    .map(objectType => ({
      elemID: objectType.elemID,
      severity: 'Error',
      message: `Deployment of non-instance elements is not supported in adapter ${objectType.elemID.adapter}`,
      detailedMessage: `Deployment of non-instance elements is not supported in adapter ${objectType.elemID.adapter}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
    }))
)
