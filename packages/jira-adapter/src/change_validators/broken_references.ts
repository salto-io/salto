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
  isAdditionOrModificationChange,
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  SeverityLevel,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { prettifyName } from '@salto-io/adapter-utils'
import { BROKEN_REFERENCE_TYPE_MAP } from '../filters/broken_reference_filter'

const capitalizeFirstLetter = (input: string): string => input.charAt(0).toUpperCase() + input.slice(1)

export const brokenReferenceValidator: ChangeValidator = async changes =>
  Object.entries(BROKEN_REFERENCE_TYPE_MAP).flatMap(([typeName, typeInfos]) =>
    typeInfos.flatMap(typeInfo =>
      changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === typeName)
        .filter(instance => instance.value[typeInfo.location] !== undefined)
        .map(instance => ({
          instance,
          brokenReferencesNames: instance.value[typeInfo.location]
            .filter(typeInfo.filter)
            .map((referencedValue: Value) => _.get(referencedValue, typeInfo.namePath)),
        }))
        .filter(({ brokenReferencesNames }) => brokenReferencesNames.length > 0)
        .map(({ instance, brokenReferencesNames }) => {
          const brokenReferencesNamesString = brokenReferencesNames.join(', ')
          const prettyTypeName = prettifyName(typeName).toLowerCase()
          const referencesName = typeInfo.referencesTypeName
          if (typeInfo.mustHaveReference && brokenReferencesNames.length === instance.value[typeInfo.location].length) {
            return {
              elemID: instance.elemID,
              severity: 'Error' as SeverityLevel,
              message: `${capitalizeFirstLetter(prettyTypeName)} isn’t attached to any existing ${typeInfo.singleReferenceTypeName}`,
              detailedMessage:
                `All ${referencesName} attached to this ${prettyTypeName} do not exist in the target environment: ` +
                `${brokenReferencesNamesString}. The ${prettyTypeName} can’t be deployed. To solve this, go back ` +
                `and include at least one attached ${typeInfo.singleReferenceTypeName} in your deployment.`,
            }
          }
          return {
            elemID: instance.elemID,
            severity: 'Warning' as SeverityLevel,
            message: `${capitalizeFirstLetter(prettyTypeName)} won’t be attached to some ${referencesName}`,
            detailedMessage:
              `The ${prettyTypeName} is attached to some ${referencesName} which do not exist in the target environment: ` +
              `${brokenReferencesNamesString}. If you continue, the ${prettyTypeName} will be deployed without them. ` +
              `Alternatively, you can go back and include these ${referencesName} in your deployment.`,
          }
        }),
    ),
  )
