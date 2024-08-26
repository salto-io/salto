# Copyright 2024 Salto Labs Ltd.
# Licensed under the Salto Terms of Use (the "License");
# You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
#
# CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
import os
import sys
import json
from collections import OrderedDict
import urllib.parse
import argparse
from typing import Any


def read_http_data_from_salto_log(logpath: str) -> list[dict[str, Any]]:
    """Return HTTP response data from a Salto log file."""
    with open(logpath) as logfile:
        return [
            json.loads(l[l.find(": ") + 2 :].strip())
            for l in logfile.readlines()
            if "Full HTTP response" in l or "Truncated HTTP response" in l
        ]


def convert_to_nock_format(http_data: dict[str, Any]) -> dict[str, Any]:
    http_data.setdefault("scope", "")
    http_data.setdefault("path", http_data.pop("url", None))
    if not http_data["path"].startswith("/"):
        parsed = urllib.parse.urlparse(http_data["path"])
        http_data["path"] = parsed.path
        http_data["scope"] = f"{parsed.scheme}://{parsed.netloc}"
    if "data" in http_data:
        http_data.setdefault("body", http_data.pop("data"))
    if "body" in http_data and http_data["body"] is None:
        del http_data["body"]
    http_data.setdefault("reqHeaders", http_data.pop("headers", None))
    if "queryParams" in http_data:
        params = urllib.parse.urlencode(http_data.pop("queryParams"))
        http_data["path"] = f"{http_data['path']}?{str(params)}"

    property_order = ["path", "scope", "method", "status"]
    ordered_http_data = OrderedDict()
    for prop in property_order:
        ordered_http_data[prop] = http_data[prop]

    for prop in http_data:
        if prop not in property_order:
            ordered_http_data[prop] = http_data[prop]

    return ordered_http_data


def write_mocks_to_json(mocks: list[dict[str, Any]], mockpath: str, pretty: bool) -> None:
    print(f"Writing {len(mocks)} mock HTTP calls to {mockpath}")
    with open(mockpath, "w") as mockfile:
        if pretty:
            json.dump(mocks, mockfile, indent=2)
        else:
            lines = [f"\t{json.dumps(m)}" for m in mocks]
            mockfile.write("[\n")
            mockfile.write(",\n".join(lines))
            mockfile.write("\n]\n")


def write_mocks_from_salto_log(args):
    logpath = args.logpath
    mockpath = args.mockpath
    pretty = args.pretty
    response_details = read_http_data_from_salto_log(logpath)
    mocks = [convert_to_nock_format(l) for l in response_details]
    write_mocks_to_json(mocks, mockpath, pretty)


def convert_existing_mock_file_to_nock_format(args):
    mockpath = args.mockpath
    pretty = args.pretty
    with open(mockpath, "r") as mockfile:
        mocks = json.load(mockfile)
        new_mocks = [convert_to_nock_format(l) for l in mocks]

    write_mocks_to_json(new_mocks, mockpath, pretty)


def get_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate Nock-formatted json files from Salto log files or Axios-formatted json files."
    )
    subparsers = parser.add_subparsers(dest="command")

    parse_log_parser = subparsers.add_parser("parse", help="Parse Salto log files")
    parse_log_parser.add_argument("logpath", help="Path to Salto log file")
    parse_log_parser.add_argument("mockpath", help="Path to output json file")
    parse_log_parser.add_argument(
        "--pretty", action="store_true", help="Pretty print the output json file"
    )
    parse_log_parser.set_defaults(func=write_mocks_from_salto_log)

    convert_json_parser = subparsers.add_parser(
        "convert", help="Convert Axios-formatted json files in-place"
    )
    convert_json_parser.add_argument("mockpath", help="Path to json file")
    convert_json_parser.add_argument(
        "--pretty", action="store_true", help="Pretty print the output json file"
    )
    convert_json_parser.set_defaults(func=convert_existing_mock_file_to_nock_format)

    return parser


def main() -> None:
    parser = get_arg_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
