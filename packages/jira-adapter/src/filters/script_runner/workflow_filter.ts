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

import { walkOnValue } from '@salto-io/adapter-utils'
import { isInstanceElement, Element, isInstanceChange, isAdditionOrModificationChange, getChangeData, isObjectType, ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, ListType, Field } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { elements as componentElements } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { CONDITION_CONFIGURATION, DIRECTED_LINK_TYPE, JIRA, MAIL_LIST_TYPE_NAME, POST_FUNCTION_CONFIGURATION, WORKFLOW_TYPE_NAME } from '../../constants'
import { decodeDcFields, encodeDcFields } from './workflow_dc'
import { decodeCloudFields, encodeCloudFields } from './workflow_cloud'

const { awu } = collections.asynciterable

const addObjectTypes = (elements: Element[]): void => {
  const mailListType = new ObjectType({
    elemID: new ElemID(JIRA, MAIL_LIST_TYPE_NAME),
    fields: {
      field: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      group: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
      role: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
    },
    path: [JIRA, componentElements.SUBTYPES_PATH, componentElements.TYPES_PATH, MAIL_LIST_TYPE_NAME],
  })

  const linkDirectionType = new ObjectType({
    elemID: new ElemID(JIRA, DIRECTED_LINK_TYPE),
    fields: {
      linkType: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
      direction: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    },
    path: [JIRA, componentElements.TYPES_PATH, componentElements.SUBTYPES_PATH, DIRECTED_LINK_TYPE],
  })

  const postFunctionsType = elements
    .filter(isObjectType)
    .find(instance => instance.elemID.getFullName() === `${JIRA}.${POST_FUNCTION_CONFIGURATION}`)

  if (postFunctionsType?.fields !== undefined) {
    postFunctionsType.fields.FIELD_LINK_DIRECTION = new Field(
      postFunctionsType, 'FIELD_LINK_DIRECTION', new ListType(linkDirectionType), { [CORE_ANNOTATIONS.CREATABLE]: true }
    )
    postFunctionsType.fields.FIELD_LINK_TYPE = new Field(
      postFunctionsType, 'FIELD_LINK_TYPE', new ListType(linkDirectionType), { [CORE_ANNOTATIONS.CREATABLE]: true }
    )
    postFunctionsType.fields.FIELD_TO_USER_FIELDS = new Field(
      postFunctionsType, 'FIELD_TO_USER_FIELDS', new ListType(mailListType), { [CORE_ANNOTATIONS.CREATABLE]: true }
    )
    postFunctionsType.fields.FIELD_CC_USER_FIELDS = new Field(
      postFunctionsType, 'FIELD_CC_USER_FIELDS', new ListType(mailListType), { [CORE_ANNOTATIONS.CREATABLE]: true }
    )
  }

  const conditionFunctionsType = elements
    .filter(isObjectType)
    .find(instance => instance.elemID.getFullName() === `${JIRA}.${CONDITION_CONFIGURATION}`)

  if (conditionFunctionsType?.fields !== undefined) {
    conditionFunctionsType.fields.FIELD_LINK_DIRECTION = new Field(
      conditionFunctionsType, 'FIELD_LINK_DIRECTION', new ListType(linkDirectionType), { [CORE_ANNOTATIONS.CREATABLE]: true }
    )
  }

  elements.push(linkDirectionType, mailListType)
}

// This filter is used to encode/decode the fields of the workflow transitions for scriptRunner
// There are different decodings for cloud and dc, and the filter encodes back before deploy
const filter: FilterCreator = ({ client, config }) => ({
  name: 'scriptRunnerWorkflowFilter',
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
            ? decodeDcFields
            : decodeCloudFields })
      })

    addObjectTypes(elements)
  },
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: client.isDataCenter
            ? encodeDcFields
            : encodeCloudFields })
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
            ? decodeDcFields
            : decodeCloudFields })
      })
  },
})

export default filter
