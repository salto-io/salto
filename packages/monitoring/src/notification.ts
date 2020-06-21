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
import * as nodemailer from 'nodemailer'
import { DetailedChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { Config, Notification, NotificationType, SMTP } from './config'

const log = logger(module)

export const EmailNotificationType: NotificationType = 'email'

const smtpProtocol = (ssl: boolean): string => `smtp${ssl ? 's' : ''}`
const smtpConnectionString = (smtp: SMTP): string =>
  `${smtpProtocol(smtp.ssl)}://${smtp.username}:${smtp?.password}@${smtp.host}:${smtp.port}`

const templateHTMLBody = (changes: DetailedChange[]): string =>
  changes.map((change: DetailedChange) => change.id.getFullName()).join('\n')

const sendEmail = async (
  notification: Notification,
  changes: DetailedChange[],
  config: SMTP,
  attachment?: string):
  Promise<boolean> => {
  const transporter = nodemailer.createTransport(smtpConnectionString(config))
  const mailOptions = {
    from: notification.from,
    to: notification.to,
    subject: notification.subject,
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
    log.info(`Sent mail successfully to ${notification.to.join(',')}`)
  } catch (e) {
    log.error(`Failed to send mail to ${notification.to.join(',')}`)
    return false
  }
  return true
}

export const notify = async (
  notification: Notification,
  changes: DetailedChange[],
  config: Config,
  attachment?: string):
  Promise<boolean> => {
  switch (notification.type) {
    case EmailNotificationType:
      return sendEmail(notification, changes, config.smtp, attachment)
    default:
      return false
  }
}
