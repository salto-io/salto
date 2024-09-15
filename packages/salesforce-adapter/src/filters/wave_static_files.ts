/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement, StaticFile } from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { apiNameSync, ensureSafeFilterFetch, isInstanceOfTypeSync, metadataTypeSync } from './utils'
import {
  RECORDS_PATH,
  SALESFORCE,
  WAVE_DASHBOARD_METADATA_TYPE,
  WAVE_DATAFLOW_METADATA_TYPE,
  WAVE_LENS_METADATA_TYPE,
  WAVE_RECIPE_METADATA_TYPE,
} from '../constants'

export const WAVE_TYPES_WITH_STATIC_FILES = [
  WAVE_RECIPE_METADATA_TYPE,
  WAVE_DATAFLOW_METADATA_TYPE,
  WAVE_DASHBOARD_METADATA_TYPE,
  WAVE_LENS_METADATA_TYPE,
]

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

// This filter converts the content of Wave Metadata instances to static files.
// Oddly enough, the API expects the decoded Base64 content as input for deploy, so no transformation
// is need before deploying back to the service. The transformation in fetch
// should allow deploying these instances successfully.
const filter: LocalFilterCreator = ({ config }) => ({
  name: 'waveStaticFiles',
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error occurred while attempting to convert Wave Metadata content to static files',
    config,
    filterName: 'waveMetadataSupport',
    fetchFilterFunc: async elements => {
      elements.filter(isInstanceOfTypeSync(...WAVE_TYPES_WITH_STATIC_FILES)).forEach(convertContentToStaticFile)
    },
  }),
})

export default filter
