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
import _ from 'lodash'
import { InstanceElement, isReferenceExpression, TypeReference } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { generateType } from './type_elements'
import { AdapterDuckTypeApiConfig, getConfigWithDefault } from '../../config'
import { restoreInstanceTypeFromChange } from '../../deployment'

/**
 * Changes instance type to be suitable for the deploy (generated from the latest instance))
 */
export const replaceInstanceTypeForDeploy = ({
  instance,
  config,
}: {
  instance: InstanceElement
  config: AdapterDuckTypeApiConfig
}): InstanceElement => {
  const { typeName } = instance.elemID
  const { hasDynamicFields } = getConfigWithDefault(
    config.types[typeName]?.transformation ?? {},
    config.typeDefaults.transformation,
  )
  const clonedInstance = instance.clone()
  const generatedType = generateType({
    adapterName: clonedInstance.elemID.adapter,
    entries: [clonedInstance.value],
    hasDynamicFields: hasDynamicFields ?? false,
    name: typeName,
    transformationDefaultConfig: config.typeDefaults.transformation,
    transformationConfigByType: _.pickBy(
      _.mapValues(config.types, def => def.transformation),
      values.isDefined,
    ),
    isUnknownEntry: isReferenceExpression,
  })
  clonedInstance.refType = new TypeReference(generatedType.type.elemID, generatedType.type)
  return clonedInstance
}

/**
 * Restores instance type to have the original type (and not the fixed one for the deploy)
 */
export const restoreInstanceTypeFromDeploy = restoreInstanceTypeFromChange
