/*
*                      Copyright 2021 Salto Labs Ltd.
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
export const NETSUITE = 'netsuite'
export const RECORDS_PATH = 'Records'
export const FILE_CABINET_PATH = 'FileCabinet'
export const TYPES_PATH = 'Types'
export const SUBTYPES_PATH = 'Subtypes'
export const FIELD_TYPES_PATH = 'fieldTypes'

// Type names
export const ADDRESS_FORM = 'addressForm'
export const CUSTOM_LIST = 'customlist'
export const CUSTOM_RECORD_TYPE = 'customrecordtype'
export const CUSTOM_SEGMENT = 'customsegment'
export const DATASET = 'dataset'
export const EMAIL_TEMPLATE = 'emailtemplate'
export const ENTITY_CUSTOM_FIELD = 'entitycustomfield'
export const ENTRY_FORM = 'entryForm'
export const INTEGRATION = 'integration'
export const ROLE = 'role'
export const SAVED_SEARCH = 'savedsearch'
export const SAVED_CSV_IMPORT = 'savedcsvimport'
export const TRANSACTION_BODY_CUSTOM_FIELD = 'transactionbodycustomfield'
export const TRANSACTION_COLUMN_CUSTOM_FIELD = 'transactioncolumncustomfield'
export const TRANSACTION_FORM = 'transactionForm'
export const WORKBOOK = 'workbook'
export const WORKFLOW = 'workflow'
export const FILE = 'file'
export const FOLDER = 'folder'

// Fields
export const SCRIPT_ID = 'scriptid'
export const PATH = 'path'
export const PERMITTED_ROLE = 'permittedrole'
export const RECORD_TYPE = 'recordType'
export const LAST_FETCH_TIME = '_lastfetchtime'

// Field Annotations
export const IS_ATTRIBUTE = 'isAttribute'
export const ADDITIONAL_FILE_SUFFIX = 'additionalFileSuffix'

// SDF FileCabinet top level folders
export const FILE_CABINET_PATH_SEPARATOR = '/'
export const SUITE_SCRIPTS_FOLDER_NAME = 'SuiteScripts'
export const TEMPLATES_FOLDER_NAME = 'Templates'
export const WEB_SITE_HOSTING_FILES_FOLDER_NAME = 'Web Site Hosting Files'

// NetsuiteConfig
export const TYPES_TO_SKIP = 'typesToSkip'
export const FILE_PATHS_REGEX_SKIP_LIST = 'filePathRegexSkipList'
export const FETCH_ALL_TYPES_AT_ONCE = 'fetchAllTypesAtOnce'
export const FETCH_TYPE_TIMEOUT_IN_MINUTES = 'fetchTypeTimeoutInMinutes'
export const MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST = 'maxItemsInImportObjectsRequest'
export const DEPLOY_REFERENCED_ELEMENTS = 'deployReferencedElements'
export const SDF_CONCURRENCY_LIMIT = 'sdfConcurrencyLimit'
export const SUITEAPP_CONCURRENCY_LIMIT = 'suiteAppConcurrencyLimit'
export const CLIENT_CONFIG = 'client'
export const SUITEAPP_CLIENT_CONFIG = 'suiteAppClient'
export const CONCURRENCY_LIMIT = 'concurrencyLimit'
export const FETCH_TARGET = 'fetchTarget'
export const SKIP_LIST = 'skipList'
export const USE_CHANGES_DETECTION = 'useChangesDetection'
export const RAW_CONFIG = 'rawConfig'
export const FETCH = 'fetch'
export const INCLUDE = 'include'
export const EXCLUDE = 'exclude'
export const DEPLOY = 'deploy'

export const CAPTURE = 'capture'
// e.g. '[scriptid=customworkflow1]' & '[scriptid=customworkflow1.workflowstate17.workflowaction33]'
export const scriptIdReferenceRegex = new RegExp(`^\\[${SCRIPT_ID}=(?<${CAPTURE}>[a-z0-9_]+(\\.[a-z0-9_]+)*)]$`)
