/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { EventEmitter } from 'pietile-eventemitter'

import {
  Progress as AdapterProgress,
  ProgressReporter as AdapterProgressReporter,
  AdapterOperationName,
} from '@salto-io/adapter-api'


export type AdapterEvents = {
  adapterProgress: (
    adapterName: string,
    operationName: AdapterOperationName,
    progress: AdapterProgress
  ) => void
}

export const createAdapterProgressReporter = (
  adapterName: string,
  operationName: AdapterOperationName,
  progressEmitter?: EventEmitter<AdapterEvents>
): AdapterProgressReporter => ({
  reportProgress: (progress: AdapterProgress) => {
    if (progressEmitter) {
      progressEmitter.emit(
        'adapterProgress',
        adapterName,
        operationName,
        progress
      )
    }
  },
})
