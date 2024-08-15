/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  ElemID,
  ElemIdGetter,
  InstanceElement,
  isInstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { config as configUtils, elements as adapterElements } from '@salto-io/adapter-components'
import { getParent, invertNaclCase, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { FilterCreator } from '../../filter'
import { findObject, setTypeDeploymentAnnotationsRecursively } from '../../utils'
import {
  FIELD_CONTEXT_OPTIONS_FILE_NAME,
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_OPTIONS_ORDER_FILE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  ORDER_INSTANCE_SUFFIX,
  OPTIONS_ORDER_TYPE_NAME,
  PARENT_NAME_FIELD,
} from './constants'
import { convertOptionsToList } from './context_options'

const log = logger(module)

const { getTransformationConfigByType } = configUtils
const { toBasicInstance } = adapterElements

const getOptionsInstances = async ({
  context,
  parent,
  optionList,
  optionType,
  getElemIdFunc,
}: {
  context: InstanceElement
  parent: InstanceElement
  optionList: Values[]
  optionType: ObjectType
  getElemIdFunc: ElemIdGetter | undefined
}): Promise<InstanceElement[]> =>
  (
    await Promise.all(
      optionList.map(async (optionValue: Values) => {
        optionValue[PARENT_NAME_FIELD] = invertNaclCase(parent.elemID.name)
        const optionInstance = await toBasicInstance({
          entry: optionValue,
          type: optionType,
          transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
          transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
          defaultName: `${invertNaclCase(parent.elemID.name)}_${optionValue.value}`,
          getElemIdFunc,
          parent,
        })
        delete optionInstance.value[PARENT_NAME_FIELD] // It was added to create the name properly
        optionInstance.path = context.path && [
          ...context.path,
          pathNaclCase(naclCase(`${invertNaclCase(context.elemID.name)}_${FIELD_CONTEXT_OPTIONS_FILE_NAME}`)),
        ]
        return optionInstance
      }),
    )
  ).filter(values.isDefined)

const getOrderInstance = async ({
  context,
  options,
  orderType,
  parent,
  getElemIdFunc,
}: {
  context: InstanceElement
  options: InstanceElement[]
  orderType: ObjectType
  parent: InstanceElement
  getElemIdFunc: ElemIdGetter | undefined
}): Promise<InstanceElement> => {
  const instance = await toBasicInstance({
    entry: {
      options: options.map(option => new ReferenceExpression(option.elemID, option)),
    },
    type: orderType,
    transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
    transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
    defaultName: `${invertNaclCase(parent.elemID.name)}_${ORDER_INSTANCE_SUFFIX}`,
    getElemIdFunc,
    parent,
  })
  instance.path = context.path && [
    ...context.path,
    pathNaclCase(naclCase(`${invertNaclCase(context.elemID.name)}_${FIELD_CONTEXT_OPTIONS_ORDER_FILE_NAME}`)),
  ]
  return instance
}

const editDefaultValue = (context: InstanceElement, idToOptionRecord: Record<string, InstanceElement>): void => {
  if (context.value.defaultValue === undefined) {
    return
  }
  const { optionIds, optionId, cascadingOptionId } = context.value.defaultValue
  if (_.isString(optionId) && Object.prototype.hasOwnProperty.call(idToOptionRecord, optionId)) {
    const optionInstance = idToOptionRecord[optionId]
    context.value.defaultValue.optionId = new ReferenceExpression(optionInstance.elemID, optionInstance)
  }
  if (Array.isArray(optionIds)) {
    context.value.defaultValue.optionIds = optionIds
      .filter(_.isString)
      .filter(id => Object.prototype.hasOwnProperty.call(idToOptionRecord, id))
      .map((id: string) => {
        const optionInstance = idToOptionRecord[id]
        return new ReferenceExpression(optionInstance.elemID, optionInstance)
      })
  }
  if (_.isString(cascadingOptionId) && Object.prototype.hasOwnProperty.call(idToOptionRecord, cascadingOptionId)) {
    const optionInstance = idToOptionRecord[cascadingOptionId]
    context.value.defaultValue.cascadingOptionId = new ReferenceExpression(optionInstance.elemID, optionInstance)
  }
}

const filter: FilterCreator = ({ config, getElemIdFunc }) => ({
  name: 'fieldContextOptionsSplitFilter',
  onFetch: async elements => {
    if (!config.fetch.splitFieldContextOptions) {
      return
    }

    const fieldContextOptionType = findObject(elements, FIELD_CONTEXT_OPTION_TYPE_NAME)

    if (fieldContextOptionType === undefined) {
      log.error('Field context option type not found')
      return
    }

    await setTypeDeploymentAnnotationsRecursively(fieldContextOptionType)

    const fieldContextOrderObjectType = new ObjectType({
      elemID: new ElemID('jira', OPTIONS_ORDER_TYPE_NAME),
      fields: {
        options: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })
    await setTypeDeploymentAnnotationsRecursively(fieldContextOrderObjectType)
    elements.push(fieldContextOrderObjectType)

    const contexts = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)

    const options = (
      await Promise.all(
        contexts
          .filter(context => context.value.options !== undefined)
          .flatMap(async context => {
            const orderedOptions = await getOptionsInstances({
              context,
              parent: context,
              optionList: convertOptionsToList(context.value.options ?? {}),
              optionType: fieldContextOptionType,
              getElemIdFunc,
            })
            const orderInstance = await getOrderInstance({
              context,
              options: orderedOptions,
              orderType: fieldContextOrderObjectType,
              parent: context,
              getElemIdFunc,
            })
            delete context.value.options
            elements.push(orderInstance)
            return orderedOptions
          }),
      )
    ).flat()

    const cascadingOptions = (
      await Promise.all(
        options
          .filter(option => option.value.cascadingOptions !== undefined)
          .flatMap(async option => {
            const context = getParent(option)
            const orderedOptions = await getOptionsInstances({
              context,
              parent: option,
              optionList: convertOptionsToList(option.value.cascadingOptions ?? {}),
              optionType: fieldContextOptionType,
              getElemIdFunc,
            })
            const orderInstance = await getOrderInstance({
              context,
              options: orderedOptions,
              orderType: fieldContextOrderObjectType,
              parent: option,
              getElemIdFunc,
            })
            delete option.value.cascadingOptions
            elements.push(orderInstance)
            return orderedOptions
          }),
      )
    ).flat()

    const idToOptionRecord: Record<string, InstanceElement> = Object.fromEntries(
      options
        .concat(cascadingOptions)
        .filter(option => _.isString(option.value.id))
        .map(option => [option.value.id, option]),
    )
    contexts.forEach(context => editDefaultValue(context, idToOptionRecord))
    contexts.forEach(context => {
      context.path = context.path && [...context.path, context.path[context.path.length - 1]]
    })
    options.forEach(option => elements.push(option))
    cascadingOptions.forEach(cascadingOption => elements.push(cascadingOption))
  },
})

export default filter
