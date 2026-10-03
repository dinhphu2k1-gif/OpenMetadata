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

"""SQLAlchemy validator of the SQL tests declared on Data Quality Rules.

The declared SQL returns the violating records and is run against every Column of the CDE.
Compared with the rule library validator it lets the database count the violations instead of
fetching them, and it builds a table name that Oracle and DB2 accept.
"""

from typing import Dict, Tuple

from sqlalchemy import text

from metadata.data_quality.validations.column.sqlalchemy.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator,
)
from metadata.data_quality.validations.models import (
    RuleLibrarySqlExpressionRuntimeParameters,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestResultValue
from metadata.utils.entity_link import get_table_fqn
from metadata.utils.helpers import is_safe_sql_query
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

VIOLATIONS_ALIAS = "dqr_q"

# Sources whose tables are addressed as schema.table, without the database part of the FQN.
SCHEMA_QUALIFIED_ONLY = {
    DatabaseServiceType.Mysql.value,
    DatabaseServiceType.MariaDB.value,
    DatabaseServiceType.SQLite.value,
    DatabaseServiceType.Cockroach.value,
    DatabaseServiceType.Oracle.value,
    DatabaseServiceType.Db2.value,
}


def table_path(table_fqn: str, service_type: str) -> str:
    """Table as it is addressed in SQL: the FQN without the service and, for sources that have
    no database level, without the database."""
    parts = table_fqn.split(".")
    return ".".join(parts[2:] if service_type in SCHEMA_QUALIFIED_ONLY else parts[1:])


def count_violations_sql(violations_sql: str) -> str:
    """Wraps the query returning the violating records so that the database counts them."""
    return f"SELECT COUNT(*) FROM ({violations_sql}) {VIOLATIONS_ALIAS}"


def count_rows_sql(table_name: str) -> str:
    return f"SELECT COUNT(*) FROM {table_name}"


class DqrColumnSqlValidator(ColumnRuleLibrarySqlExpressionValidator):
    """Runs the SQL declared on a Data Quality Rule against one Column."""

    def get_table_name(self) -> str:
        entity_link = self.test_case.entityLink.root
        service_type = self.runtime_params.conn_config.config.type.value
        return table_path(get_table_fqn(entity_link), service_type)

    def _run_results(self, sql_expression: Tuple[str, Dict[str, str]]) -> int:
        """Number of violating records, counted by the database."""
        compiled_sql, bind_params = sql_expression
        if not is_safe_sql_query(compiled_sql):
            raise RuntimeError(f"SQL expression is not safe\n\n{compiled_sql}")
        return self._scalar(count_violations_sql(compiled_sql), bind_params)

    def _count_table_rows(self, table_name: str) -> int:
        return self._scalar(count_rows_sql(table_name), {})

    def _scalar(self, sql: str, bind_params: Dict[str, str]) -> int:
        try:
            value = self.runner._session.execute(text(sql), bind_params).scalar()
            return int(value or 0)
        except Exception as exc:
            self.runner._session.rollback()
            logger.exception(f"Error executing SQL expression: {exc}")
            raise

    def _run_validation(self) -> TestCaseResult:
        self.runtime_params = self.get_runtime_parameters(
            RuleLibrarySqlExpressionRuntimeParameters
        )
        column_name = self.get_column_name()
        table_name = self.get_table_name()
        violations = self._run_results(
            self.compile_sql_expression(column_name, table_name)
        )
        row_count = (
            self._count_table_rows(table_name)
            if self.test_case.computePassedFailedRowCount
            else None
        )

        result = self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(violations == 0),
            f"Column '{column_name}' in table '{table_name}' has {violations} violating "
            f"records. Expected 0.",
            [
                TestResultValue(
                    name="Row Count", value=str(violations), predictedValue=None
                )
            ],
            row_count=row_count,
            failed_rows=violations if row_count is not None else None,
        )
        if result.failedRows is None:
            result.failedRows = violations
        return result
