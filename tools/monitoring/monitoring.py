import re
import os
import yaml
import json
import logging
import smtplib

from git import Repo
from email.message import EmailMessage
from logging.handlers import RotatingFileHandler
from jinja2 import Environment, FileSystemLoader
from subprocess import Popen, STDOUT, PIPE, CalledProcessError


YAML = 'yaml'
JSON = 'json'
EMAIL = 'email'

TEMPLATE_NAME = 'monitoring_email_template.html'
SALTO_CONFIG_PATH = 'salto.config/states/{!s}.jsonl'


class ConfigurationFileNotFoundException(Exception):
    pass


class ConfigurationFileTypeException(Exception):
    pass


class MissingConfigurationException(Exception):
    pass


class UnknownNotificationTypeException(Exception):
    pass


class Config:

    def __init__(self, config):
        self.config = config
        self._configure_logging()

    @property
    def logger(self):
        return self._logger

    def get(self, config_path):
        config = None
        for ix, conf_name in enumerate(config_path):
            try:
                config = config[conf_name] if config else self.config[conf_name]
            except (KeyError, TypeError):
                config_path = config_path[:ix + 1]
                raise MissingConfigurationException(
                    u"{!s} config is missing. config path: {!s}"
                        .format(conf_name, ' -> '.join(config_path)))
        return config

    @staticmethod
    def configure(file_path, file_type):
        config = Config._from_file(file_path, file_type)
        Config._validate(config)
        return config

    @staticmethod
    def _from_file(file_path, file_type):
        try:
            with open(file_path, 'r') as f:
                if file_type == YAML:
                    return Config._read_yaml_file(f)
                elif file_type == JSON:
                    return Config._read_json_file(f)
                else:
                    raise ConfigurationFileTypeException(
                        u"file type {!s} not supported.".format(file_type))
        except IOError:
            if not os.path.exists(file_path):
                raise ConfigurationFileNotFoundException(
                    u"configuration file not found. path: {!s}".format(file_path))
            raise

    @staticmethod
    def _read_yaml_file(f):
        return Config._from_dict(yaml.safe_load(f))

    @staticmethod
    def _read_json_file(f):
        return Config._from_dict(json.load(f))

    @staticmethod
    def _from_dict(config):
        return Config(config)

    @staticmethod
    def _validate(config):
        pass

    def _configure_logging(self):
        logging.basicConfig(format=self.get(['logging', 'format']),
                            level=self.get(['logging', 'level']))
        logger = logging.getLogger()

        file_handler = RotatingFileHandler(
            filename=self.get(['logging', 'file_path']),
            maxBytes=50*1024*1024, backupCount=10)
        file_handler.setFormatter(logging.Formatter(
            fmt=self.get(['logging', 'format'])))
        logger.addHandler(file_handler)

        self._logger = logging.getLogger(__name__)


class SaltoClient:

    @staticmethod
    def fetch():
        Utils.execute_command(['salto', 'fetch'])

    @staticmethod
    def preview():
        return Utils.execute_command(['salto', 'preview'])


class Utils:

    @staticmethod
    def parse_salto_preview_output(stdout):
        sanitized_stdout = []
        for line in stdout:
            try:
                decoded_line = line.decode().replace('\n', '')
                if not decoded_line:
                    continue
            except (UnicodeDecodeError, AttributeError):
                continue

            chars = list(decoded_line.lstrip())
            if len(chars) >= 2 and chars[1] == ' ':
                if chars[0] in ['|']:
                    decoded_line = decoded_line.replace('|', ' ')
                    decoded_line += ':'
                elif chars[0] in ['+', '-', 'M']:
                    decoded_line = decoded_line.replace(chars[0] + ' ', '- ' + chars[0])
                    decoded_line = decoded_line
                else:
                    continue
                sanitized_stdout.append(decoded_line)

        sanitized_stdout = sanitized_stdout[2:-3]
        return yaml.safe_load('\n'.join(sanitized_stdout))

    @staticmethod
    def execute_command(cmd):
        process = Popen(cmd, stdout=PIPE, stderr=STDOUT)
        stdout = process.stdout.readlines()
        process.stdout.close()
        return_code = process.wait()
        if return_code != 0:
            raise CalledProcessError(return_code, cmd)
        return stdout

    @staticmethod
    def read_file(file_path):
        with open(file_path, 'r') as f:
            return f.readlines()

    @staticmethod
    def write_file(file_path, lines):
        with open(file_path, 'w') as f:
            return f.writelines(lines)

    @staticmethod
    def flat_changes(lst, d, r=''):
        if type(d) == dict:
            for k, v in d.items():
                Utils.flat_changes(lst, v, r='{!s}.{!s}'.format(r, k))
        elif type(d) == list:
            for v in d:
                Utils.flat_changes(lst, v, r='{!s}.{!s}'.format(r, v))
        else:
            lst.append(r[1:])


class Trigger:

    def __init__(self, name, title, element_id_regex):
        self.name = name
        self.title = title
        self.element_id_regex = element_id_regex

        self._match_changes = []

    @property
    def triggered(self):
        return len(self._match_changes) > 0

    @property
    def match_changed(self):
        return self._match_changes

    def find_match_changes(self, changes):
        for change in changes:
            for pattern in self.element_id_regex:
                if re.match(pattern, change):
                    self._match_changes.append(change)

    @staticmethod
    def from_dict(d):
        return Trigger(d['name'], d['title'], d['element_id_regex'])


class Notification:

    def __init__(self, _type, subject, _from, to, triggers):
        self.type = _type
        self.subject = subject
        self._from = _from
        self.to = to
        self._triggers = triggers

    @property
    def triggers(self):
        return self._triggers

    def notify(self, match_triggers, smtp_config=None):
        if self.type.lower() == EMAIL:
            self.send_email(smtp_config, self.subject, self._from, self.to, match_triggers)
        else:
            raise UnknownNotificationTypeException('{!s} type is invalid'.format(self.type.lower()))

    @staticmethod
    def send_email(smtp_config, subject, _from, to, triggers):
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = _from
        msg['To'] = tuple(to)

        jinja_env = Environment(loader=FileSystemLoader('.'),
                                trim_blocks=True)
        body = jinja_env.get_template(TEMPLATE_NAME).render(
            triggers=triggers
        )
        msg.add_alternative(body, subtype='html')

        smtp = smtplib.SMTP_SSL if smtp_config['ssl'] else smtplib.SMTP
        server = smtp(host=smtp_config['host'], port=smtp_config['port'])
        if smtp_config['auth']:
            server.login(smtp_config['username'], smtp_config['password'])

        server.send_message(msg)
        server.quit()

    @staticmethod
    def from_dict(d):
        return Notification(d['type'], d['subject'], d['from'], d['to'], d['triggers'])


def main(logger, get_config):
    repo = Repo()
    state_file_path = SALTO_CONFIG_PATH.format(get_config(['env']))

    logger.info('reading the current state file')
    current_state = Utils.read_file(state_file_path)
    logger.info('fetching state')
    SaltoClient.fetch()

    logger.info('reading the updated state file')
    updated_state = Utils.read_file(state_file_path)
    previous_state = current_state

    logger.info('overriding state with previous state file')
    Utils.write_file(state_file_path, previous_state)
    logger.info('find changes using salto preview')
    changes = SaltoClient.preview()

    logger.info('flatting salto preview output')
    flatten_changes = []
    Utils.flat_changes(flatten_changes, Utils.parse_salto_preview_output(changes))

    logger.info('loading notifications from config file')
    notifications = [Notification.from_dict(notification_config)
                     for notification_config in get_config(['notifications'])]

    logger.info('loading triggers from config file')
    triggers = [Trigger.from_dict(trigger_config)
                for trigger_config in get_config(['triggers'])]
    for trigger in triggers:
        trigger.find_match_changes(flatten_changes)

    for notification in notifications:
        match_triggers = [trigger for trigger in triggers
                          if trigger.triggered and trigger.name in notification.triggers]
        if len(match_triggers) > 0:
            logger.info('{!s} triggers matched, sending {!s} to {!s}'
                        .format(len(match_triggers), notification.type, notification.to))
            notification.notify(match_triggers, smtp_config=get_config(['smtp']))

    logger.info('overriding state with updated state file')
    Utils.write_file(state_file_path, updated_state)
    logger.info('committing the updated state file')
    repo.git.add('--all')
    repo.git.commit('-m', 'Update state')


if __name__ == '__main__':
    config = Config.configure('config.yaml', YAML)
    logger = config.logger
    logger.debug('configured successfully')

    try:
        main(logger, config.get)
        logger.info('finished successfully')
    except Exception:
        if logger:
            logger.exception('script failed')
