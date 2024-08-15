/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { CUSTOM_OBJECT_TYPE_NAME } from '../../constants'

const getCustomObjectInstances = (changes: Change[]): InstanceElement[] =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === CUSTOM_OBJECT_TYPE_NAME)

const customObjectFilter: FilterCreator = () => ({
  name: 'addFieldOptionsFilter',
  preDeploy: async changes =>
    getCustomObjectInstances(changes).forEach(instance => {
      instance.value.title = instance.value.raw_title
      instance.value.title_pluralized = instance.value.raw_title_pluralized
      instance.value.description = instance.value.raw_description
    }),
  onDeploy: async changes =>
    getCustomObjectInstances(changes).forEach(instance => {
      delete instance.value.title
      delete instance.value.title_pluralized
      delete instance.value.description
    }),
})

export default customObjectFilter
