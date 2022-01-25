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
import { OpenAPI } from 'openapi-types'

export type LoadedSwagger = {
  document: OpenAPI.Document
  parser: SwaggerParser
}

export const loadSwagger = async (swaggerPath: string): Promise<LoadedSwagger> => {
  const parser = new SwaggerParser()
  const document = await parser.bundle(swaggerPath)
  return {
    document,
    parser,
  }
}
