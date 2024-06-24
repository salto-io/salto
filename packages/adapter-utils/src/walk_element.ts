/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  ElemID,
  Values,
  Value,
  isInstanceElement,
  isType,
  isObjectType,
  isElement,
  Element,
  isVariable,
} from '@salto-io/adapter-api'

const log = logger(module)

export enum WALK_NEXT_STEP {
  RECURSE, // Continue with the recursion
  SKIP, // Don't go deeper in the recursion (on that branch)
  EXIT, // Stop the entire walk, no matter where you are
}
type WalkOnFuncArgs = {
  value: Value
  path: ElemID
}
export type WalkOnFunc = (args: WalkOnFuncArgs) => WALK_NEXT_STEP
class ExitWalk extends Error {}

export const walkOnValue = ({ elemId, value, func }: { elemId: ElemID; value: Value; func: WalkOnFunc }): void => {
  const run = (current: Value, keyPathID: ElemID): void => {
    const runOnValues = (values: Values): void => {
      _.mapValues(values, (val, key) => run(val, keyPathID?.createNestedID(key)))
    }
    const res = func({ value: current, path: keyPathID })
    if (res === WALK_NEXT_STEP.EXIT) {
      throw new ExitWalk()
    }
    if (res === WALK_NEXT_STEP.SKIP) {
      return
    }
    if (isElement(current)) {
      if (isType(current)) {
        run(current.annotations, current.elemID.createNestedID('attr'))
      } else {
        runOnValues(current.annotations)
      }
      if (isObjectType(current)) {
        run(current.fields, current.elemID.createNestedID('field'))
      } else if (isInstanceElement(current)) {
        runOnValues(current.value)
      } else if (isVariable(current)) {
        // We only support primitive variables for now, if we try to create nested IDs we will fail
        // so until we support it, we do not recurse into variables, we only get the top level.
        // hopefully this comment is long and memorable enough that when we implement support for
        // non primitive variables we also change this to "run(current.value, current.elemID)"
        func({ value: current.value, path: current.elemID })
      }
    } else if (_.isArray(current)) {
      current.forEach((item, index) => run(item, keyPathID?.createNestedID(String(index))))
    } else if (_.isPlainObject(current)) {
      runOnValues(current)
    }
  }
  try {
    run(value, elemId)
  } catch (e) {
    if (e instanceof ExitWalk) {
      return
    }
    log.warn(`Failed to walk on element ${elemId.getFullName()}: ${e}`)
    throw e
  }
}

export const walkOnElement = ({ element, func }: { element: Element; func: WalkOnFunc }): void =>
  walkOnValue({ elemId: element.elemID, value: element, func })
