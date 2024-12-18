/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import JSZip from 'jszip'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { Element, InstanceElement, isStaticFile, StaticFile } from '@salto-io/adapter-api'
import { METADATA_CONTENT_FIELD, STATIC_RESOURCE_METADATA_TYPE, UNIX_TIME_ZERO_STRING } from '../constants'
import { FilterCreator } from '../filter'
import { isInstanceOfTypeSync } from './utils'

const { awu } = collections.asynciterable

const log = logger(module)

const DATE = new Date(UNIX_TIME_ZERO_STRING)
const ZIP_CONTENT_TYPE = 'application/zip'

export type StaticResourceInstance = InstanceElement & {
  value: {
    contentType: string
    [METADATA_CONTENT_FIELD]: StaticFile
  }
}

const replaceZipTimestamp = async (data: Buffer): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(data)
  zip.forEach((_relativePath, file) => {
    file.date = DATE
  })
  return zip.generateAsync({ type: 'nodebuffer' })
}

const isStaticResourceInstance = (elem: Element): elem is StaticResourceInstance =>
  isInstanceOfTypeSync(STATIC_RESOURCE_METADATA_TYPE)(elem) &&
  _.isString(elem.value.contentType) &&
  isStaticFile(elem.value[METADATA_CONTENT_FIELD])

const filterCreator: FilterCreator = ({ client }) => ({
  name: 'staticResourceZipTimestampFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    // Run only in the SFDX flow.
    if (client !== undefined) {
      return
    }

    const zipStaticResources = elements
      .filter(isStaticResourceInstance)
      .filter(inst => inst.value.contentType === ZIP_CONTENT_TYPE)
    await awu(zipStaticResources).forEach(async inst => {
      const staticFile = inst.value[METADATA_CONTENT_FIELD]
      const content = await staticFile.getContent()
      if (content === undefined) {
        log.warn('StaticResource %s has no content', inst.elemID.getFullName())
        return
      }

      inst.value[METADATA_CONTENT_FIELD] = new StaticFile({
        filepath: staticFile.filepath,
        content: await replaceZipTimestamp(content),
      })
    })
  },
})

export default filterCreator
