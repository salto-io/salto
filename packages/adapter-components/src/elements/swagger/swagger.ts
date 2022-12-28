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
import SwaggerParser from '@apidevtools/swagger-parser'
import { logger } from '@salto-io/logging'
import { promises } from '@salto-io/lowerdash'
import { OpenAPI } from 'openapi-types'

const { sleep } = promises.timeout

const DEFAULT_NUMBER_OF_RETRIES = 5

const log = logger(module)

export type LoadedSwagger = {
  document: OpenAPI.Document
  parser: SwaggerParser
}

export const loadSwagger = async (
  swaggerPath: string,
  numberOfRetries = DEFAULT_NUMBER_OF_RETRIES
): Promise<LoadedSwagger> => {
  try {
    const parser = new SwaggerParser()
    const document = await parser.bundle(swaggerPath)
    return {
      document,
      parser,
    }
  } catch (err) {
    log.warn(`Failed to load swagger file ${swaggerPath} with error: ${err}. Retries left: ${numberOfRetries} (retrying in 5s)`)
    if (numberOfRetries <= 0) {
      throw err
    }
    await sleep(5000)
    return loadSwagger(swaggerPath, numberOfRetries - 1)
  }
}
