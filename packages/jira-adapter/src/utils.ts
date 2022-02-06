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
import { CORE_ANNOTATIONS, ObjectType, Element, isObjectType, Values } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { JiraConfig } from './config'

export const setDeploymentAnnotations = (contextType: ObjectType, fieldName: string): void => {
  if (contextType.fields[fieldName] !== undefined) {
    contextType.fields[fieldName].annotations[CORE_ANNOTATIONS.CREATABLE] = true
    contextType.fields[fieldName].annotations[CORE_ANNOTATIONS.UPDATABLE] = true
  }
}

export const findObject = (elements: Element[], name: string): ObjectType | undefined =>
  elements.filter(isObjectType).find(
    element => element.elemID.name === name
  )

export const generateInstanceName = (
  values: Values,
  typeName: string,
  config: JiraConfig
): string | undefined => {
  const { idFields } = configUtils.getConfigWithDefault(
    config.apiDefinitions.types[typeName].transformation,
    config.apiDefinitions.typeDefaults.transformation
  )
  return elementUtils.getInstanceName(values, idFields)
}
