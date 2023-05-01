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

import { extractTemplate, walkOnValue, WalkOnFunc, WALK_NEXT_STEP, resolveValues } from '@salto-io/adapter-utils'
import { InstanceElement, isInstanceElement, TemplateExpression, ReferenceExpression, ElemID, Element, Value, isAdditionOrModificationChange, getChangeData } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'
import { SCRIPT_RUNNER_DC_TYPES } from './workflow_dc'
import { SCRIPT_RUNNER_CLOUD_TYPES } from './workflow_cloud'
import { getLookUpName } from '../../reference_mapping'

const { awu } = collections.asynciterable

const CUSTOM_FIELD_PATTERN = /(customfield_\d+)/
const SCRIPT_DC_FIELDS = ['FIELD_CONDITION', 'FIELD_ADDITIONAL_SCRIPT', 'FIELD_SCRIPT_FILE_OR_SCRIPT']
const SCRIPT_CLOUD_FIELDS = ['expression', 'additionalCode', 'emailCode']

const referenceCustomFields = (script: string): TemplateExpression | string => extractTemplate(
  script,
  [CUSTOM_FIELD_PATTERN],
  expression => {
    if (!expression.match(CUSTOM_FIELD_PATTERN)) {
      return expression
    }
    return new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'ido_date__datepicker__c@suuuu'))
  }
)


const isCloudScriptRunnerItem = (value: Value): boolean =>
  SCRIPT_RUNNER_CLOUD_TYPES.includes(value.type) && value.configuration.scriptRunner !== undefined


const transformScriptsCloud: WalkOnFunc = ({ value }): WALK_NEXT_STEP => {
  if (value === undefined) {
    return WALK_NEXT_STEP.SKIP
  }
  if (isCloudScriptRunnerItem(value)) {
    SCRIPT_CLOUD_FIELDS.forEach(fieldName => {
      if (value.configuration.scriptRunner[fieldName] !== undefined) {
        value.configuration.scriptRunner[fieldName] = referenceCustomFields(value.configuration.scriptRunner[fieldName])
      }
    })
    return WALK_NEXT_STEP.SKIP
  }
  return WALK_NEXT_STEP.RECURSE
}

const isDCScriptRunnerItem = (value: Value): boolean =>
  SCRIPT_RUNNER_DC_TYPES.includes(value.type) && value.configuration !== undefined

const transformScriptsDC: WalkOnFunc = ({ value }): WALK_NEXT_STEP => {
  if (value === undefined) {
    return WALK_NEXT_STEP.SKIP
  }
  if (isDCScriptRunnerItem(value)) {
    if (value.configuration.FIELD_NOTES === 'Test Empty array') {
      value.configuration.FIELD_NOTES = 'Test Empty array'
    }
    SCRIPT_DC_FIELDS.forEach(fieldName => {
      if (value.configuration[fieldName]?.script !== undefined) {
        value.configuration[fieldName].script = referenceCustomFields(value.configuration[fieldName].script)
      }
    })
    return WALK_NEXT_STEP.SKIP
  }
  return WALK_NEXT_STEP.RECURSE
}

// This filter is used to remove and return references in script runner workflows
// As the references are encoded we cannot wait for the references filter to resolve them
const filter: FilterCreator = ({ config, client }) => {
  const originalInstances: Record<string, InstanceElement> = {}
  return {
    name: 'scriptRunnerWorkflowScriptReferencesFilter',
    onFetch: async (elements: Element[]) => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(instance => {
          walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
            value: instance.value.transitions,
            func: client.isDataCenter
              ? transformScriptsDC
              : transformScriptsCloud })
        })
    },
    preDeploy: async changes => {
      if (!config.fetch.enableScriptRunnerAddon) {
        return
      }
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
        .forEach(async instance => {
          originalInstances[instance.elemID.getFullName()] = instance.clone()
          instance.value.transitions = (
            await resolveValues(instance, getLookUpName)
          ).value.transitions
        })
    },
    // onDeploy: async changes => {
    //   if (!config.fetch.enableScriptRunnerAddon) {
    //     return
    //   }
    //   await awu(changes)
    //     .filter(isAdditionOrModificationChange)
    //     .filter(isInstanceChange)
    //     .map(getChangeData)
    //     .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
    //     .forEach(async instance => {
    //       instance.value.transitions = (await restoreValues(
    //         instance,
    //         originalInstances[instance.elemID.getFullName()],
    //         getLookUpName,
    //       )).value.transitions
    //     })
    // },
  }
}

export default filter
