/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { logger } from '@salto-io/logging'
import { safeJsonStringify, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { Value } from '@salto-io/adapter-api'

const log = logger(module)
export const SCRIPT_RUNNER_DC_TYPES = ['com.onresolve.jira.groovy.GroovyFunctionPlugin',
  'com.onresolve.jira.groovy.GroovyValidator',
  'com.onresolve.jira.groovy.GroovyCondition']
const DC_ENCODE_PREFIX = '`!`'
const CANNED_SCRIPT = 'canned-script'
const FIELD_COMMENT_TYPE = 'com.onresolve.scriptrunner.canned.jira.workflow.postfunctions.CommentIssue'

const decodeBase64 = (base64: string): string => {
  try {
    const decoded = Buffer.from(base64, 'base64').toString('utf8')
    if (!decoded.startsWith(DC_ENCODE_PREFIX)) {
      log.warn(`Could not decode DC ScriptRunner script, expected to start with ${DC_ENCODE_PREFIX}, got: ${decoded}`)
      return base64
    }
    // all base64 strings of DC ScriptRunner scripts start with `!` (or YCFg in base 64)
    return decoded.substring(DC_ENCODE_PREFIX.length)
  } catch (e) {
    log.warn(`Could not decode DC ScriptRunner script, expected base64, got: ${base64}`)
    return base64
  }
}

// see decode comment about the prefix
const encodeBase64 = (script: string): string => Buffer.from(DC_ENCODE_PREFIX + script).toString('base64')

const decodeScriptObject = (base64: string): unknown => {
  const script = decodeBase64(base64)
  try {
    const value = JSON.parse(script)
    if (value.scriptPath === null) {
      delete value.scriptPath
    } else if (value.script === null) {
      delete value.script
    }
    return value
  } catch (e) {
    log.warn(`Could not decode DC ScriptRunner script, expected JSON, got: ${script}`)
    return base64
  }
}

const encodeScriptObject = (value: Value): string => {
  if (value.scriptPath === undefined) {
    value.scriptPath = null
  } else if (value.script === undefined) {
    value.script = null
  }
  return encodeBase64(safeJsonStringify(value))
}

type FieldToCodeFuncMap = Map<string, Value>
const fieldToDecodeMap: FieldToCodeFuncMap = new Map([
  ['FIELD_NOTES', decodeBase64],
  ['FIELD_MESSAGE', decodeBase64],
  ['FIELD_INCLUDE_ATTACHMENTS_CALLBACK', decodeBase64],
  ['FIELD_EMAIL_TEMPLATE', decodeBase64],
  ['FIELD_EMAIL_SUBJECT_TEMPLATE', decodeBase64],
  ['FIELD_CONDITION', decodeScriptObject],
  ['FIELD_SCRIPT_FILE_OR_SCRIPT', decodeScriptObject],
  ['FIELD_ADDITIONAL_SCRIPT', decodeScriptObject],
  ['FIELD_COMMENT', decodeBase64],
])

const fieldToEncodeMap: FieldToCodeFuncMap = new Map([
  ['FIELD_NOTES', encodeBase64],
  ['FIELD_MESSAGE', encodeBase64],
  ['FIELD_INCLUDE_ATTACHMENTS_CALLBACK', encodeBase64],
  ['FIELD_EMAIL_TEMPLATE', encodeBase64],
  ['FIELD_EMAIL_SUBJECT_TEMPLATE', encodeBase64],
  ['FIELD_CONDITION', encodeScriptObject],
  ['FIELD_SCRIPT_FILE_OR_SCRIPT', encodeScriptObject],
  ['FIELD_ADDITIONAL_SCRIPT', encodeScriptObject],
  ['FIELD_COMMENT', encodeBase64],
])

const transformConfigFields = (funcMap: FieldToCodeFuncMap): WalkOnFunc => (
  ({ value }): WALK_NEXT_STEP => {
    if (value === undefined) {
      return WALK_NEXT_STEP.SKIP
    }
    if (SCRIPT_RUNNER_DC_TYPES.includes(value.type) && value.configuration !== undefined) {
      // remove empty fields
      Object.entries(value.configuration).forEach(([fieldName, fieldValue]) => {
        if (fieldValue === '') {
          delete value.configuration[fieldName]
        }
      })
      funcMap.forEach((_value, fieldName) => {
        // Field comment is base64 encoded only in some cases. In others the field is plain text
        if (value.configuration[fieldName] !== undefined
          && (fieldName !== 'FIELD_COMMENT' || value.configuration[CANNED_SCRIPT] === FIELD_COMMENT_TYPE)) {
          value.configuration[fieldName] = funcMap.get(fieldName)(value.configuration[fieldName])
        }
      })
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  })

export const decodeDcFields = transformConfigFields(fieldToDecodeMap)
export const encodeDcFields = transformConfigFields(fieldToEncodeMap)
