#!/usr/bin/python3

from selenium import webdriver
from bs4 import BeautifulSoup
import os
import logging
from pathlib import Path

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../../src/autogen/')
PERMISSIONS_DIR = os.path.join(SRC_DIR, 'role_permissions/')

permissions_table_link = 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_N3236764.html'
PERMISSION_TABLE_ROW_LENGTH = 4
LINE_SEPERATOR = '\n  '

LICENSE_HEADER = '''/*
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
'''

role_permissions_file_template = LICENSE_HEADER +'''

export const ID_TO_PERMISSION_INFO: Record<string, Set<string>> = {{
  {permission_id_to_valid_levels}
}}
'''

def is_valid_row(row_cells, permissions, permission_id):
	return (len(row_cells) == PERMISSION_TABLE_ROW_LENGTH
	and permission_id not in permissions
	and permission_id != '')

def parse_table_row(row, permissions):
	cells = row.find_all("td")
	permission_id = cells[0].text.strip()
	if is_valid_row(cells, permissions, permission_id):
		permissions[permission_id] = cells[3].text.strip().split(', ')

def parse_permissions_table():
	try:	
		driver.get(permissions_table_link)
		html_content = driver.page_source
		soup_parser = BeautifulSoup(html_content, 'html.parser')
		table = soup_parser.select('table tr')
		permissions = {}
		for row in table:
				parse_table_row(row, permissions)
		return permissions
	finally:
		driver.quit()

def create_permissions_file(permissions):
	formatted_permissions = ["{key}: new Set({value}),".format(key = key,value = [level.upper() for level in permissions[key]]) for key in permissions]
	file_content = role_permissions_file_template.format(permission_id_to_valid_levels = LINE_SEPERATOR.join(formatted_permissions))
	Path(PERMISSIONS_DIR).mkdir(parents=True, exist_ok=True)
	with open(PERMISSIONS_DIR + 'role_permissions.ts', 'w') as file:
		file.write(file_content)

driver = webdriver.Chrome()
def main():
	permissions = parse_permissions_table()
	create_permissions_file(permissions)
