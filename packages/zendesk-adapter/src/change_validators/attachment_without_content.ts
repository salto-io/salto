/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { MACRO_ATTACHMENT_TYPE_NAME } from '../filters/macro_attachments'
import { ARTICLE_ATTACHMENT_TYPE_NAME } from '../constants'

const attachmentTypes = [MACRO_ATTACHMENT_TYPE_NAME, ARTICLE_ATTACHMENT_TYPE_NAME]

/**
 * prevent deployment of attachment without content. The attachment can be without content if the get content api call
 * failed
 */
export const attachmentWithoutContentValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => attachmentTypes.includes(instance.elemID.typeName))
    .filter(instance => instance.value.content === undefined)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Attachment can not be deployed without content',
        detailedMessage: `${instance.elemID.typeName} instance can not be deployed without a content field`,
      },
    ])
