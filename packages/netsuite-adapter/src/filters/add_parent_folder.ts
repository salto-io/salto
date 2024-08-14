/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, getChangeData } from '@salto-io/adapter-api'
import path from 'path'
import { isFileCabinetInstance } from '../types'
import { LocalFilterCreator } from '../filter'
import { SUITEAPP_CREATING_FILES_GROUP_ID } from '../group_changes'
import { FILE_CABINET_PATH_SEPARATOR, PARENT } from '../constants'
import { getParentInternalId } from '../change_validators/file_cabinet_internal_ids'

const filterCreator: LocalFilterCreator = ({ changesGroupId }) => ({
  name: 'addParentFolder',
  onFetch: async elements => {
    elements
      .filter(isFileCabinetInstance)
      .filter(instance => path.dirname(instance.value.path) !== FILE_CABINET_PATH_SEPARATOR)
      .forEach(instance => {
        instance.annotations[CORE_ANNOTATIONS.PARENT] = [`[${path.dirname(instance.value.path)}]`]
      })
  },
  preDeploy: async changes => {
    if (changesGroupId !== SUITEAPP_CREATING_FILES_GROUP_ID) {
      return
    }
    changes
      .map(getChangeData)
      .filter(isFileCabinetInstance)
      .forEach(instance => {
        instance.value[PARENT] = getParentInternalId(instance).id
      })
  },
})

export default filterCreator
