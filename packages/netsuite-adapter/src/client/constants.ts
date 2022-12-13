/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { FILE_CABINET_PATH_SEPARATOR, SUITE_SCRIPTS_FOLDER_NAME, TEMPLATES_FOLDER_NAME, WEB_SITE_HOSTING_FILES_FOLDER_NAME } from '../constants'


export const ATTRIBUTE_PREFIX = '@_'
export const CDATA_TAG_NAME = '__cdata'

export const fileCabinetTopLevelFolders = [
  `${FILE_CABINET_PATH_SEPARATOR}${SUITE_SCRIPTS_FOLDER_NAME}`,
  `${FILE_CABINET_PATH_SEPARATOR}${TEMPLATES_FOLDER_NAME}`,
  `${FILE_CABINET_PATH_SEPARATOR}${WEB_SITE_HOSTING_FILES_FOLDER_NAME}`,
]

export const XSI_TYPE = 'xsi:type'
