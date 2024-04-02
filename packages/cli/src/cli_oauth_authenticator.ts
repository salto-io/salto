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
import open from 'open'
import http from 'http'
import express, { Request, Response } from 'express'
import { OAuthRequestParameters, OauthAccessTokenResponse } from '@salto-io/adapter-api'
import { CliOutput } from './types'
import { outputLine } from './outputer'
import { formatGoToBrowser } from './formatter'

type ProcessOAuthCredentialsParams = {
  port: number
  output: CliOutput
} & OAuthRequestParameters

type CreateLocalOauthServerParams = Pick<
  ProcessOAuthCredentialsParams,
  'port' | 'oauthRequiredFields' | 'directParamsExtraction'
>

export const createServer = ({
  port,
  oauthRequiredFields,
  directParamsExtraction,
  resolve,
  reject,
}: CreateLocalOauthServerParams & {
  resolve: (value: OauthAccessTokenResponse | PromiseLike<OauthAccessTokenResponse>) => void
  reject: (reason?: Error) => void
}): http.Server => {
  let server: http.Server
  const app = express()
  const extractionPath = directParamsExtraction ? '/' : '/extract'
  if (!directParamsExtraction) {
    app.get('/', (_req: Request, res: Response) => {
      res.send(
        `<script>url = window.location.href;window.location.replace("http://localhost:${port}/extract/?" + url.substring(url.search("#") + 1, url.length));</script>`,
      )
    })
  }
  app.get(extractionPath, (req: Request, res: Response) => {
    res.send(`<script>window.location.replace("http://localhost:${port}/done")</script>`)
    if (_.every(oauthRequiredFields, field => typeof req.query[field] === 'string')) {
      const fields = Object.fromEntries(
        oauthRequiredFields.map(field => [_.camelCase(field), req.query[field] as string]),
      )
      resolve({
        fields,
      })
    } else {
      reject(new Error('Unexpected oauth response structure'))
    }
  })
  app.get('/done', (_req: Request, res: Response) => {
    res.send("<h3>Done configuring Salto's Oauth access. You may close this tab.</h3>")
    if (server) {
      server.close()
    }
  })
  server = app.listen(port)
  return server
}

const createLocalOauthServer = async ({
  port,
  oauthRequiredFields,
  directParamsExtraction,
}: CreateLocalOauthServerParams): Promise<OauthAccessTokenResponse> =>
  new Promise<OauthAccessTokenResponse>((resolve, reject) =>
    createServer({
      port,
      oauthRequiredFields,
      directParamsExtraction,
      resolve,
      reject,
    }),
  )

export const processOauthCredentials = async ({
  port,
  output,
  url,
  oauthRequiredFields,
  directParamsExtraction,
}: {
  port: number
  output: CliOutput
} & OAuthRequestParameters): Promise<OauthAccessTokenResponse> => {
  const accessTokenPromise = createLocalOauthServer({ port, oauthRequiredFields, directParamsExtraction })
  outputLine(formatGoToBrowser(url), output)
  await open(url)
  return accessTokenPromise
}
