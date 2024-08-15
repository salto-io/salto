/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Element, ElemID, InstanceElement, isStaticFile, StaticFile } from '@salto-io/adapter-api'
import { findInstances } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import mime from 'mime-types'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { SALESFORCE, METADATA_CONTENT_FIELD } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

export const STATIC_RESOURCE_METADATA_TYPE_ID = new ElemID(SALESFORCE, 'StaticResource')
export const CONTENT_TYPE = 'contentType'
const RESOURCE_SUFFIX_LENGTH = 'resource'.length

const modifyFileExtension = async (staticResourceInstance: InstanceElement): Promise<void> => {
  const staticFile = staticResourceInstance.value[METADATA_CONTENT_FIELD]
  if (!isStaticFile(staticFile)) {
    log.debug(
      `Could not modify file extension for ${staticResourceInstance.elemID.getFullName()} because it is not a StaticFile`,
    )
    return
  }

  const content = await staticFile.getContent()

  if (content === undefined) {
    log.debug(
      `Could not modify file extension for ${staticResourceInstance.elemID.getFullName()} because its content is undefined`,
    )
    return
  }

  const contentTypeValue = staticResourceInstance.value[CONTENT_TYPE]
  if (!_.isString(contentTypeValue)) {
    log.debug(
      `Could not modify file extension for ${staticResourceInstance.elemID.getFullName()} due to non string contentType: ${contentTypeValue}`,
    )
    return
  }

  const newExtension = mime.extension(contentTypeValue)
  if (!_.isString(newExtension)) {
    log.debug(
      `Could not modify file extension for ${staticResourceInstance.elemID.getFullName()} due to unrecognized contentType: ${contentTypeValue}`,
    )
    return
  }
  const currentFilepath = staticFile.filepath
  staticResourceInstance.value[METADATA_CONTENT_FIELD] = new StaticFile({
    filepath: `${currentFilepath.slice(0, -RESOURCE_SUFFIX_LENGTH)}${newExtension}`,
    content,
  })
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'staticResourceFileExtFilter',
  /**
   * Upon fetch modify the extension of the StaticResource's static file CONTENT field
   * from '.resource' to the correct extension based on the CONTENT_TYPE field
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const staticResourceInstances = findInstances(elements, STATIC_RESOURCE_METADATA_TYPE_ID)
    await awu(staticResourceInstances).forEach(modifyFileExtension)
  },
})

export default filterCreator
