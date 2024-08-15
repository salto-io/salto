/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  Element,
  ElemIdGetter,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME } from '../constants'
import { JiraConfig } from '../config/config'

const log = logger(module)

const UUID_REGEX = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const GROUP_NAME = 'trusted-users'
const TRUSTED_GROUP_NAME_REGEX = new RegExp(`^${GROUP_NAME}-${UUID_REGEX}$`)

const isGroupElement = (element: Element): boolean => element.elemID.typeName === GROUP_TYPE_NAME

const isTrustedGroupInstance = (instance: InstanceElement): boolean =>
  TRUSTED_GROUP_NAME_REGEX.exec(instance.value.name) !== null

const getGroupName = (instance: InstanceElement): string =>
  isTrustedGroupInstance(instance) ? GROUP_NAME : instance.value.name

const createRenamedTrustedGroupInstance = async (
  instance: InstanceElement,
  config: JiraConfig,
  getElemIdFunc?: ElemIdGetter,
): Promise<InstanceElement> => {
  const newName = getGroupName(instance)
  const originalName = instance.value.name
  const newInstance = await elementUtils.toBasicInstance({
    entry: { ...instance.value, name: newName, originalName },
    type: await instance.getType(),
    transformationConfigByType: configUtils.getTransformationConfigByType(config.apiDefinitions.types),
    transformationDefaultConfig: config.apiDefinitions.typeDefaults.transformation,
    defaultName: newName,
    getElemIdFunc,
  })
  return newInstance
}

/**
 * Remove uuid suffix from the trusted-users group name
 * The filter also update original name field for all instances because references are curretnly based on this field
 */
const filter: FilterCreator = ({ config, getElemIdFunc }) => ({
  name: 'groupNameFilter',
  onFetch: async (elements: Element[]) => {
    const groupInstances = elements.filter(isInstanceElement).filter(isGroupElement)
    // this is needed inorder for groupStrategyByOriginalName serialization strategy will work
    groupInstances.forEach(instance => {
      instance.value.originalName = instance.value.name
    })

    const trustedUsersGroup = groupInstances.filter(isTrustedGroupInstance)
    if (trustedUsersGroup.length > 1) {
      log.error(
        'Found more than one trusted users group instances %s. Skipping renaming groups',
        trustedUsersGroup.map(e => e.elemID.getFullName()).join(', '),
      )
      return
    }
    if (trustedUsersGroup.length === 0) {
      return
    }
    const trustedGroup = trustedUsersGroup[0]
    _.pull(elements, trustedGroup)
    const renamedTrustedGroupInstance = await createRenamedTrustedGroupInstance(trustedGroup, config, getElemIdFunc)
    elements.push(renamedTrustedGroupInstance)
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => isGroupElement(instance))
      .forEach(instance => {
        instance.value.originalName = instance.value.name
        instance.value.name = getGroupName(instance)
      })
  },
})

export default filter
