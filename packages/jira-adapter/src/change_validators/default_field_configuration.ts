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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange, SaltoErrorSeverity } from '@salto-io/adapter-api'

export const defaultFieldConfigurationValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === 'FieldConfiguration')
    .filter(change => getChangeData(change).value.isDefault)
    .flatMap(change => ['name', 'description']
      .filter(fieldName => (
        change.data.before.value[fieldName] !== change.data.after.value[fieldName]
      ))
      .map(fieldName => ({
        elemID: getChangeData(change).elemID,
        severity: 'Warning' as SaltoErrorSeverity,
        message: `Deploying the "${fieldName}" value in a default field configuration is not supported`,
        detailedMessage: `Deploying the "${fieldName}" value in the default field configuration ${getChangeData(change).elemID.getFullName()} is not supported and will be omitted from the deployment`,
      })))
)
