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

import { gzip, gunzip } from 'zlib'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { isInstanceElement, Element, isInstanceChange, isAdditionOrModificationChange, getChangeData, InstanceElement, Value } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'

const { awu } = collections.asynciterable
const { makeArray } = collections.array
const log = logger(module)
const scriptRunnerPostFunctionType = 'com.onresolve.jira.groovy.groovyrunner__script-postfunction'
const scriptRunnerValidatorType = 'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators'
const scriptRunnerConditionType = 'com.onresolve.jira.groovy.groovyrunner__script-workflow-conditions'

const unzip = async (buffer: Buffer): Promise<Buffer> => new Promise((resolve, reject) => {
  gunzip(buffer, (err, result) => {
    if (err) {
      reject(err)
    } else {
      resolve(result)
    }
  })
})

const zip = async (buffer: Buffer): Promise<Buffer> => new Promise((resolve, reject) => {
  gzip(buffer, (err, result) => {
    if (err) {
      reject(err)
    } else {
      resolve(result)
    }
  })
})

type CompressedObject = {
  compressed: number[]
}

const COMPRESSED_OBJECT_SCHEME = Joi.object({
  compressed: Joi.array().items(Joi.number()).required(),
})

const isCompressedObject = createSchemeGuard<CompressedObject>(COMPRESSED_OBJECT_SCHEME, 'ScriptRunner object not as expected')

// the script runner decode path
// stringBase64=>serializedString=>compressedObject=>dataString=>dataObject
// it starts with a base64 string. Decoding it turns into a json serialized string
// the json is in format of {"compressed: Array<number>"}. The array is a gzip compressed buffer
// decompressing the buffer turns it into a json string of the data object

const decodeScriptRunner = async (scriptRunnerString: string | undefined): Promise<Value> => {
  if (scriptRunnerString === undefined) {
    return undefined
  }
  try {
    const compressedObject = JSON.parse(Buffer.from(scriptRunnerString, 'base64').toString('utf8'))
    if (!isCompressedObject(compressedObject)) {
      return scriptRunnerString
    }
    const zipBuffer = Buffer.from(compressedObject.compressed)
    const dataString = (await unzip(zipBuffer)).toString()
    return JSON.parse(dataString)
  } catch (e) {
    log.warn('Could not decode script runner')
    if (e instanceof Error) {
      log.warn('Error due to  %s', e.message)
    }
    return scriptRunnerString
  }
}

const encodeScriptRunner = async (object: Value): Promise<Value> => {
  try {
    const dataString = safeJsonStringify(object)
    const zipBuffer = await zip(Buffer.from(dataString))
    const compressedObject = {
      compressed: zipBuffer.toJSON().data,
    }
    return Buffer.from(safeJsonStringify(compressedObject)).toString('base64')
  } catch (e) {
    log.warn('Could not encode script runner object')
    if (e instanceof Error) {
      log.warn('error due to  %s', e.message)
    }
    return object
  }
}

const fallBackJsonParse = (scriptRunnerString: string): Value => {
  try {
    return JSON.parse(scriptRunnerString)
  } catch (e) {
    log.warn('Could not parse script runner object')
    if (e instanceof Error) {
      log.warn('error due to  %s', e.message)
    }
    return scriptRunnerString
  }
}

const fallBackJsonStringify = (object: Value): Value => {
  if (object === undefined) {
    return undefined
  }
  return safeJsonStringify(object)
}

const applyOnScriptRunnersFields = async ({ instance, func, field, typeName } : {
  instance: InstanceElement
  func: (current: Value) => Promise<Value>
  field: string
  typeName: string
}
): Promise<void> => {
  await awu(makeArray(instance.value.transitions))
    .forEach(async transition => {
      await awu(makeArray(transition.rules?.[field]))
        .filter(scriptRunnerField => scriptRunnerField.type === typeName)
        .filter(scriptRunnerField => scriptRunnerField.configuration !== undefined)
        .forEach(async scriptRunnerField => {
          scriptRunnerField.configuration.value = await func(scriptRunnerField.configuration.value)
        })
    })
}

const filter: FilterCreator = () => ({
  name: 'scriptRunnerWorkflowFilter',
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(async instance => {
        await applyOnScriptRunnersFields({ instance, func: decodeScriptRunner, field: 'postFunctions', typeName: scriptRunnerPostFunctionType })
        await applyOnScriptRunnersFields({ instance, func: fallBackJsonParse, field: 'validators', typeName: scriptRunnerValidatorType })
        await applyOnScriptRunnersFields({ instance, func: fallBackJsonParse, field: 'conditions', typeName: scriptRunnerConditionType })
      })
  },
  preDeploy: async changes => {
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(async instance => {
        await applyOnScriptRunnersFields({ instance, func: encodeScriptRunner, field: 'postFunctions', typeName: scriptRunnerPostFunctionType })
        await applyOnScriptRunnersFields({ instance, func: fallBackJsonStringify, field: 'validators', typeName: scriptRunnerValidatorType })
        await applyOnScriptRunnersFields({ instance, func: fallBackJsonStringify, field: 'conditions', typeName: scriptRunnerConditionType })
      })
  },
  onDeploy: async changes => {
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(async instance => {
        await applyOnScriptRunnersFields({ instance, func: decodeScriptRunner, field: 'postFunctions', typeName: scriptRunnerPostFunctionType })
        await applyOnScriptRunnersFields({ instance, func: fallBackJsonParse, field: 'validators', typeName: scriptRunnerValidatorType })
        await applyOnScriptRunnersFields({ instance, func: fallBackJsonParse, field: 'conditions', typeName: scriptRunnerConditionType })
      })
  },
})

export default filter
