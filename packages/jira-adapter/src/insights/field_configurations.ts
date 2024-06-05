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
import { GetInsightsFunc, InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { FIELD_CONFIGURATION_TYPE_NAME } from '../constants'
import { isFieldInstance } from './custom_fields'

const FIELD_CONFIGURATION = 'fieldConfiguration'

const isFieldConfigurationInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME

const isMultilineTextFieldConfigurationWithoutWikiRenderer = (
  fieldConfiguration: Value,
  fieldInstance: InstanceElement | undefined,
): boolean =>
  fieldInstance !== undefined &&
  fieldInstance.value.type === 'com.atlassian.jira.plugin.system.customfieldtypes:textarea' &&
  _.isPlainObject(fieldConfiguration) &&
  fieldConfiguration.renderer !== 'wiki-renderer'

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement)
  const fieldInstancesMap = _.keyBy(instances.filter(isFieldInstance), instance => instance.elemID.name)
  const fieldConfigurations = instances.filter(isFieldConfigurationInstance).flatMap(instance =>
    Object.entries(instance.value.fields ?? {}).map(([key, value]) => ({
      path: instance.elemID.createNestedID('fields', key),
      value,
    })),
  )

  const multilineTextFieldConfigurationsWithoutWikiRenderer = fieldConfigurations
    .filter(field =>
      isMultilineTextFieldConfigurationWithoutWikiRenderer(field.value, fieldInstancesMap[field.path.name]),
    )
    .map(field => ({
      path: field.path,
      ruleId: `${FIELD_CONFIGURATION}.multilineWithoutWikiRenderer`,
      message: 'Multiline text field without wiki renderer',
    }))

  return multilineTextFieldConfigurationsWithoutWikiRenderer
}

export default getInsights
