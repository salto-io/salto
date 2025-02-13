/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  Values,
  Element,
  InstanceElement,
  ObjectType,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { invertNaclCase, naclCase } from '@salto-io/adapter-utils'
import { createReference, findType } from '../utils'
import { ISSUE_TYPE_NAME, JIRA, PROJECT_TYPE } from '../../src/constants'
import {
  CUSTOM_FIELDS_SUFFIX,
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
  ORDER_INSTANCE_SUFFIX,
} from '../../src/filters/fields/constants'

const createOptionName = (parentName: string, optionValue: string): string =>
  `${invertNaclCase(parentName)}_${optionValue}`

const createOrderName = (parent: InstanceElement): string =>
  `${invertNaclCase(parent.elemID.name)}_${ORDER_INSTANCE_SUFFIX}`

const createOptionInstance = ({
  value,
  parent,
  optionsType,
  disabled = false,
}: {
  value: string
  parent: InstanceElement
  optionsType: ObjectType
  disabled?: boolean
}): InstanceElement =>
  new InstanceElement(
    createOptionName(parent.elemID.name, value),
    optionsType,
    {
      value,
      disabled,
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )

const createOrderInstance = ({
  parent,
  options,
  orderType,
}: {
  parent: InstanceElement
  options: InstanceElement[]
  orderType: ObjectType
}): InstanceElement =>
  new InstanceElement(
    createOrderName(parent),
    orderType,
    {
      options: options.map(option => new ReferenceExpression(option.elemID, option)),
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )

export const createCascadeFieldValues = (name: string): Values => ({
  name,
  description: 'desc!',
  searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselectsearcher',
  type: 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect',
})

export const createContextValues = (name: string, allElements: Element[]): Values => ({
  name,
  issueTypeIds: [
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Epic'), allElements),
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Story'), allElements),
  ],
})

export const createProjectScopeContextValues = (name: string, allElements: Element[]): Values => ({
  name,
  projectIds: [createReference(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'Test_Project@s'), allElements)],
})

const createContextName = (randomString: string, type: string): string =>
  naclCase(`${randomString}__${type}__${CUSTOM_FIELDS_SUFFIX}_${randomString}`)

export const createCascadeContextAndRelatedInstances = ({
  allElements,
  randomString,
  fieldInstance,
}: {
  allElements: Element[]
  randomString: string
  fieldInstance: InstanceElement
}): {
  contextInstance: InstanceElement
  contextOptions: InstanceElement[]
  contextOrders: InstanceElement[]
} => {
  const contextInstance = new InstanceElement(
    createContextName(randomString, 'cascadingselect'),
    findType(FIELD_CONTEXT_TYPE_NAME, allElements),
    createContextValues(randomString, allElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)] },
  )
  const optionsType = findType(FIELD_CONTEXT_OPTION_TYPE_NAME, allElements)
  const orderType = findType(OPTIONS_ORDER_TYPE_NAME, allElements)
  const cascadingOptionP1 = createOptionInstance({ value: 'p1', parent: contextInstance, optionsType })
  const cascadingOptionP2 = createOptionInstance({ value: 'p2', parent: contextInstance, optionsType })
  const cascadingOptionP1C11 = createOptionInstance({ value: 'c11', parent: cascadingOptionP1, optionsType })
  const cascadingOptionP1C12 = createOptionInstance({ value: 'c12', parent: cascadingOptionP1, optionsType })
  const cascadingOptionP2C22 = createOptionInstance({ value: 'c22', parent: cascadingOptionP2, optionsType })
  const optionP3 = createOptionInstance({ value: 'p3', parent: contextInstance, optionsType, disabled: true })
  const optionP4 = createOptionInstance({ value: 'p4', parent: contextInstance, optionsType })

  contextInstance.value.defaultValue = {
    type: 'option.cascading',
    cascadingOptionId: new ReferenceExpression(cascadingOptionP1C11.elemID, cascadingOptionP1C11),
    optionId: new ReferenceExpression(cascadingOptionP1.elemID, cascadingOptionP1),
  }

  return {
    contextInstance,
    contextOptions: [
      cascadingOptionP1,
      cascadingOptionP1C11,
      cascadingOptionP1C12,
      cascadingOptionP2,
      cascadingOptionP2C22,
      optionP3,
      optionP4,
    ],
    contextOrders: [
      createOrderInstance({
        parent: contextInstance,
        options: [cascadingOptionP1, cascadingOptionP2, optionP3, optionP4],
        orderType,
      }),
      createOrderInstance({
        parent: cascadingOptionP1,
        options: [cascadingOptionP1C11, cascadingOptionP1C12],
        orderType,
      }),
      createOrderInstance({ parent: cascadingOptionP2, options: [cascadingOptionP2C22], orderType }),
    ],
  }
}

export const createMultiSelectFieldValues = (name: string): Values => ({
  name,
  description: 'desc!',
  searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:multiselectsearcher',
  type: 'com.atlassian.jira.plugin.system.customfieldtypes:multiselect',
})

export const createMultiSelectContextAndRelatedInstances = ({
  allElements,
  randomString,
  fieldInstance,
}: {
  allElements: Element[]
  randomString: string
  fieldInstance: InstanceElement
}): {
  contextInstance: InstanceElement
  contextOptions: InstanceElement[]
  contextOrders: InstanceElement[]
} => {
  const contextInstance = new InstanceElement(
    createContextName(randomString, 'multiselect'),
    findType(FIELD_CONTEXT_TYPE_NAME, allElements),
    createProjectScopeContextValues(randomString, allElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)] },
  )
  const optionsType = findType(FIELD_CONTEXT_OPTION_TYPE_NAME, allElements)
  const orderType = findType(OPTIONS_ORDER_TYPE_NAME, allElements)
  const optionMP1 = createOptionInstance({ value: 'mp1', parent: contextInstance, optionsType })
  const optionMP2 = createOptionInstance({ value: 'mp2', parent: contextInstance, optionsType })
  const optionMP3 = createOptionInstance({ value: 'mp3', parent: contextInstance, optionsType })
  contextInstance.value.defaultValue = {
    type: 'option.multiple',
    optionIds: [
      new ReferenceExpression(optionMP2.elemID, optionMP2),
      new ReferenceExpression(optionMP1.elemID, optionMP1),
    ],
  }
  return {
    contextInstance,
    contextOptions: [optionMP1, optionMP2, optionMP3],
    contextOrders: [
      createOrderInstance({ parent: contextInstance, options: [optionMP1, optionMP2, optionMP3], orderType }),
    ],
  }
}
