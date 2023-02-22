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
const SCRIPT_RUNNER_DC_TYPES = ['com.onresolve.jira.groovy.GroovyFunctionPlugin',
  'com.onresolve.jira.groovy.GroovyValidator',
  'com.onresolve.jira.groovy.GroovyCondition']
const DC_BASE64_PREFIX = 'YCFg'
const CANNED_SCRIPT = '"canned-script"'
const FIELD_COMMENT_TYPE = 'com.onresolve.scriptrunner.canned.jira.workflow.postfunctions.CommentIssue'


const decodeBase64 = (base64: string): string => {
  if (!base64.startsWith(DC_BASE64_PREFIX)) {
    log.warn(`Could not decode DC ScriptRunner script, expected base64, got: ${base64}`)
    return base64
  }
  return Buffer.from(base64.substring(DC_BASE64_PREFIX.length), 'base64').toString('utf8')
}

const encodeBase64 = (script: string): string => DC_BASE64_PREFIX + Buffer.from(script).toString('base64')

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
  ['FIELD_CONDITION', decodeScriptObject],
  ['FIELD_SCRIPT_FILE_OR_SCRIPT', decodeScriptObject],
  ['FIELD_ADDITIONAL_SCRIPT', decodeBase64],
  ['FIELD_COMMENT', decodeBase64],
])

const fieldToEncodeMap: FieldToCodeFuncMap = new Map([
  ['FIELD_NOTES', encodeBase64],
  ['FIELD_CONDITION', encodeScriptObject],
  ['FIELD_SCRIPT_FILE_OR_SCRIPT', encodeScriptObject],
  ['FIELD_ADDITIONAL_SCRIPT', encodeBase64],
  ['FIELD_COMMENT', encodeBase64],
])

const transformConfigFields = (funcMap: FieldToCodeFuncMap): WalkOnFunc => (
  ({ value }): WALK_NEXT_STEP => {
    if (SCRIPT_RUNNER_DC_TYPES.includes(value.type) && value.configuration !== undefined) {
      funcMap.forEach((_value, fieldName) => {
        // Field comment is base64 encoded only in some cases
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
