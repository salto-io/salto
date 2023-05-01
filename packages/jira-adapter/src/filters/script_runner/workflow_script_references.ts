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

import { extractTemplate, walkOnValue, WalkOnFunc, WALK_NEXT_STEP, replaceTemplatesWithValues, resolveTemplates } from '@salto-io/adapter-utils'
import { InstanceElement, isInstanceElement, TemplateExpression, ReferenceExpression, Element, Value, isAdditionOrModificationChange, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'
import { SCRIPT_RUNNER_DC_TYPES } from './workflow_dc'
import { SCRIPT_RUNNER_CLOUD_TYPES } from './workflow_cloud'
import { prepRef } from '../automation/smart_values/smart_value_reference_filter'

const log = logger(module)

const CUSTOM_FIELD_PATTERN = /(customfield_\d+)/
const SCRIPT_DC_FIELDS = ['FIELD_CONDITION', 'FIELD_ADDITIONAL_SCRIPT', 'FIELD_SCRIPT_FILE_OR_SCRIPT']
const SCRIPT_CLOUD_FIELDS = ['expression', 'additionalCode', 'emailCode', 'condition']

type referenceFunc = (value: Value, fieldName: string) => void

const removeTemplateReferences = (originalInstances: Record<string, TemplateExpression>): referenceFunc => (
  value: Value,
  fieldName: string,
): void => {
  try {
    replaceTemplatesWithValues(
      { values: [value], fieldName },
      originalInstances,
      prepRef,
    )
  } catch (e) {
    log.error(`Error parsing templates in deployment during template removal for fieldName ${fieldName}`, e)
  }
}

const restoreTemplateReferences = (originalInstances: Record<string, TemplateExpression>): referenceFunc => (
  value: Value,
  fieldName: string,
): void => {
  try {
    resolveTemplates(
      { values: [value], fieldName },
      originalInstances,
    )
  } catch (e) {
    log.error(`Error parsing templates in deployment during template restore for fieldName ${fieldName}`, e)
  }
}

const referenceCustomFields = (script: string, fieldInstancesById: Map<string, InstanceElement>)
  : TemplateExpression | string => extractTemplate(
  script,
  [CUSTOM_FIELD_PATTERN],
  expression => {
    const instance = fieldInstancesById.get(expression)
    if (!expression.match(CUSTOM_FIELD_PATTERN) || instance === undefined) {
      return expression
    }
    return new ReferenceExpression(instance.elemID, instance)
  }
)

const addTemplateReferences = (fieldInstancesById: Map<string, InstanceElement>)
  : referenceFunc => (value: Value, fieldName: string): void => {
  value[fieldName] = referenceCustomFields(value[fieldName], fieldInstancesById)
}

const isCloudScriptRunnerItem = (value: Value): boolean =>
  SCRIPT_RUNNER_CLOUD_TYPES.includes(value.type) && value.configuration.scriptRunner !== undefined

const walkOnCloudScripts = (func: (value: string, fieldName: string) => void)
  : WalkOnFunc => ({ value }): WALK_NEXT_STEP => {
  if (value === undefined) {
    return WALK_NEXT_STEP.SKIP
  }
  if (isCloudScriptRunnerItem(value)) {
    SCRIPT_CLOUD_FIELDS.forEach(fieldName => {
      if (value.configuration.scriptRunner[fieldName] !== undefined) {
        func(value.configuration.scriptRunner, fieldName)
      }
    })
    return WALK_NEXT_STEP.SKIP
  }
  return WALK_NEXT_STEP.RECURSE
}

const isDCScriptRunnerItem = (value: Value): boolean =>
  SCRIPT_RUNNER_DC_TYPES.includes(value.type) && value.configuration !== undefined

const walkOnDcScripts = (func: referenceFunc)
  : WalkOnFunc => ({ value }): WALK_NEXT_STEP => {
  if (value === undefined) {
    return WALK_NEXT_STEP.SKIP
  }
  if (isDCScriptRunnerItem(value)) {
    SCRIPT_DC_FIELDS.forEach(fieldName => {
      if (value.configuration[fieldName]?.script !== undefined) {
        func(value.configuration[fieldName], 'script')
      }
    })
    return WALK_NEXT_STEP.SKIP
  }
  return WALK_NEXT_STEP.RECURSE
}

// This filter is used to add and remove template expressions in scriptRunner scripts
const filter: FilterCreator = ({ config, client }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'scriptRunnerWorkflowScriptReferencesFilter',
    onFetch: async (elements: Element[]) => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      const instances = elements.filter(isInstanceElement)
      const fieldInstances = instances.filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      const fieldInstancesById = new Map(
        fieldInstances.map(instance => [instance.value.id, instance] as [string, InstanceElement])
      )

      instances
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(instance => {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
            value: instance.value.transitions,
            func: client.isDataCenter
              ? walkOnDcScripts(addTemplateReferences(fieldInstancesById))
              : walkOnCloudScripts(addTemplateReferences(fieldInstancesById)) })
        })
    },
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(instance => {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
            value: instance.value.transitions,
            func: client.isDataCenter
              ? walkOnDcScripts(removeTemplateReferences(deployTemplateMapping))
              : walkOnCloudScripts(removeTemplateReferences(deployTemplateMapping)) })
        })
    },
    onDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(instance => {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
            value: instance.value.transitions,
            func: client.isDataCenter
              ? walkOnDcScripts(restoreTemplateReferences(deployTemplateMapping))
              : walkOnCloudScripts(restoreTemplateReferences(deployTemplateMapping)) })
        })
    },
  }
}
export default filter
