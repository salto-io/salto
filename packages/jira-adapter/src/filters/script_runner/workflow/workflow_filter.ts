/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { walkOnValue } from '@salto-io/adapter-utils'
import {
  isInstanceElement,
  Element,
  isInstanceChange,
  isAdditionOrModificationChange,
  getChangeData,
  isObjectType,
  ObjectType,
  ElemID,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ListType,
  Field,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { elements as componentElements } from '@salto-io/adapter-components'
import { FilterCreator } from '../../../filter'
import {
  CONDITION_CONFIGURATION,
  DIRECTED_LINK_TYPE,
  JIRA,
  WORKFLOW_CONFIGURATION_TYPE,
  MAIL_LIST_TYPE_NAME,
  POST_FUNCTION_CONFIGURATION,
  WORKFLOW_TYPE_NAME,
} from '../../../constants'
import { decodeDcFields, encodeDcFields } from './workflow_dc'
import { decodeCloudFields, encodeCloudFields } from './workflow_cloud'

const { awu } = collections.asynciterable

const fullDeploymentAnnotation = {
  [CORE_ANNOTATIONS.CREATABLE]: true,
  [CORE_ANNOTATIONS.UPDATABLE]: true,
  [CORE_ANNOTATIONS.DELETABLE]: true,
}

const addObjectTypes = (elements: Element[]): void => {
  const mailListType = new ObjectType({
    elemID: new ElemID(JIRA, MAIL_LIST_TYPE_NAME),
    fields: {
      field: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: fullDeploymentAnnotation,
      },
      group: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: fullDeploymentAnnotation,
      },
      role: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: fullDeploymentAnnotation,
      },
    },
    path: [JIRA, componentElements.TYPES_PATH, componentElements.SUBTYPES_PATH, MAIL_LIST_TYPE_NAME],
  })

  const linkDirectionType = new ObjectType({
    elemID: new ElemID(JIRA, DIRECTED_LINK_TYPE),
    fields: {
      linkType: {
        refType: BuiltinTypes.STRING,
        annotations: fullDeploymentAnnotation,
      },
      direction: {
        refType: BuiltinTypes.STRING,
        annotations: fullDeploymentAnnotation,
      },
    },
    path: [JIRA, componentElements.TYPES_PATH, componentElements.SUBTYPES_PATH, DIRECTED_LINK_TYPE],
  })

  const postFunctionsType = elements
    .filter(isObjectType)
    .find(instance => instance.elemID.getFullName() === `${JIRA}.${POST_FUNCTION_CONFIGURATION}`)

  if (postFunctionsType?.fields !== undefined) {
    postFunctionsType.fields.FIELD_LINK_DIRECTION = new Field(
      postFunctionsType,
      'FIELD_LINK_DIRECTION',
      new ListType(linkDirectionType),
      fullDeploymentAnnotation,
    )
    postFunctionsType.fields.FIELD_LINK_TYPE = new Field(
      postFunctionsType,
      'FIELD_LINK_TYPE',
      new ListType(linkDirectionType),
      fullDeploymentAnnotation,
    )
    postFunctionsType.fields.FIELD_TO_USER_FIELDS = new Field(
      postFunctionsType,
      'FIELD_TO_USER_FIELDS',
      new ListType(mailListType),
      fullDeploymentAnnotation,
    )
    postFunctionsType.fields.FIELD_CC_USER_FIELDS = new Field(
      postFunctionsType,
      'FIELD_CC_USER_FIELDS',
      new ListType(mailListType),
      fullDeploymentAnnotation,
    )
  }

  const conditionFunctionsType = elements
    .filter(isObjectType)
    .find(instance => instance.elemID.getFullName() === `${JIRA}.${CONDITION_CONFIGURATION}`)

  if (conditionFunctionsType?.fields !== undefined) {
    conditionFunctionsType.fields.FIELD_LINK_DIRECTION = new Field(
      conditionFunctionsType,
      'FIELD_LINK_DIRECTION',
      new ListType(linkDirectionType),
      fullDeploymentAnnotation,
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
      .filter(
        instance =>
          instance.elemID.typeName === WORKFLOW_TYPE_NAME || instance.elemID.typeName === WORKFLOW_CONFIGURATION_TYPE,
      )
      .forEach(instance => {
        walkOnValue({
          elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: client.isDataCenter ? decodeDcFields : decodeCloudFields(config.fetch.enableNewWorkflowAPI ?? false),
        })
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
      .filter(
        instance =>
          instance.elemID.typeName === WORKFLOW_TYPE_NAME || instance.elemID.typeName === WORKFLOW_CONFIGURATION_TYPE,
      )
      .forEach(instance => {
        walkOnValue({
          elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: client.isDataCenter ? encodeDcFields : encodeCloudFields(config.fetch.enableNewWorkflowAPI ?? false),
        })
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
      .filter(
        instance =>
          instance.elemID.typeName === WORKFLOW_TYPE_NAME || instance.elemID.typeName === WORKFLOW_CONFIGURATION_TYPE,
      )
      .forEach(instance => {
        walkOnValue({
          elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: client.isDataCenter ? decodeDcFields : decodeCloudFields(config.fetch.enableNewWorkflowAPI ?? false),
        })
      })
  },
})

export default filter
