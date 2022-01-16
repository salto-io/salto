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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, Field, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData, resolveValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { getLookUpName } from '../reference_mapping'
import { findObject } from '../utils'
import { FilterCreator } from '../filter'
import { JIRA } from '../constants'
import { defaultDeployChange, deployChanges } from '../deployment'

const { awu } = collections.asynciterable

const WORKFLOW_SCHEME_TYPE = 'WorkflowScheme'
const WORKFLOW_SCHEME_ITEM_TYPE = 'WorkflowSchemeItem'

const log = logger(module)

const filter: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    const workflowSchemeType = findObject(elements, WORKFLOW_SCHEME_TYPE)
    if (workflowSchemeType === undefined) {
      log.warn(`${WORKFLOW_SCHEME_TYPE} type not found`)
    } else {
      const workflowSchemeItemType = new ObjectType({
        elemID: new ElemID(JIRA, WORKFLOW_SCHEME_ITEM_TYPE),
        fields: {
          issueType: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [CORE_ANNOTATIONS.CREATABLE]: true,
              [CORE_ANNOTATIONS.UPDATABLE]: true,
            },
          },
          workflow: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [CORE_ANNOTATIONS.CREATABLE]: true,
              [CORE_ANNOTATIONS.UPDATABLE]: true,
            },
          },
        },
        path: [JIRA, elementUtils.TYPES_PATH, WORKFLOW_SCHEME_ITEM_TYPE],
      })

      workflowSchemeType.fields.items = new Field(
        workflowSchemeType,
        'items',
        new ListType(workflowSchemeItemType),
        {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        }
      )

      if (workflowSchemeType.fields.issueTypeMappings !== undefined) {
        delete workflowSchemeType.fields.issueTypeMappings
      }

      elements.push(workflowSchemeItemType)
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_SCHEME_TYPE)
      .filter(instance => instance.value.issueTypeMappings !== undefined)
      .forEach(instance => {
        instance.value.items = Object.entries(instance.value.issueTypeMappings
          .additionalProperties ?? {}).map(([issueType, workflow]) => ({ workflow, issueType }))
        delete instance.value.issueTypeMappings
      })
  },

  preDeploy: async changes => (
    awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE)
      .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        async instance => {
          if (instance.value.items !== undefined) {
            const resolvedInstance = await resolveValues(instance, getLookUpName)
            instance.value.issueTypeMappings = _(resolvedInstance.value.items)
              .keyBy(mapping => mapping.issueType)
              .mapValues(mapping => mapping.workflow)
              .value()
          }
          return instance
        }
      ))
  ),

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE
    )


    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange),
      async change => defaultDeployChange({
        change,
        client,
        apiDefinitions: config.apiDefinitions,
        fieldsToIgnore: ['items'],
      })
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },

  onDeploy: async changes => (
    awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE)
      .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        async instance => {
          delete instance.value.issueTypeMappings
          return instance
        }
      ))
  ),
})

export default filter
