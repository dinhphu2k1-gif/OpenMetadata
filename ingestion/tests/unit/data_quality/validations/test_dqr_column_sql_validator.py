#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Tests of the validator of SQL tests declared on Data Quality Rules"""

from unittest.mock import MagicMock

import pytest

from metadata.data_quality.validations.column.sqlalchemy.dqrColumnSqlValidator import (
    DqrColumnSqlValidator,
    count_rows_sql,
    count_violations_sql,
    table_path,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.utils.importer import RULE_LIBRARY_VALIDATOR_MODULE_MAP

SERVICE_TABLE = "core.default.KH_SCHEMA.KH"


@pytest.mark.parametrize(
    "service_type,expected",
    [
        ("Oracle", "KH_SCHEMA.KH"),
        ("Db2", "KH_SCHEMA.KH"),
        ("Mysql", "KH_SCHEMA.KH"),
        ("Postgres", "default.KH_SCHEMA.KH"),
        ("Snowflake", "default.KH_SCHEMA.KH"),
    ],
)
def test_table_path_follows_the_source(service_type, expected):
    assert table_path(SERVICE_TABLE, service_type) == expected


def test_violations_are_counted_by_the_database():
    sql = count_violations_sql("SELECT cccd FROM KH_SCHEMA.KH WHERE cccd IS NULL")
    assert sql == (
        "SELECT COUNT(*) FROM (SELECT cccd FROM KH_SCHEMA.KH WHERE cccd IS NULL) dqr_q"
    )


def test_rows_are_counted_by_the_database():
    assert count_rows_sql("KH_SCHEMA.KH") == "SELECT COUNT(*) FROM KH_SCHEMA.KH"


def test_validator_class_is_registered_for_import():
    assert (
        RULE_LIBRARY_VALIDATOR_MODULE_MAP["DqrColumnSqlValidator"]
        == "dqrColumnSqlValidator"
    )


def validator(scalar_results, compute_passed_failed=False):
    instance = DqrColumnSqlValidator.__new__(DqrColumnSqlValidator)
    instance.runner = MagicMock()
    instance.runner._session.execute.return_value.scalar.side_effect = scalar_results
    instance.test_case = MagicMock()
    instance.test_case.computePassedFailedRowCount = compute_passed_failed
    return instance


def test_run_results_wraps_the_sql_in_a_count():
    instance = validator([7])

    assert instance._run_results(("SELECT cccd FROM T WHERE cccd IS NULL", {})) == 7
    executed = instance.runner._session.execute.call_args.args[0]
    assert str(executed) == (
        "SELECT COUNT(*) FROM (SELECT cccd FROM T WHERE cccd IS NULL) dqr_q"
    )


def test_run_results_refuses_unsafe_sql():
    instance = validator([0])

    with pytest.raises(RuntimeError):
        instance._run_results(("DELETE FROM T", {}))
    instance.runner._session.execute.assert_not_called()


def test_a_failing_query_rolls_the_session_back():
    instance = validator([])
    instance.runner._session.execute.side_effect = ValueError("boom")

    with pytest.raises(ValueError):
        instance._run_results(("SELECT 1 FROM T", {}))
    instance.runner._session.rollback.assert_called_once()


def test_status_is_success_only_without_violations():
    instance = validator([])
    assert instance.get_test_case_status(0 == 0) == TestCaseStatus.Success
    assert instance.get_test_case_status(3 == 0) == TestCaseStatus.Failed
