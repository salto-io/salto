/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  FILE_CABINET_PATH_SEPARATOR,
  SUITE_SCRIPTS_FOLDER_NAME,
  TEMPLATES_FOLDER_NAME,
  WEB_SITE_HOSTING_FILES_FOLDER_NAME,
} from '../constants'

export const ATTRIBUTE_PREFIX = '@_'
export const CDATA_TAG_NAME = '__cdata'

export const fileCabinetTopLevelFolders = [
  `${FILE_CABINET_PATH_SEPARATOR}${SUITE_SCRIPTS_FOLDER_NAME}`,
  `${FILE_CABINET_PATH_SEPARATOR}${TEMPLATES_FOLDER_NAME}`,
  `${FILE_CABINET_PATH_SEPARATOR}${WEB_SITE_HOSTING_FILES_FOLDER_NAME}`,
]

export const XSI_TYPE = 'xsi:type'
