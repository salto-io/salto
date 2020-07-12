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
import { WebClient } from '@slack/web-api'
import * as nodemailer from 'nodemailer'
import { DetailedChange } from '@salto-io/adapter-api'
import { Config, Notification, EmailNotificationType, SlackNotificationType, SMTP, Slack } from './config'
import { out, err } from './logger'

const smtpProtocol = (ssl: boolean): string => `smtp${ssl ? 's' : ''}`
const smtpConnectionString = (smtp: SMTP): string =>
  `${smtpProtocol(smtp.ssl)}://${smtp.username}:${smtp?.password}@${smtp.host}:${smtp.port}`

const templateHTMLBody = (changes: DetailedChange[]): string =>
  changes.map((change: DetailedChange) => change.id.getFullName()).join('\n')

const templateSlackMessage = async (
  title: string, changes: DetailedChange[]): Promise<string> => {
  const changesFullName = changes
    .map((change: DetailedChange) => change.id.getFullName())
  return [`*${title}*`, ...changesFullName].join('\n')
}

const sendEmail = async (
  notification: Notification,
  changes: DetailedChange[],
  smtp: SMTP,
  attachment: string):
  Promise<boolean> => {
  const transporter = nodemailer.createTransport(smtpConnectionString(smtp))
  const mailOptions = {
    from: notification.from,
    to: notification.to,
    subject: notification.title,
    text: templateHTMLBody(changes),
    attachments: [
      {
        filename: 'diff.html',
        content: attachment,
        contentType: 'text/html',
      },
    ],
  }
  try {
    await transporter.sendMail(mailOptions)
    out(`Sent mail successfully to ${notification.to.join(',')}`)
  } catch (e) {
    err(`Failed to send mail to ${notification.to.join(',')}`)
    return false
  }
  return true
}

const sendSlackMessage = async (
  notification: Notification,
  changes: DetailedChange[],
  config: Slack,
  attachment: string):
  Promise<boolean> => {
  try {
    const client = new WebClient(config.token)

    const message = await templateSlackMessage(notification.title, changes)
    const postMessagePromises = notification.to
      .map((to: string) => client.chat.postMessage({
        username: notification.from,
        channel: to,
        text: message,
      }))
    await Promise.all(postMessagePromises)

    await client.files.upload({
      channels: notification.to.join(','),
      title: 'Detailed changes report',
      filetype: 'html',
      filename: 'diff.html',
      content: attachment,
    })
    out(`Sent slack message successfully to ${notification.to.join(',')}`)
  } catch (e) {
    err(`Failed to send slack message to ${notification.to.join(',')}`)
    return false
  }
  return true
}

export const notify = async (
  notification: Notification,
  changes: DetailedChange[],
  config: Config,
  attachment: string):
  Promise<boolean> => {
  switch (notification.type) {
    case EmailNotificationType:
      return sendEmail(notification, changes, config.smtp, attachment)
    case SlackNotificationType:
      return sendSlackMessage(notification, changes, config.slack, attachment)
    default:
      return false
  }
}
