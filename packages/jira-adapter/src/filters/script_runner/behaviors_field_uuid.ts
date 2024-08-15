/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { v4 as uuidv4 } from 'uuid'
import { getChangeData, isInstanceChange, Value, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { BEHAVIOR_TYPE } from '../../constants'

// This filter handles the field uuids in the behaviors
const filter: FilterCreator = ({ config }) => ({
  name: 'behaviorsFieldUuidFilter',
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
      .forEach(instance => {
        instance.value.config?.forEach((configField: Value) => {
          configField.fieldUuid = uuidv4()
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
      .filter(instance => instance.elemID.typeName === BEHAVIOR_TYPE)
      .forEach(instance => {
        instance.value.config?.forEach((configField: Value) => {
          delete configField.fieldUuid
        })
      })
  },
})
export default filter
