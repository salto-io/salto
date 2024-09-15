/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  StaticFile
} from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import {
  apiNameSync,
  ensureSafeFilterFetch,
  isInstanceOfTypeChangeSync,
  isInstanceOfTypeSync,
  metadataTypeSync
} from './utils'
import { RECORDS_PATH, SALESFORCE } from '../constants'

const WAVE_TYPES_WITH_STATIC_FILES = ['WaveLens', 'WaveDataflow', 'WaveRecipe', 'WaveDashboard']

const convertContentToStaticFile = (instance: InstanceElement): void => {
  const typeName = metadataTypeSync(instance)
  const instanceFullName = apiNameSync(instance)
  const content = _.get(instance.value, 'content')
  if (!_.isString(content) || !_.isString(instanceFullName)) {
    return
  }
  instance.value.content = new StaticFile({
    filepath: `${SALESFORCE}/${RECORDS_PATH}/${typeName}/${instanceFullName}`,
    content: Buffer.from(content, 'base64'),
  })
}

const convertStaticFileContentToString = (instance: InstanceElement): void => {
  const content = _.get(instance.value, 'content')
  if (_.isBuffer(content)) {
    instance.value.content = content.toString('base64')
  }
}

const filter: LocalFilterCreator = ({ config }) => ({
  name: 'waveStaticFiles',
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error occurred while attempting to convert Wave Metadata content to static files',
    config,
    filterName: 'waveMetadataSupport',
    fetchFilterFunc: async elements => {
      elements
        .filter(isInstanceOfTypeSync(...WAVE_TYPES_WITH_STATIC_FILES))
        .forEach(convertContentToStaticFile)
    },
  }),
  preDeploy: async changes => {
    changes
      .filter(isInstanceOfTypeChangeSync(...WAVE_TYPES_WITH_STATIC_FILES))
      .filter(isAdditionOrModificationChange)
      .forEach(change => {
        convertStaticFileContentToString(getChangeData(change))
      })
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceOfTypeChangeSync(...WAVE_TYPES_WITH_STATIC_FILES))
      .filter(isAdditionOrModificationChange)
      .forEach(change => {
        convertContentToStaticFile(getChangeData(change))
      })
  },
})

export default filter
