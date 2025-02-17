/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { BOT_BUILDER_ANSWER, CONVERSATION_BOT, BOT_BUILDER_NODE, ZENDESK } from '../constants'
import { FilterCreator } from '../filter'

const { RECORDS_PATH } = elementsUtils
const log = logger(module)

const UNSORTED = 'unsorted'
const BOT_BUILDER_PATH = [ZENDESK, RECORDS_PATH, CONVERSATION_BOT]

const BOT_BUILDER_ELEMENT_DIRECTORY: Record<string, string> = {
  [CONVERSATION_BOT]: 'bots',
  [BOT_BUILDER_ANSWER]: 'answers',
  [BOT_BUILDER_NODE]: 'nodes',
}

const NO_VALUE_DEFAULT = 'unknown'

const ELEMENT_NAME: Record<string, (instance?: InstanceElement) => string> = {
  [CONVERSATION_BOT]: (instance?: InstanceElement) => instance?.value.name ?? NO_VALUE_DEFAULT,
  [BOT_BUILDER_ANSWER]: (instance?: InstanceElement) => instance?.value.name ?? NO_VALUE_DEFAULT,
  [BOT_BUILDER_NODE]: (instance?: InstanceElement) => instance?.value.id ?? NO_VALUE_DEFAULT,
}

const getName = (instance: InstanceElement): string =>
  ELEMENT_NAME[instance.elemID.typeName] === undefined
    ? pathNaclCase(naclCase(instance.elemID.name))
    : pathNaclCase(naclCase(ELEMENT_NAME[instance.elemID.typeName](instance)))

/**
 * calculates a path which is related to a specific brand and does not have a parent
 */
const pathForFlowElements = (instance: InstanceElement, brandName: string | undefined): readonly string[] => {
  if (brandName === undefined) {
    log.error('brandName was not found for instance %s.', instance.elemID.getFullName())
    return [
      ...BOT_BUILDER_PATH,
      UNSORTED,
      BOT_BUILDER_ELEMENT_DIRECTORY[instance.elemID.typeName],
      pathNaclCase(naclCase(instance.elemID.name)),
    ]
  }
  const name = getName(instance)
  return [...BOT_BUILDER_PATH, 'brands', brandName, BOT_BUILDER_ELEMENT_DIRECTORY[instance.elemID.typeName], name, name]
}

/**
 * calculates a path which is related to a specific brand and has a parent.
 */
const pathFromParent = ({
  instance,
  needTypeDirectory,
  needOwnFolder,
  parentPath,
}: {
  instance: InstanceElement
  needTypeDirectory: boolean
  needOwnFolder: boolean
  parentPath: readonly string[]
}): readonly string[] => {
  const name = getName(instance)
  const newPath = parentPath.slice(0, parentPath.length - 1)
  if (needTypeDirectory) {
    newPath.push(BOT_BUILDER_ELEMENT_DIRECTORY[instance.elemID.typeName])
  }
  if (needOwnFolder) {
    newPath.push(name)
  }
  newPath.push(name)
  return newPath
}

/**
 * This filter arranges the paths for bot builder elements.
 */
const filterCreator: FilterCreator = () => ({
  name: 'botBuilderArrangePaths',
  onFetch: async (elements: Element[]): Promise<void> => {
    const botBuilderFlowInstances = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === CONVERSATION_BOT)

    botBuilderFlowInstances.forEach(flowInstance => {
      const brandName = flowInstance.value.brandId?.value?.value?.name
      const flowPath = pathForFlowElements(flowInstance, brandName)
      flowInstance.path = flowPath
      flowInstance.value.subflows?.filter(isReferenceExpression).forEach((botBuilderAnswerRef: ReferenceExpression) => {
        const botBuilderAnswerInstance = botBuilderAnswerRef.value
        const answerPath = pathFromParent({
          instance: botBuilderAnswerInstance,
          needTypeDirectory: true,
          needOwnFolder: true,
          parentPath: flowPath,
        })
        botBuilderAnswerInstance.path = answerPath
        botBuilderAnswerInstance.value.nodes
          ?.filter(isReferenceExpression)
          .forEach((botBuilderNodeRef: ReferenceExpression) => {
            botBuilderNodeRef.value.path = pathFromParent({
              instance: botBuilderNodeRef.value,
              needTypeDirectory: true,
              needOwnFolder: false,
              parentPath: answerPath,
            })
          })
      })
    })
  },
})

export default filterCreator
