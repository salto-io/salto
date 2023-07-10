 #!/usr/bin/python3
from selenium import webdriver
from bs4 import BeautifulSoup
import os
from pathlib import Path
from constants import LICENSE_HEADER, LINE_SEPERATOR, TABLE_DATA, TAB

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../../src/autogen/')
PERMISSIONS_DIR = os.path.join(SRC_DIR, 'role_permissions/')
PERMISSION_TABLE_ROW_LENGTH = 4

permissions_table_link = 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_N3236764.html'
role_permissions_file_template = LICENSE_HEADER + '''

export type PermissionLevel = 'NONE' | 'VIEW' | 'FULL' | 'CREATE' | 'EDIT'
export const ID_TO_PERMISSION_INFO: Readonly<Record<string, ReadonlySet<PermissionLevel>>> = {{
  {permission_id_to_valid_levels}
}}
'''

def is_valid_row(row_cells, permissions, permission_id):
  return (len(row_cells) == PERMISSION_TABLE_ROW_LENGTH
  and permission_id not in permissions
  and permission_id != '')

def parse_table_row(row, permissions):
  cells = row.find_all(TABLE_DATA)
  if len(cells) == 0: return
  permission_id = cells[0].text.strip()
  if is_valid_row(cells, permissions, permission_id):
    permissions[permission_id] = cells[3].text.strip().split(', ')

def parse_permissions_table(driver):
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
  file_content = role_permissions_file_template.format(permission_id_to_valid_levels = (LINE_SEPERATOR + TAB).join(formatted_permissions))
  Path(PERMISSIONS_DIR).mkdir(parents=True, exist_ok=True)
  with open(PERMISSIONS_DIR + 'role_permissions.ts', 'w') as file:
    file.write(file_content)

def main(driver):
  permissions = parse_permissions_table(driver)
  create_permissions_file(permissions)

if __name__=='__main__':
  driver = webdriver.Chrome()
  main(driver)