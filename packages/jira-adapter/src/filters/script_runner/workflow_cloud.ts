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

import { gzip, ungzip } from 'pako'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, safeJsonStringify, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { Value } from '@salto-io/adapter-api'
import { renameKey } from '../../utils'

const log = logger(module)
const SCRIPT_RUNNER_POST_FUNCTION_TYPE = 'com.onresolve.jira.groovy.groovyrunner__script-postfunction'
const SCRIPT_RUNNER_VALIDATOR_TYPE = 'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators'
const SCRIPT_RUNNER_CONDITION_TYPE = 'com.onresolve.jira.groovy.groovyrunner__script-workflow-conditions'
const SCRIPT_RUNNER_SEND_NOTIFICATIONS = 'com.adaptavist.sr.cloud.workflow.SendNotification'
const SCRIPT_RUNNER_FIELD = 'scriptRunner'
const VALUE = 'value'

type CompressedObject = {
  compressed: number[]
}

const COMPRESSED_OBJECT_SCHEME = Joi.object({
  compressed: Joi.array().items(Joi.number()).required(),
})

export const isCompressedObject = createSchemeGuard<CompressedObject>(COMPRESSED_OBJECT_SCHEME, 'ScriptRunner object not as expected')

const decodeScriptRunner = (scriptRunnerString: string): unknown => {
  try {
    const compressedObject = JSON.parse(Buffer.from(scriptRunnerString, 'base64').toString('utf8'))
    if (!isCompressedObject(compressedObject)) {
      return scriptRunnerString
    }
    const zipBuffer = Buffer.from(compressedObject.compressed)
    const dataString: string = ungzip(zipBuffer, { to: 'string' })
    return JSON.parse(dataString)
  } catch (e) {
    log.error('Could not decode script runner')
    if (e instanceof Error) {
      log.error('Error due to  %s', e.message)
    }
    return scriptRunnerString
  }
}

const encodeScriptRunner = (object: Value): Value => {
  try {
    const dataString = safeJsonStringify(object)
    const zipBuffer = Buffer.from(gzip(dataString))
    const compressedObject = {
      compressed: zipBuffer.toJSON().data,
    }
    return Buffer.from(safeJsonStringify(compressedObject)).toString('base64')
  } catch (e) {
    log.error('Could not encode script runner object')
    if (e instanceof Error) {
      log.error('error due to  %s', e.message)
    }
    throw e
  }
}

const fallBackJsonParse = (scriptRunnerString: string): Value => {
  try {
    return JSON.parse(scriptRunnerString)
  } catch (e) {
    log.error('Could not parse script runner object')
    if (e instanceof Error) {
      log.error('error due to  %s', e.message)
    }
    return scriptRunnerString
  }
}

const transformAndEncode = (object: Value): void => {
  if (object[SCRIPT_RUNNER_FIELD] === undefined) {
    return
  }
  renameKey(object, { from: SCRIPT_RUNNER_FIELD, to: VALUE })
  if (object[VALUE].accountIds !== undefined) {
    object[VALUE].accountIds = object[VALUE].accountIds.join(',')
  }
  if (object[VALUE].className === SCRIPT_RUNNER_SEND_NOTIFICATIONS
    && object[VALUE].groupName !== undefined) {
    object[VALUE].groupName = object[VALUE].groupName.join(',')
  }
  object[VALUE] = encodeScriptRunner(object[VALUE])
}

const transformAndDecode = (object: Value): void => {
  if (object.value === undefined) {
    return
  }
  renameKey(object, { from: VALUE, to: SCRIPT_RUNNER_FIELD })
  object[SCRIPT_RUNNER_FIELD] = decodeScriptRunner(object[SCRIPT_RUNNER_FIELD])
  if (object[SCRIPT_RUNNER_FIELD].accountIds !== undefined) {
    object[SCRIPT_RUNNER_FIELD].accountIds = object[SCRIPT_RUNNER_FIELD].accountIds.split(',')
  }
  if (object[SCRIPT_RUNNER_FIELD].className === SCRIPT_RUNNER_SEND_NOTIFICATIONS
    && object[SCRIPT_RUNNER_FIELD].groupName !== undefined) {
    object[SCRIPT_RUNNER_FIELD].groupName = object[SCRIPT_RUNNER_FIELD].groupName.split(',')
  }
}

const transformAndStringify = (object: Value): void => {
  if (object[SCRIPT_RUNNER_FIELD] === undefined) {
    return
  }
  renameKey(object, { from: SCRIPT_RUNNER_FIELD, to: VALUE })
  object[VALUE] = safeJsonStringify(object[VALUE])
}

const transformAndObjectify = (object: Value): void => {
  if (object.value === undefined) {
    return
  }
  renameKey(object, { from: VALUE, to: SCRIPT_RUNNER_FIELD })
  object[SCRIPT_RUNNER_FIELD] = fallBackJsonParse(object[SCRIPT_RUNNER_FIELD])
}

type TypeToCodeFuncMap = Map<string, Value>

const typeToEncodeFuncMap: TypeToCodeFuncMap = new Map([
  [SCRIPT_RUNNER_POST_FUNCTION_TYPE, transformAndEncode],
  [SCRIPT_RUNNER_VALIDATOR_TYPE, transformAndStringify],
  [SCRIPT_RUNNER_CONDITION_TYPE, transformAndStringify],
])

const typeToDecodeFuncMap: TypeToCodeFuncMap = new Map([
  [SCRIPT_RUNNER_POST_FUNCTION_TYPE, transformAndDecode],
  [SCRIPT_RUNNER_VALIDATOR_TYPE, transformAndObjectify],
  [SCRIPT_RUNNER_CONDITION_TYPE, transformAndObjectify],
])

const transformConfigValue = (typeMap: TypeToCodeFuncMap): WalkOnFunc => (
  ({ value }): WALK_NEXT_STEP => {
    if (value !== undefined && typeMap.has(value.type) && value.configuration !== undefined) {
      typeMap.get(value.type)(value.configuration)
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  })

export const decodeCloudFields = transformConfigValue(typeToDecodeFuncMap)
export const encodeCloudFields = transformConfigValue(typeToEncodeFuncMap)
