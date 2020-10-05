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
import open from 'open'
import http from 'http'
import express, { Request, Response } from 'express'
import { OauthAccessTokenResponse } from '@salto-io/adapter-api'
import { CliOutput } from './types'
import { outputLine } from './outputer'
import { formatGoToBrowser } from './formatter'

export const createServer = (port: number, accessTokenField: string,
  resolve: (value: OauthAccessTokenResponse | PromiseLike<OauthAccessTokenResponse>) => void,
  reject: (reason?: Error) => void): http.Server => {
  let server: http.Server
  const app = express()
  app.get('/', (_req: Request, res: Response) => {
    res.send(`<script>url = window.location.href;window.location.replace("http://localhost:${port}/extract/?" + url.substring(url.search("#") + 1, url.length));</script>`)
  })
  app.get('/extract', (req: Request, res: Response) => {
    res.send(`<script>window.location.replace("http://localhost:${port}/done")</script>`)
    const accessToken = req.query[accessTokenField]
    if (typeof req.query.instance_url === 'string' && typeof accessToken === 'string') {
      resolve({
        instanceUrl: req.query.instance_url,
        accessToken,
      })
    } else {
      reject(new Error('Unexpected oauth response structure'))
    }
  })
  app.get('/done', (_req: Request, res: Response) => {
    res.send('<h3>Done configuring Salto\'s Oauth access. You may close this tab.</h3>')
    if (server) {
      server.close()
    }
  })
  server = app.listen(port)
  return server
}

const createLocalOauthServer = async (port: number, accessTokenField: string):
  Promise<OauthAccessTokenResponse> => new Promise<OauthAccessTokenResponse>((resolve,
    reject) => createServer(port, accessTokenField, resolve, reject))

export const processOauthCredentials = async (
  port: number,
  accessTokenField: string,
  url: string,
  output: CliOutput,
): Promise<OauthAccessTokenResponse> => {
  const accessTokenPromise = createLocalOauthServer(port, accessTokenField)
  outputLine(formatGoToBrowser(url), output)
  open(url)
  return accessTokenPromise
}
