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
import { invertNaclCase } from '@salto-io/adapter-utils'
import { createReference } from '../utils'
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'
import { ORDER_INSTANCE_SUFFIX } from '../../src/filters/fields/constants'

const createOptionName = (parentName: string, optionValue: string): string =>
  `${invertNaclCase(parentName)}_${optionValue}`

const createOrderName = (parent: InstanceElement): string =>
  `${invertNaclCase(parent.elemID.name)}_${ORDER_INSTANCE_SUFFIX}`

export const createOptionsAndOrders = ({
  optionsType,
  orderType,
  contextInstance,
}: {
  optionsType: ObjectType
  orderType: ObjectType
  contextInstance: InstanceElement
}): { contextOptions: InstanceElement[]; contextOrders: InstanceElement[] } => {
  const createOptionInstance = (value: string, parent: InstanceElement, disabled = false): InstanceElement =>
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

  const createOrderInstance = (parent: InstanceElement, options: InstanceElement[]): InstanceElement =>
    new InstanceElement(
      createOrderName(parent),
      orderType,
      {
        options: options.map(option => new ReferenceExpression(option.elemID, option)),
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
    )

  const cascadingOptionP1 = createOptionInstance('p1', contextInstance)
  const cascadingOptionP2 = createOptionInstance('p2', contextInstance)
  const cascadingOptionP1C11 = createOptionInstance('c11', cascadingOptionP1)
  const cascadingOptionP1C12 = createOptionInstance('c12', cascadingOptionP1)
  const cascadingOptionP2C22 = createOptionInstance('c22', cascadingOptionP2)
  const optionP3 = createOptionInstance('p3', contextInstance, true)
  const optionP4 = createOptionInstance('p4', contextInstance)

  return {
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
      createOrderInstance(contextInstance, [cascadingOptionP1, cascadingOptionP2, optionP3, optionP4]),
      createOrderInstance(cascadingOptionP1, [cascadingOptionP1C11, cascadingOptionP1C12]),
      createOrderInstance(cascadingOptionP2, [cascadingOptionP2C22]),
    ],
  }
}

export const createFieldValues = (name: string): Values => ({
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
